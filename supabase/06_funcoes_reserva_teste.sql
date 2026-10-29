begin;

create or replace function public.reservar_estoque_teste(
    p_pedido uuid,
    p_admin uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_pedido public.pedidos_mp_teste%rowtype;
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
    from public.pedidos_mp_teste
    where id = p_pedido
      and admin_id = p_admin
    for update;

    if not found then
        raise exception 'Pedido de teste não encontrado.';
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
        from public.reservas_checkout_teste
        where pedido_id = p_pedido
    ) then
        if exists (
            select 1
            from public.reservas_checkout_teste
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

        update public.estoque_checkout_teste
        set reservado = reservado + v_quantidade,
            atualizado_em = now()
        where variacao_id = v_variacao
          and estoque - reservado >= v_quantidade;

        if not found then
            raise exception
                'Estoque de teste insuficiente para uma das peças.';
        end if;

        insert into public.reservas_checkout_teste (
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

    return jsonb_build_object(
        'pedido_id', p_pedido,
        'estado', 'reservada',
        'reutilizada', false,
        'expira_em', v_expira
    );
end;
$$;

revoke all on function
    public.reservar_estoque_teste(uuid, uuid)
from public, anon, authenticated;

grant execute on function
    public.reservar_estoque_teste(uuid, uuid)
to service_role;

commit;