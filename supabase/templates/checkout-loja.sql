-- Complementos específicos da operação real. A ativação depende do servidor.
alter table public.pedidos_checkout add column atendimento text not null default 'aguardando_pagamento'
    check(atendimento in ('aguardando_pagamento','separacao','pronto_retirada','entregue')),
    add column solicitacao_cancelamento boolean not null default false,
    add column solicitacao_estorno boolean not null default false,
    add column reserva_verificada_em timestamptz;
alter table public.transacoes add column pedido_checkout uuid references public.pedidos_checkout(id),
    add column natureza_checkout text,
    add constraint transacao_checkout_unica unique(pedido_checkout,natureza_checkout);

create or replace function public.registrar_venda_checkout_loja()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
    v_pedido public.pedidos_checkout%rowtype;
    v_cliente uuid;
    v_item jsonb;
    v_grade record;
    v_itens jsonb := '[]';
begin
    select * into strict v_pedido from public.pedidos_checkout where id=new.pedido_id for update;
    if exists(select 1 from public.vendas where id=new.pedido_id) then
        raise exception 'Identificador de venda já utilizado.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(lower(v_pedido.cliente->>'email'),0));
    select codigo into v_cliente from public.clientes
    where lower(email)=lower(v_pedido.cliente->>'email') order by criado_em limit 1;
    if v_cliente is null then
        insert into public.clientes(nome,telefone,email)
        values(v_pedido.cliente->>'nome',v_pedido.cliente->>'telefone',lower(v_pedido.cliente->>'email'))
        returning codigo into v_cliente;
    end if;
    for v_item in select value from jsonb_array_elements(new.itens) loop
        select pv.codigo,pc.custo into v_grade from public.produto_variacoes pv
        join public.produto_custos pc on pc.produto_id=pv.produto_id
        where pv.id=(v_item->>'variacao_id')::uuid;
        if not found or v_grade.custo is null then raise exception 'Confira o custo da peça antes de confirmar a venda.'; end if;
        v_itens := v_itens || jsonb_build_array(jsonb_build_object(
            'id',v_item->>'variacao_id','codigo',v_grade.codigo,'nome',v_item->>'nome',
            'tamanho',v_item->>'tamanho','cor',v_item->>'cor','qtd',(v_item->>'quantidade')::integer,
            'preco',(v_item->>'preco')::numeric,'custoUnit',v_grade.custo));
    end loop;
    insert into public.vendas(id,cliente,pagamento,total,itens,origem)
    values(new.pedido_id,v_cliente,'Mercado Pago',new.total,v_itens,'checkout');
    update public.clientes set compras=compras+1,"ultimaCompra"=to_char(current_date,'DD/MM/YYYY') where codigo=v_cliente;
    update public.pedidos_checkout set atendimento='separacao'
    where id=new.pedido_id and atendimento='aguardando_pagamento';
    return new;
end;
$$;
create trigger registrar_venda_loja after insert on public.vendas_checkout
for each row execute function public.registrar_venda_checkout_loja();

create or replace function public.ajustar_financeiro_checkout()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
    v_venda boolean;
    v_natureza text;
    v_valor numeric;
    v_tipo text;
begin
    select exists(select 1 from public.vendas_checkout where pedido_id=new.pedido_id) into v_venda;
    for v_natureza,v_valor,v_tipo in
        select 'taxa',coalesce(taxa_mp,0),'despesa' from public.pedidos_checkout where id=new.pedido_id
        union all select 'reversao',greatest(valor_estornado,case when status='charged_back' then total else 0 end),'despesa'
            from public.pedidos_checkout where id=new.pedido_id
        union all select 'a_devolver',case when not v_venda and status in ('approved','refunded','charged_back','in_mediation') then total else 0 end,'receita'
            from public.pedidos_checkout where id=new.pedido_id
    loop
        if v_valor>0 then
            insert into public.transacoes(tipo,descricao,valor,categoria,origem,pedido_checkout,natureza_checkout)
            values(v_tipo,(case v_natureza when 'taxa' then 'Taxa do Mercado Pago'
                when 'reversao' then 'Estorno ou contestação' else 'Pagamento recebido a devolver' end)
                ||' — pedido '||new.pedido_id::text,v_valor,'Pagamentos online','checkout',new.pedido_id,v_natureza)
            on conflict(pedido_checkout,natureza_checkout) do update set valor=excluded.valor;
        else
            delete from public.transacoes where pedido_checkout=new.pedido_id and natureza_checkout=v_natureza;
        end if;
    end loop;
    return new;
end;
$$;
create trigger ajustar_financeiro after insert on public.eventos_checkout
for each row execute function public.ajustar_financeiro_checkout();

