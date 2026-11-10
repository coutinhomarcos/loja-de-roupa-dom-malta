-- Gerado por scripts/gerar-checkout-loja.js. Não habilita pagamentos.
begin;
alter table public.produto_variacoes add column if not exists atualizado_em timestamptz not null default now();
create or replace view public.estoque_checkout as select id variacao_id,estoque,reservado,atualizado_em from public.produto_variacoes;
revoke all on public.estoque_checkout from public,anon,authenticated;
grant select,update on public.estoque_checkout to service_role;
-- Etapa 04: Checkout Pro SOMENTE TESTE. Execute após 02 e 03.
-- Não altera pedidos_site, estoque, vendas nem transacoes.
create table if not exists public.pedidos_checkout (
 id uuid primary key, criado_em timestamptz not null default now(),
 admin_id uuid not null references auth.users(id), vendedor_id text not null, acesso_hash text not null check(acesso_hash ~ '^[a-f0-9]{64}$'),
 cliente jsonb not null, solicitacao jsonb not null, itens jsonb not null,
 total numeric(12,2) not null check(total>0),
 status text not null default 'aguardando_checkout' check(status in
 ('aguardando_checkout','aguardando_pagamento','approved','pending','in_process','rejected','cancelled','refunded','charged_back','authorized','in_mediation')),
 criacao_iniciada boolean not null default false,
 preferencia_id text unique, checkout_url text, pagamento_id text unique,
 consultado_em timestamptz
);
alter table public.pedidos_checkout enable row level security;
revoke all on public.pedidos_checkout from public,anon,authenticated;
grant select on public.pedidos_checkout to authenticated;
grant all on public.pedidos_checkout to service_role;
drop policy if exists "Admin consulta seus testes MP" on public.pedidos_checkout;
create policy "Admin consulta seus testes MP" on public.pedidos_checkout for select to authenticated
using(admin_id=(select auth.uid()) and exists(select 1 from public.administradores where usuario_id=(select auth.uid())));
create or replace function public.criar_pedido_checkout(p_id uuid,p_cliente jsonb,p_itens jsonb,p_total numeric,p_admin uuid,p_vendedor text,p_acesso_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 existente public.pedidos_checkout%rowtype; item jsonb; registro record;
 qtd integer; soma numeric(12,2):=0; lista jsonb:='[]';
begin
 if not exists(select 1 from public.administradores where usuario_id=p_admin) or coalesce(p_vendedor,'') !~ '^[0-9]{1,30}$' then raise exception 'Administrador ou vendedor inválido.'; end if;
 if p_acesso_hash is null or p_acesso_hash !~ '^[a-f0-9]{64}$' then raise exception 'Chave do pedido inválida.'; end if;
 if p_id is null or p_cliente is null or jsonb_typeof(p_cliente)<>'object' or octet_length(p_cliente::text)>8000
 or p_itens is null or jsonb_typeof(p_itens)<>'array' then raise exception 'Dados do pedido inválidos.'; end if;
 if jsonb_array_length(p_itens)<1 or jsonb_array_length(p_itens)>50 then raise exception 'Escolha entre 1 e 50 variações.'; end if;
 if length(trim(coalesce(p_cliente->>'nome','')))<3 or length(p_cliente->>'nome')>120
 or coalesce(p_cliente->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_cliente->>'email')>160
 or coalesce(p_cliente->>'telefone','') !~ '^[0-9]{10,11}$'
 or coalesce(p_cliente->>'recebimento','') <> 'retirada' or length(coalesce(p_cliente->>'observacoes',''))>500 then raise exception 'Confira nome, e-mail, telefone e recebimento.'; end if;
 if p_cliente->>'recebimento'='entrega' and (coalesce(p_cliente->>'cep','') !~ '^[0-9]{8}$' or length(trim(coalesce(p_cliente->>'endereco','')))<10 or length(p_cliente->>'endereco')>500) then raise exception 'Confira CEP e endereço completo.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existente from public.pedidos_checkout where id=p_id;
 if found then
  if existente.acesso_hash<>p_acesso_hash or existente.cliente<>p_cliente or existente.solicitacao<>p_itens or existente.admin_id<>p_admin or existente.vendedor_id<>p_vendedor or existente.total<>p_total then raise exception 'Pedido já enviado com outros dados.'; end if;
  return to_jsonb(existente);
 end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens) then raise exception 'Há variações repetidas no pedido.'; end if;
 for item in select x from jsonb_array_elements(p_itens) x order by x->>'id' loop
  if coalesce(item->>'quantidade','') !~ '^[1-9][0-9]{0,2}$' or coalesce(item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Item ou quantidade inválida.'; end if;
  qtd:=(item->>'quantidade')::integer;
  select v.id,v.tamanho,v.cor,v.estoque,v.reservado,p.id produto_id,p.nome,p.preco into registro
  from public.produto_variacoes v join public.produtos p on p.id=v.produto_id
  where v.id=(item->>'id')::uuid and p.ativo for share of v,p;
  if not found then raise exception 'Uma peça não está mais disponível. Atualize o carrinho.'; end if;
  if registro.estoque-registro.reservado<qtd then raise exception 'Quantidade indisponível para %. Atualize o carrinho.',registro.nome; end if;
  soma:=soma+registro.preco*qtd;
  lista:=lista||jsonb_build_array(jsonb_build_object('variacao_id',registro.id,'produto_id',registro.produto_id,'nome',registro.nome,'tamanho',registro.tamanho,'cor',registro.cor,'quantidade',qtd,'preco',registro.preco));
 end loop;
 if p_total is null or p_total<>soma then raise exception 'O preço foi atualizado. Atualize o carrinho antes de enviar.'; end if;
 if soma<=0 then raise exception 'O subtotal deve ser maior que zero.'; end if;
 insert into public.pedidos_checkout(id,cliente,solicitacao,itens,total,admin_id,vendedor_id,acesso_hash) values(p_id,p_cliente,p_itens,lista,soma,p_admin,p_vendedor,p_acesso_hash) returning * into existente;
 return to_jsonb(existente);
end;
$$;

revoke all on function public.criar_pedido_checkout(uuid,jsonb,jsonb,numeric,uuid,text,text) from public,anon,authenticated;
grant execute on function public.criar_pedido_checkout(uuid,jsonb,jsonb,numeric,uuid,text,text) to service_role;
-- Uma criação externa por pedido: um timeout não pode gerar checkouts duplicados.
create or replace function public.iniciar_checkout(p_id uuid,p_admin uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pedido public.pedidos_checkout%rowtype;
begin
 select * into pedido from public.pedidos_checkout where id=p_id and admin_id=p_admin for update;
 if not found then raise exception 'Teste não encontrado.'; end if;
 if pedido.checkout_url is not null then return to_jsonb(pedido)||jsonb_build_object('criar',false); end if;
 if pedido.criacao_iniciada then raise exception 'A tentativa anterior ainda não tem confirmação. Aguarde e consulte o teste. Para reiniciar, use um novo pedido da loja.'; end if;
 update public.pedidos_checkout set criacao_iniciada=true where id=p_id;
 return to_jsonb(pedido)||jsonb_build_object('criar',true);
end;
$$;
revoke all on function public.iniciar_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.iniciar_checkout(uuid,uuid) to service_role;
create table if not exists public.reservas_checkout (
    pedido_id uuid not null
        references public.pedidos_checkout(id),

    variacao_id uuid not null
        references public.produto_variacoes(id),

    quantidade integer not null
        check (quantidade > 0),

    estado text not null default 'reservada'
        check (
            estado in (
                'reservada',
                'consumida',
                'liberada',
                'expirada'
            )
        ),

    criado_em timestamptz not null default now(),
    expira_em timestamptz not null,
    atualizado_em timestamptz not null default now(),

    primary key (pedido_id, variacao_id)
);


create or replace function public.reservar_estoque_checkout(
    p_pedido uuid,
    p_admin uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_pedido public.pedidos_checkout%rowtype;
    v_item jsonb;
    v_variacao uuid;
    v_quantidade integer;
    v_expira timestamptz;
    v_total integer;
    v_distintos integer;
begin
    -- Bloqueia o pedido durante a operação.
    select *
    into v_pedido
    from public.pedidos_checkout
    where id = p_pedido
      and admin_id = p_admin
    for update;

    if not found then
        raise exception 'Pedido da loja não encontrado.';
    end if;

    if not exists (
        select 1
        from public.administradores
        where usuario_id = p_admin
    ) then
        raise exception 'Administrador não autorizado.';
    end if;

    if v_pedido.status not in (
        'aguardando_checkout',
        'aguardando_pagamento'
    ) then
        raise exception 'Este pedido não permite nova reserva.';
    end if;

    -- Uma segunda chamada não reserva novamente.
    if exists (
        select 1
        from public.reservas_checkout
        where pedido_id = p_pedido
    ) then
        if exists (
            select 1
            from public.reservas_checkout
            where pedido_id = p_pedido
              and (
                  estado <> 'reservada'
                  or expira_em <= now()
              )
        ) then
            raise exception
                'Reserva encerrada ou vencida. Não foi renovada.';
        end if;

        return jsonb_build_object(
            'pedido_id', p_pedido,
            'estado', 'reservada',
            'reutilizada', true
        );
    end if;

    -- A reserva deve acontecer antes de abrir o checkout.
    if v_pedido.criacao_iniciada
       or v_pedido.preferencia_id is not null then
        raise exception
            'Use um pedido novo, antes de abrir o pagamento.';
    end if;

    if jsonb_typeof(v_pedido.itens) is distinct from 'array' then
        raise exception 'Itens do pedido inválidos.';
    end if;

    v_total := jsonb_array_length(v_pedido.itens);

    if v_total < 1 or v_total > 50 then
        raise exception 'Quantidade de itens inválida.';
    end if;

    select count(distinct item->>'variacao_id')
    into v_distintos
    from jsonb_array_elements(v_pedido.itens) as t(item);

    if v_distintos <> v_total then
        raise exception 'Existem variações repetidas ou inválidas.';
    end if;

    v_expira := now() + interval '30 minutes';

    -- Ordem fixa para reduzir conflitos entre pedidos.
    for v_item in
        select item
        from jsonb_array_elements(v_pedido.itens) as t(item)
        order by item->>'variacao_id'
    loop
        if coalesce(v_item->>'quantidade', '')
           !~ '^[1-9][0-9]{0,2}$' then
            raise exception 'Quantidade da peça inválida.';
        end if;

        v_variacao := (v_item->>'variacao_id')::uuid;
        v_quantidade := (v_item->>'quantidade')::integer;

        update public.estoque_checkout
        set reservado = reservado + v_quantidade,
            atualizado_em = now()
        where variacao_id = v_variacao
          and estoque - reservado >= v_quantidade;

        if not found then
            raise exception
                'Estoque da loja insuficiente para uma das peças.';
        end if;

        insert into public.reservas_checkout (
            pedido_id,
            variacao_id,
            quantidade,
            expira_em
        )
        values (
            p_pedido,
            v_variacao,
            v_quantidade,
            v_expira
        );
    end loop;
    update public.pedidos_checkout set checkout_expira_em=v_expira where id=p_pedido;

    return jsonb_build_object(
        'pedido_id', p_pedido,
        'estado', 'reservada',
        'reutilizada', false,
        'expira_em', v_expira
    );
end;
$$;

revoke all on function
    public.reservar_estoque_checkout(uuid, uuid)
from public, anon, authenticated;

grant execute on function
    public.reservar_estoque_checkout(uuid, uuid)
to service_role;
create or replace function public.consumir_reserva_checkout(
    p_pedido uuid,
    p_admin uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_pedido public.pedidos_checkout%rowtype;
    v_reserva record;
    v_baixadas integer := 0;
begin
    select *
    into v_pedido
    from public.pedidos_checkout
    where id = p_pedido
      and admin_id = p_admin
    for update;

    if not found then
        raise exception 'Pedido da loja não encontrado.';
    end if;

    if not exists (
        select 1
        from public.administradores
        where usuario_id = p_admin
    ) then
        raise exception 'Administrador não autorizado.';
    end if;

    if v_pedido.status <> 'approved'
       or v_pedido.pagamento_id is null then
        raise exception
            'O pagamento precisa ser confirmado pelo servidor.';
    end if;

    if not exists (
        select 1
        from public.reservas_checkout
        where pedido_id = p_pedido
    ) then
        raise exception
            'Pedido sem reserva. Nenhuma baixa foi realizada.';
    end if;

    -- Confere se a reserva corresponde aos itens do pedido.
    if exists (
        select 1
        from (
            select
                (item->>'variacao_id')::uuid as variacao_id,
                sum((item->>'quantidade')::integer) as quantidade
            from jsonb_array_elements(v_pedido.itens) as t(item)
            group by (item->>'variacao_id')::uuid
        ) as itens
        full join (
            select variacao_id, quantidade
            from public.reservas_checkout
            where pedido_id = p_pedido
        ) as reservas
        on reservas.variacao_id = itens.variacao_id
        where itens.variacao_id is null
           or reservas.variacao_id is null
           or itens.quantidade <> reservas.quantidade
    ) then
        raise exception
            'A reserva não corresponde aos itens do pedido.';
    end if;

    -- Reconsultar o pagamento não baixa novamente.
    if not exists (
        select 1
        from public.reservas_checkout
        where pedido_id = p_pedido
          and estado <> 'consumida'
    ) then
        return jsonb_build_object(
            'pedido_id', p_pedido,
            'estado', 'consumida',
            'reutilizada', true,
            'pecas_baixadas', 0
        );
    end if;

    if exists (
        select 1
        from public.reservas_checkout
        where pedido_id = p_pedido
          and estado <> 'reservada'
    ) then
        raise exception
            'Reserva encerrada ou inconsistente. Exige conciliação.';
    end if;

    for v_reserva in
        select variacao_id, quantidade
        from public.reservas_checkout
        where pedido_id = p_pedido
        order by variacao_id
        for update
    loop
        update public.estoque_checkout
        set estoque = estoque - v_reserva.quantidade,
            reservado = reservado - v_reserva.quantidade,
            atualizado_em = now()
        where variacao_id = v_reserva.variacao_id
          and estoque >= v_reserva.quantidade
          and reservado >= v_reserva.quantidade;

        if not found then
            raise exception
                'Estoque da loja inconsistente. Operação desfeita.';
        end if;

        update public.reservas_checkout
        set estado = 'consumida',
            atualizado_em = now()
        where pedido_id = p_pedido
          and variacao_id = v_reserva.variacao_id;

        v_baixadas := v_baixadas + v_reserva.quantidade;
    end loop;

    return jsonb_build_object(
        'pedido_id', p_pedido,
        'estado', 'consumida',
        'reutilizada', false,
        'pecas_baixadas', v_baixadas
    );
end;
$$;

revoke all on function
    public.consumir_reserva_checkout(uuid, uuid)
from public, anon, authenticated;

grant execute on function
    public.consumir_reserva_checkout(uuid, uuid)
to service_role;
alter table public.pedidos_checkout
    add column if not exists checkout_expira_em timestamptz,
    add column if not exists encerramento_verificado_em timestamptz;

comment on column public.pedidos_checkout.checkout_expira_em is
    'Prazo da preferência consultado pela API no Mercado Pago.';

comment on column public.pedidos_checkout.encerramento_verificado_em is
    'Verificação pela API de preferência vencida e ausência de pagamentos que impeçam liberar a reserva.';
create or replace function public.liberar_reserva_checkout(
    p_pedido uuid,
    p_admin uuid,
    p_motivo text default 'cancelamento'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_pedido public.pedidos_checkout%rowtype;
    v_reserva record;
    v_estado text;
    v_liberadas integer := 0;
begin
    if p_motivo is null
       or p_motivo not in ('cancelamento', 'expiracao') then
        raise exception 'Motivo de liberação inválido.';
    end if;

    -- Usa o mesmo bloqueio da função de reserva.
    select *
    into v_pedido
    from public.pedidos_checkout
    where id = p_pedido
      and admin_id = p_admin
    for update;

    if not found then
        raise exception 'Pedido da loja não encontrado.';
    end if;

    if not exists (
        select 1
        from public.administradores
        where usuario_id = p_admin
    ) then
        raise exception 'Administrador não autorizado.';
    end if;

    -- Repetir a chamada não devolve peças novamente.
    if not exists (
        select 1
        from public.reservas_checkout
        where pedido_id = p_pedido
          and estado = 'reservada'
    ) then
        return jsonb_build_object(
            'pedido_id', p_pedido,
            'reservas_liberadas', 0,
            'mensagem', 'Nenhuma reserva ativa.'
        );
    end if;

    if v_pedido.status in (
        'approved', 'authorized', 'in_mediation'
    ) then
        raise exception
            'Pagamento exige conciliação antes da liberação.';
    end if;

        -- Checkout vencido e sem pagamento exige uma
    -- verificação recente registrada pela API.
    if v_pedido.criacao_iniciada
       or v_pedido.preferencia_id is not null then

        if p_motivo = 'expiracao'
           and v_pedido.status = 'aguardando_pagamento'
           and v_pedido.pagamento_id is null then

            if v_pedido.preferencia_id is null
               or v_pedido.checkout_expira_em is null
               or v_pedido.encerramento_verificado_em is null then
                raise exception
                    'Falta verificar o encerramento pela API.';
            end if;

            if v_pedido.checkout_expira_em > now()
               or v_pedido.encerramento_verificado_em
                    < v_pedido.checkout_expira_em
               or v_pedido.encerramento_verificado_em > now()
               or v_pedido.encerramento_verificado_em
                    < now() - interval '5 minutes' then
                raise exception
                    'A verificação do encerramento não é válida ou está desatualizada.';
            end if;

        elsif v_pedido.status not in (
            'cancelled', 'refunded', 'charged_back'
        ) then
            raise exception
                'Confirme o encerramento no Mercado Pago antes de liberar.';
        end if;
    end if;

    if p_motivo = 'expiracao' then
        if exists (
            select 1
            from public.reservas_checkout
            where pedido_id = p_pedido
              and estado = 'reservada'
              and expira_em > now()
        ) then
            raise exception 'A reserva ainda não venceu.';
        end if;

        v_estado := 'expirada';
    else
        v_estado := 'liberada';
    end if;

    for v_reserva in
        select variacao_id, quantidade
        from public.reservas_checkout
        where pedido_id = p_pedido
          and estado = 'reservada'
        order by variacao_id
        for update
    loop
        update public.estoque_checkout
        set reservado = reservado - v_reserva.quantidade,
            atualizado_em = now()
        where variacao_id = v_reserva.variacao_id
          and reservado >= v_reserva.quantidade;

        if not found then
            raise exception
                'Saldo reservado inconsistente. Operação desfeita.';
        end if;

        update public.reservas_checkout
        set estado = v_estado,
            atualizado_em = now()
        where pedido_id = p_pedido
          and variacao_id = v_reserva.variacao_id
          and estado = 'reservada';

        v_liberadas := v_liberadas + 1;
    end loop;

    return jsonb_build_object(
        'pedido_id', p_pedido,
        'estado', v_estado,
        'reservas_liberadas', v_liberadas
    );
end;
$$;

revoke all on function
    public.liberar_reserva_checkout(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
    public.liberar_reserva_checkout(uuid, uuid, text)
to service_role;
create table public.vendas_checkout (
    pedido_id uuid primary key
        references public.pedidos_checkout(id),

    pagamento_id text not null unique,
    admin_id uuid not null references auth.users(id),

    registrado_em timestamptz not null default now(),

    total numeric(12,2) not null check (total > 0),
    itens jsonb not null check (jsonb_typeof(itens) = 'array'),

    origem text not null default 'mercado_pago_loja'
        check (origem = 'mercado_pago_loja')
);

alter table public.vendas_checkout
    enable row level security;

revoke all on public.vendas_checkout
from public, anon, authenticated;

grant select on public.vendas_checkout
to authenticated;

grant select, insert on public.vendas_checkout
to service_role;

create policy "Administrador consulta suas vendas da loja"
on public.vendas_checkout
for select
to authenticated
using (
    admin_id = (select auth.uid())
    and exists (
        select 1
        from public.administradores
        where usuario_id = (select auth.uid())
    )
);
create or replace function public.confirmar_pagamento_checkout(
    p_pedido uuid,
    p_admin uuid,
    p_vendedor text,
    p_pagamento text,
    p_total numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_pedido public.pedidos_checkout%rowtype;
    v_reserva jsonb;
    v_venda public.vendas_checkout%rowtype;
begin
    select *
    into v_pedido
    from public.pedidos_checkout
    where id = p_pedido
      and admin_id = p_admin
    for update;

    if not found then
        raise exception 'Pedido da loja não encontrado.';
    end if;

    if not exists (
        select 1
        from public.administradores
        where usuario_id = p_admin
    ) then
        raise exception 'Administrador não autorizado.';
    end if;

    if p_vendedor is null
       or p_vendedor <> v_pedido.vendedor_id
       or p_pagamento is null
       or p_pagamento !~ '^[0-9]{1,30}$'
       or p_total is null
       or p_total <> v_pedido.total
       or v_pedido.preferencia_id is null then
        raise exception 'Pagamento não corresponde ao pedido.';
    end if;

    if v_pedido.pagamento_id is not null
       and v_pedido.pagamento_id <> p_pagamento then
        raise exception
            'Pedido associado a outro pagamento. Exige conciliação.';
    end if;

    if v_pedido.status in (
        'cancelled', 'refunded', 'charged_back'
    ) then
        raise exception 'Pedido encerrado. Exige conciliação.';
    end if;

    update public.pedidos_checkout
    set status = 'approved',
        pagamento_id = p_pagamento,
        consultado_em = now(),
        encerramento_verificado_em = null
    where id = p_pedido;

    v_reserva := public.consumir_reserva_checkout(
        p_pedido,
        p_admin
    );

    insert into public.vendas_checkout (
        pedido_id,
        pagamento_id,
        admin_id,
        total,
        itens
    )
    values (
        p_pedido,
        p_pagamento,
        p_admin,
        v_pedido.total,
        v_pedido.itens
    )
    on conflict (pedido_id) do nothing;

    select *
    into v_venda
    from public.vendas_checkout
    where pedido_id = p_pedido;

    if not found then
        raise exception 'Venda da loja não registrada.';
    end if;

    if v_venda.pagamento_id <> p_pagamento
       or v_venda.admin_id <> p_admin
       or v_venda.total <> v_pedido.total
       or v_venda.itens <> v_pedido.itens then
        raise exception 'Venda da loja inconsistente.';
    end if;

    return jsonb_build_object(
        'id', p_pedido,
        'status', 'approved',
        'pagamento_id', p_pagamento,
        'reserva', v_reserva,
        'venda_registrada', true
    );
end;
$$;

revoke all on function public.confirmar_pagamento_checkout(
    uuid, uuid, text, text, numeric
) from public, anon, authenticated;

grant execute on function public.confirmar_pagamento_checkout(
    uuid, uuid, text, text, numeric
) to service_role;
alter table public.pedidos_checkout
    add column if not exists conciliacao text,
    add column if not exists aprovacao_tardia boolean not null default false,
    add column if not exists encaminhado_estorno boolean not null default false,
    add column if not exists valor_estornado numeric(12,2) not null default 0 check (valor_estornado >= 0 and valor_estornado <= total),
    add column if not exists taxa_mp numeric(12,2) check (taxa_mp >= 0),
    add column if not exists valor_liquido numeric(12,2),
    add column if not exists pagamento_atualizado_em timestamptz;

create table public.eventos_checkout (
    pedido_id uuid not null references public.pedidos_checkout(id),
    chave text not null,
    pagamento_id text not null,
    status text not null,
    valor_estornado numeric(12,2) not null,
    taxa_mp numeric(12,2),
    valor_liquido numeric(12,2),
    atualizado_gateway_em timestamptz not null,
    registrado_em timestamptz not null default now(),
    primary key (pedido_id, chave)
);
alter table public.eventos_checkout enable row level security;
revoke all on public.eventos_checkout from public, anon, authenticated;
grant select, insert on public.eventos_checkout to service_role;
grant select on public.eventos_checkout to authenticated;
create policy "Admin consulta eventos dos seus testes" on public.eventos_checkout
for select to authenticated using (exists (
    select 1 from public.pedidos_checkout p
    join public.administradores a on a.usuario_id=p.admin_id
    where p.id=pedido_id and p.admin_id=(select auth.uid())
));

-- Somente o servidor passa um snapshot consultado e validado no Mercado Pago.
-- Todas as decisões usam o bloqueio do pedido e os saldos simulados.
create or replace function public.conciliar_pagamento_checkout(
    p_pedido uuid, p_admin uuid, p_vendedor text, p_pagamento jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    v_pedido public.pedidos_checkout%rowtype;
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
    select * into v_pedido from public.pedidos_checkout
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
        select 1 from public.eventos_checkout where pedido_id=p_pedido
        and atualizado_gateway_em=v_data and chave<>v_chave
    ) then
        raise exception 'Snapshots conflitantes para a mesma atualização. Consulte novamente.';
    end if;

    v_tardia := v_pedido.aprovacao_tardia;
    update public.pedidos_checkout set status=v_status, pagamento_id=v_id,
        consultado_em=now(), encerramento_verificado_em=null
    where id=p_pedido;

    if v_status='approved' then
        -- Confere toda a grade antes de reservar ou consumir qualquer peça.
        if not exists (select 1 from public.reservas_checkout where pedido_id=p_pedido)
           or exists (
            select 1 from (
                select (i->>'variacao_id')::uuid variacao_id, sum((i->>'quantidade')::integer) quantidade
                from jsonb_array_elements(v_pedido.itens) i group by (i->>'variacao_id')::uuid
            ) i full join (
                select variacao_id,quantidade from public.reservas_checkout where pedido_id=p_pedido
            ) r using(variacao_id)
            where i.variacao_id is null or r.variacao_id is null or i.quantidade<>r.quantidade
        ) then raise exception 'Reserva não corresponde aos itens do pedido.'; end if;

        select bool_and(estado='expirada') into v_expirada
        from public.reservas_checkout where pedido_id=p_pedido;
        v_tardia := v_tardia or v_expirada or exists (
            select 1 from public.reservas_checkout
            where pedido_id=p_pedido and expira_em<v_aprovado
        );
        if v_pedido.encaminhado_estorno or v_pedido.conciliacao='estorno_necessario' then
            v_conciliacao := 'estorno_necessario';
        elsif v_expirada and v_estornado=0 then
            -- Ordem fixa evita deadlocks entre carrinhos com as mesmas peças.
            perform 1 from public.estoque_checkout e
            join public.reservas_checkout r using(variacao_id)
            where r.pedido_id=p_pedido order by e.variacao_id for update of e;
            select exists (
                select 1 from public.reservas_checkout r
                left join public.estoque_checkout e using(variacao_id)
                where r.pedido_id=p_pedido and (e.variacao_id is null or e.estoque-e.reservado<r.quantidade)
            ) into v_sem_estoque;
            if v_sem_estoque then
                v_conciliacao := 'estorno_necessario';
            else
                for v_item in select * from public.reservas_checkout
                    where pedido_id=p_pedido order by variacao_id for update
                loop
                    update public.estoque_checkout set reservado=reservado+v_item.quantidade,
                        atualizado_em=now() where variacao_id=v_item.variacao_id;
                end loop;
                update public.reservas_checkout set estado='reservada',atualizado_em=now()
                where pedido_id=p_pedido;
            end if;
        elsif v_estornado>0 and exists (
            select 1 from public.reservas_checkout where pedido_id=p_pedido and estado<>'consumida'
        ) then
            v_conciliacao := 'estorno_necessario';
        end if;
        if v_conciliacao is null then
            v_confirmacao := public.confirmar_pagamento_checkout(p_pedido,p_admin,p_vendedor,v_id,v_total);
            if not coalesce((v_confirmacao->>'venda_registrada')::boolean,false) then
                raise exception 'Venda simulada não registrada.';
            end if;
            if v_estornado>0 then v_conciliacao := 'estorno_parcial'; end if;
        end if;
    elsif v_status in ('cancelled','refunded','charged_back') then
        perform public.liberar_reserva_checkout(p_pedido,p_admin,'cancelamento');
        v_conciliacao := case v_status when 'refunded' then 'reversao_pagamento'
            when 'charged_back' then 'contestacao' else null end;
    elsif v_status='in_mediation' then
        v_conciliacao := 'contestacao_em_analise';
    end if;

    update public.pedidos_checkout set conciliacao=v_conciliacao,aprovacao_tardia=v_tardia,
        encaminhado_estorno=encaminhado_estorno or v_conciliacao is not distinct from 'estorno_necessario',
        valor_estornado=v_estornado,taxa_mp=v_taxa,valor_liquido=v_liquido,pagamento_atualizado_em=v_data
    where id=p_pedido;
    insert into public.eventos_checkout(pedido_id,chave,pagamento_id,status,valor_estornado,taxa_mp,valor_liquido,atualizado_gateway_em)
    values(p_pedido,v_chave,v_id,v_status,v_estornado,v_taxa,v_liquido,v_data)
    on conflict (pedido_id,chave) do nothing;
    select exists(select 1 from public.vendas_checkout where pedido_id=p_pedido) into v_venda;
    return jsonb_build_object('id',p_pedido,'status',v_status,'pagamento_id',v_id,
        'conciliacao',v_conciliacao,'aprovacao_tardia',v_tardia,'venda_registrada',v_venda,
        'valor_estornado',v_estornado,'taxa_mp',v_taxa,'valor_liquido',v_liquido,
        'pagamento_atualizado_em',v_data);
end;
$$;
revoke all on function public.conciliar_pagamento_checkout(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.conciliar_pagamento_checkout(uuid,uuid,text,jsonb) to service_role;
create table public.estornos_checkout (
    tentativa uuid primary key,
    pedido_id uuid not null references public.pedidos_checkout(id),
    admin_id uuid not null references auth.users(id),
    pagamento_id text not null,
    valor numeric(12,2) not null check (valor>0),
    estornado_antes numeric(12,2) not null check (estornado_antes>=0),
    estado text not null default 'iniciado' check (estado in ('iniciado','confirmado')),
    estorno_id text unique,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);
create unique index estorno_loja_incerto_por_pedido on public.estornos_checkout(pedido_id)
where estado='iniciado';
alter table public.estornos_checkout enable row level security;
revoke all on public.estornos_checkout from public,anon,authenticated;
grant select,insert,update on public.estornos_checkout to service_role;

create or replace function public.iniciar_estorno_checkout(p_pedido uuid,p_admin uuid,p_tentativa uuid,p_valor numeric)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
    v_pedido public.pedidos_checkout%rowtype;
    v_tentativa public.estornos_checkout%rowtype;
begin
    select * into v_pedido from public.pedidos_checkout
    where id=p_pedido and admin_id=p_admin for update;
    if not found or not exists(select 1 from public.administradores where usuario_id=p_admin) then
        raise exception 'Pedido ou administrador não autorizado.';
    end if;
    if p_tentativa is null or p_valor is null or p_valor<=0 or p_valor<>round(p_valor,2)
       or not (p_valor between 0.01 and v_pedido.total) then
        raise exception 'Valor ou tentativa de estorno inválidos.';
    end if;
    select * into v_tentativa from public.estornos_checkout where tentativa=p_tentativa;
    if found then
        if v_tentativa.pedido_id<>p_pedido or v_tentativa.admin_id<>p_admin
           or v_tentativa.pagamento_id<>v_pedido.pagamento_id or v_tentativa.valor<>p_valor then
            raise exception 'Tentativa já utilizada com outros dados.';
        end if;
        return to_jsonb(v_tentativa);
    end if;
    if v_pedido.status<>'approved' or v_pedido.pagamento_id is null
       or p_valor>v_pedido.total-v_pedido.valor_estornado then
        raise exception 'Pagamento não permite esse estorno. Consulte os valores atualizados.';
    end if;
    if exists(select 1 from public.estornos_checkout where pedido_id=p_pedido and estado='iniciado') then
        raise exception 'Existe um estorno sem confirmação. Retome a mesma tentativa no resultado.';
    end if;
    -- Mesmo aprovado pelo gateway, o snapshot do pagamento pode demorar a atualizar.
    if exists(select 1 from public.estornos_checkout where pedido_id=p_pedido
        and estado='confirmado' and estornado_antes+valor>v_pedido.valor_estornado) then
        raise exception 'Aguarde a atualização do estorno anterior antes de solicitar outro.';
    end if;
    insert into public.estornos_checkout(tentativa,pedido_id,admin_id,pagamento_id,valor,estornado_antes)
    values(p_tentativa,p_pedido,p_admin,v_pedido.pagamento_id,p_valor,v_pedido.valor_estornado)
    returning * into v_tentativa;
    return to_jsonb(v_tentativa);
end;
$$;

create or replace function public.concluir_estorno_checkout(p_tentativa uuid,p_admin uuid,p_reembolso jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
    v_tentativa public.estornos_checkout%rowtype;
begin
    select * into v_tentativa from public.estornos_checkout
    where tentativa=p_tentativa and admin_id=p_admin for update;
    if not found or not exists(select 1 from public.administradores where usuario_id=p_admin) then
        raise exception 'Tentativa não autorizada.';
    end if;
    if coalesce(p_reembolso->>'status','')<>'approved'
       or coalesce(p_reembolso->>'id','') !~ '^[0-9]{1,30}$'
       or coalesce(p_reembolso->>'payment_id','')<>v_tentativa.pagamento_id
       or (p_reembolso->>'amount')::numeric is distinct from v_tentativa.valor then
        raise exception 'O retorno do estorno não corresponde à tentativa.';
    end if;
    if v_tentativa.estorno_id is not null and v_tentativa.estorno_id<>p_reembolso->>'id' then
        raise exception 'Tentativa associada a outro estorno.';
    end if;
    update public.estornos_checkout set estado='confirmado',estorno_id=p_reembolso->>'id',atualizado_em=now()
    where tentativa=p_tentativa returning * into v_tentativa;
    return to_jsonb(v_tentativa);
end;
$$;
revoke all on function public.iniciar_estorno_checkout(uuid,uuid,uuid,numeric) from public,anon,authenticated;
revoke all on function public.concluir_estorno_checkout(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.iniciar_estorno_checkout(uuid,uuid,uuid,numeric) to service_role;
grant execute on function public.concluir_estorno_checkout(uuid,uuid,jsonb) to service_role;
alter table public.reservas_checkout enable row level security;
revoke all on public.reservas_checkout from public,anon,authenticated;
grant select,insert,update on public.reservas_checkout to service_role;
grant select,insert,update on public.vendas,public.clientes,public.transacoes to service_role;
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

commit;
