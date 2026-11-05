begin;

create or replace function public.confirmar_pagamento_teste(
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
    v_pedido public.pedidos_mp_teste%rowtype;
    v_reserva jsonb;
begin
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
        raise exception 'Pedido associado a outro pagamento. Exige conciliação.';
    end if;

    if v_pedido.status in (
        'cancelled', 'refunded', 'charged_back'
    ) then
        raise exception 'Pedido encerrado. Exige conciliação.';
    end if;

    update public.pedidos_mp_teste
    set status = 'approved',
        pagamento_id = p_pagamento,
        consultado_em = now(),
        encerramento_verificado_em = null
    where id = p_pedido;

    -- Qualquer falha aqui desfaz também a atualização acima.
    v_reserva := public.confirmar_venda_teste(
        p_pedido,
        p_admin
    );

    return jsonb_build_object(
        'id', p_pedido,
        'status', 'approved',
        'pagamento_id', p_pagamento,
        'reserva', v_reserva
    );
end;
$$;

revoke all on function public.confirmar_pagamento_teste(
    uuid, uuid, text, text, numeric
) from public, anon, authenticated;

grant execute on function public.confirmar_pagamento_teste(
    uuid, uuid, text, text, numeric
) to service_role;

commit;