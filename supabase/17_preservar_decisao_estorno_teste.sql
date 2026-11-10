begin;
alter table public.pedidos_mp_teste add column if not exists encaminhado_estorno boolean not null default false;
create or replace function public.conciliar_pagamento_teste(
    p_pedido uuid, p_admin uuid, p_vendedor text, p_pagamento jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    v_pedido public.pedidos_mp_teste%rowtype;
    v_id text := p_pagamento->>'id';
    v_status text := p_pagamento->>'status';
    v_total numeric := (p_pagamento->>'total')::numeric;
    v_estornado numeric := (p_pagamento->>'estornado')::numeric;
    v_taxa numeric := (p_pagamento->>'taxa')::numeric;
    v_liquido numeric := (p_pagamento->>'liquido')::numeric;
    v_data timestamptz := (p_pagamento->>'atualizado_em')::timestamptz;
    v_aprovado timestamptz := (p_pagamento->>'aprovado_em')::timestamptz;
    v_conciliacao text;
    v_tardia boolean;
    v_expirada boolean;
    v_sem_estoque boolean := false;
    v_item record;
    v_confirmacao jsonb;
    v_venda boolean;
    v_chave text;
begin
    select * into v_pedido from public.pedidos_mp_teste
    where id=p_pedido and admin_id=p_admin for update;
    if not found or not exists (select 1 from public.administradores where usuario_id=p_admin) then
        raise exception 'Pedido ou administrador não autorizado.';
    end if;
    if p_vendedor is null or p_vendedor<>v_pedido.vendedor_id
       or v_id is null or v_id !~ '^[0-9]{1,30}$'
       or v_total is null or v_total<>v_pedido.total
       or v_pedido.preferencia_id is null or v_data is null
       or not isfinite(v_data) or v_data>now()+interval '10 minutes'
       or v_status is null or v_status not in ('approved','pending','in_process','rejected','cancelled','refunded','charged_back','authorized','in_mediation')
       or v_estornado is null or not (v_estornado between 0 and v_total)
       or v_estornado<>round(v_estornado,2)
       or (v_taxa is not null and not (v_taxa between 0 and v_total))
       or (v_liquido is not null and not (v_liquido between -v_total and v_total)) then
        raise exception 'Snapshot do pagamento inválido ou divergente.';
    end if;
    if v_pedido.pagamento_id is not null and v_pedido.pagamento_id<>v_id then
        raise exception 'Pedido associado a outro pagamento. Exige conciliação.';
    end if;
    if v_pedido.pagamento_atualizado_em>v_data then
        return jsonb_build_object('id',p_pedido,'status',v_pedido.status,'pagamento_id',v_pedido.pagamento_id,'ignorado',true);
    end if;
    if v_pedido.valor_estornado>v_estornado
       or (v_pedido.status='approved' and v_status not in ('approved','refunded','charged_back','in_mediation'))
       or (v_pedido.status in ('refunded','charged_back','cancelled') and v_status<>v_pedido.status) then
        raise exception 'Atualização conflita com pagamento encerrado ou estorno acumulado. Exige conciliação.';
    end if;
    v_chave := md5(jsonb_build_object('id',v_id,'status',v_status,'estornado',v_estornado,
        'taxa',v_taxa,'liquido',v_liquido,'data',v_data)::text);
    if v_pedido.pagamento_atualizado_em=v_data and exists (
        select 1 from public.eventos_checkout_teste where pedido_id=p_pedido
        and atualizado_gateway_em=v_data and chave<>v_chave
    ) then
        raise exception 'Snapshots conflitantes para a mesma atualização. Consulte novamente.';
    end if;

    v_tardia := v_pedido.aprovacao_tardia;
    update public.pedidos_mp_teste set status=v_status, pagamento_id=v_id,
        consultado_em=now(), encerramento_verificado_em=null
    where id=p_pedido;

    if v_status='approved' then
        -- Confere toda a grade antes de reservar ou consumir qualquer peça.
        if not exists (select 1 from public.reservas_checkout_teste where pedido_id=p_pedido)
           or exists (
            select 1 from (
                select (i->>'variacao_id')::uuid variacao_id, sum((i->>'quantidade')::integer) quantidade
                from jsonb_array_elements(v_pedido.itens) i group by (i->>'variacao_id')::uuid
            ) i full join (
                select variacao_id,quantidade from public.reservas_checkout_teste where pedido_id=p_pedido
            ) r using(variacao_id)
            where i.variacao_id is null or r.variacao_id is null or i.quantidade<>r.quantidade
        ) then raise exception 'Reserva não corresponde aos itens do pedido.'; end if;

        select bool_and(estado='expirada') into v_expirada
        from public.reservas_checkout_teste where pedido_id=p_pedido;
        v_tardia := v_tardia or v_expirada or exists (
            select 1 from public.reservas_checkout_teste
            where pedido_id=p_pedido and expira_em<v_aprovado
        );
        if v_pedido.encaminhado_estorno or v_pedido.conciliacao='estorno_necessario' then
            v_conciliacao := 'estorno_necessario';
        elsif v_expirada and v_estornado=0 then
            -- Ordem fixa evita deadlocks entre carrinhos com as mesmas peças.
            perform 1 from public.estoque_checkout_teste e
            join public.reservas_checkout_teste r using(variacao_id)
            where r.pedido_id=p_pedido order by e.variacao_id for update of e;
            select exists (
                select 1 from public.reservas_checkout_teste r
                left join public.estoque_checkout_teste e using(variacao_id)
                where r.pedido_id=p_pedido and (e.variacao_id is null or e.estoque-e.reservado<r.quantidade)
            ) into v_sem_estoque;
            if v_sem_estoque then
                v_conciliacao := 'estorno_necessario';
            else
                for v_item in select * from public.reservas_checkout_teste
                    where pedido_id=p_pedido order by variacao_id for update
                loop
                    update public.estoque_checkout_teste set reservado=reservado+v_item.quantidade,
                        atualizado_em=now() where variacao_id=v_item.variacao_id;
                end loop;
                update public.reservas_checkout_teste set estado='reservada',atualizado_em=now()
                where pedido_id=p_pedido;
            end if;
        elsif v_estornado>0 and exists (
            select 1 from public.reservas_checkout_teste where pedido_id=p_pedido and estado<>'consumida'
        ) then
            v_conciliacao := 'estorno_necessario';
        end if;
        if v_conciliacao is null then
            v_confirmacao := public.confirmar_pagamento_teste(p_pedido,p_admin,p_vendedor,v_id,v_total);
            if not coalesce((v_confirmacao->>'venda_registrada')::boolean,false) then
                raise exception 'Venda simulada não registrada.';
            end if;
            if v_estornado>0 then v_conciliacao := 'estorno_parcial'; end if;
        end if;
    elsif v_status in ('cancelled','refunded','charged_back') then
        perform public.liberar_reserva_teste(p_pedido,p_admin,'cancelamento');
        v_conciliacao := case v_status when 'refunded' then 'reversao_pagamento'
            when 'charged_back' then 'contestacao' else null end;
    elsif v_status='in_mediation' then
        v_conciliacao := 'contestacao_em_analise';
    end if;

    update public.pedidos_mp_teste set conciliacao=v_conciliacao,aprovacao_tardia=v_tardia,
        encaminhado_estorno=encaminhado_estorno or v_conciliacao is not distinct from 'estorno_necessario',
        valor_estornado=v_estornado,taxa_mp=v_taxa,valor_liquido=v_liquido,pagamento_atualizado_em=v_data
    where id=p_pedido;
    insert into public.eventos_checkout_teste(pedido_id,chave,pagamento_id,status,valor_estornado,taxa_mp,valor_liquido,atualizado_gateway_em)
    values(p_pedido,v_chave,v_id,v_status,v_estornado,v_taxa,v_liquido,v_data)
    on conflict (pedido_id,chave) do nothing;
    select exists(select 1 from public.vendas_checkout_teste where pedido_id=p_pedido) into v_venda;
    return jsonb_build_object('id',p_pedido,'status',v_status,'pagamento_id',v_id,
        'conciliacao',v_conciliacao,'aprovacao_tardia',v_tardia,'venda_registrada',v_venda,
        'valor_estornado',v_estornado,'taxa_mp',v_taxa,'valor_liquido',v_liquido,
        'pagamento_atualizado_em',v_data);
end;
$$;
revoke all on function public.conciliar_pagamento_teste(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.conciliar_pagamento_teste(uuid,uuid,text,jsonb) to service_role;
commit;