create or replace function public.atender_pedido_checkout(p_pedido uuid,p_admin uuid,p_estado text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_pedido public.pedidos_checkout%rowtype;
begin
    if not exists(select 1 from public.administradores where usuario_id=p_admin) then raise exception 'Administrador não autorizado.'; end if;
    select * into strict v_pedido from public.pedidos_checkout where id=p_pedido for update;
    if v_pedido.status<>'approved' or v_pedido.conciliacao is not null or v_pedido.solicitacao_cancelamento
       or not exists(select 1 from public.vendas_checkout where pedido_id=p_pedido) then
        raise exception 'Confira o pagamento e as pendências antes do atendimento.';
    end if;
    if p_estado is null or not (
        (v_pedido.atendimento='separacao' and p_estado='pronto_retirada')
        or (v_pedido.atendimento='pronto_retirada' and p_estado='entregue')
        or v_pedido.atendimento=p_estado
    ) then raise exception 'Etapa de atendimento inválida.'; end if;
    update public.pedidos_checkout set atendimento=p_estado where id=p_pedido;
    return jsonb_build_object('atualizado',true);
end;
$$;
revoke all on function public.registrar_venda_checkout_loja() from public,anon,authenticated;
revoke all on function public.ajustar_financeiro_checkout() from public,anon,authenticated;
revoke all on function public.atender_pedido_checkout(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.atender_pedido_checkout(uuid,uuid,text) to service_role;

create or replace function public.solicitar_cancelamento_checkout(p_pedido uuid,p_admin uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_pedido public.pedidos_checkout%rowtype;
begin
    select * into strict v_pedido from public.pedidos_checkout where id=p_pedido and admin_id=p_admin for update;
    if v_pedido.status in ('cancelled','refunded','charged_back') then return jsonb_build_object('solicitado',false); end if;
    update public.pedidos_checkout set solicitacao_cancelamento=true,
        solicitacao_estorno=pagamento_id is not null,
        encaminhado_estorno=not exists(select 1 from public.vendas_checkout where pedido_id=p_pedido)
    where id=p_pedido;
    return jsonb_build_object('solicitado',true);
end;
$$;
revoke all on function public.solicitar_cancelamento_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.solicitar_cancelamento_checkout(uuid,uuid) to service_role;

create or replace function public.expirar_checkout_sem_preferencia(p_pedido uuid,p_admin uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_pedido public.pedidos_checkout%rowtype; v_reserva record;
begin
    select * into strict v_pedido from public.pedidos_checkout where id=p_pedido and admin_id=p_admin for update;
    if not exists(select 1 from public.administradores where usuario_id=p_admin)
       or v_pedido.preferencia_id is not null or v_pedido.pagamento_id is not null
       or v_pedido.status<>'aguardando_checkout' then raise exception 'O pedido mudou; consulte novamente.'; end if;
    if v_pedido.checkout_expira_em is null or v_pedido.checkout_expira_em>now()-interval '2 minutes' then
        raise exception 'Aguarde o vencimento da tentativa.';
    end if;
    -- O servidor confirmou busca de preferências e ausência de pagamentos.
    -- Qualquer aprovação tardia posterior passa pela reconciliação de estoque.
    for v_reserva in select * from public.reservas_checkout
        where pedido_id=p_pedido and estado='reservada' order by variacao_id for update
    loop
        update public.estoque_checkout set reservado=reservado-v_reserva.quantidade,atualizado_em=now()
        where variacao_id=v_reserva.variacao_id and reservado>=v_reserva.quantidade;
        if not found then raise exception 'Saldo reservado inconsistente.'; end if;
        update public.reservas_checkout set estado='expirada',atualizado_em=now()
        where pedido_id=p_pedido and variacao_id=v_reserva.variacao_id;
    end loop;
    return jsonb_build_object('estado','expirada');
end;
$$;
revoke all on function public.expirar_checkout_sem_preferencia(uuid,uuid) from public,anon,authenticated;
grant execute on function public.expirar_checkout_sem_preferencia(uuid,uuid) to service_role;

create table public.limites_checkout(chave text not null, minuto timestamptz not null,quantidade integer not null,primary key(chave,minuto));
alter table public.limites_checkout enable row level security;
revoke all on public.limites_checkout from public,anon,authenticated;
grant select,insert,update,delete on public.limites_checkout to service_role;
create or replace function public.limitar_checkout(p_chave text,p_limite integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_quantidade integer;
begin
    if p_chave is null or p_chave !~ '^[a-f0-9]{64}$' or p_limite is null or p_limite not between 1 and 100 then raise exception 'Limite inválido.'; end if;
    insert into public.limites_checkout values(p_chave,date_trunc('minute',now()),1)
    on conflict(chave,minuto) do update set quantidade=public.limites_checkout.quantidade+1 returning quantidade into v_quantidade;
    if v_quantidade>p_limite then raise exception 'Muitas tentativas. Aguarde um minuto.'; end if;
    delete from public.limites_checkout where minuto<now()-interval '1 day';
    return jsonb_build_object('permitido',true);
end;
$$;
revoke all on function public.limitar_checkout(text,integer) from public,anon,authenticated;
grant execute on function public.limitar_checkout(text,integer) to service_role;
