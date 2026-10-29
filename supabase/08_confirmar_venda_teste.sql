begin;

create or replace function public.confirmar_venda_teste(
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
    v_reserva record;
    v_baixadas integer := 0;
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

    if v_pedido.status <> 'approved'
       or v_pedido.pagamento_id is null then
        raise exception
            'O pagamento precisa ser confirmado pelo servidor.';
    end if;

    if not exists (
        select 1
        from public.reservas_checkout_teste
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
            from public.reservas_checkout_teste
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
        from public.reservas_checkout_teste
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
        from public.reservas_checkout_teste
        where pedido_id = p_pedido
          and estado <> 'reservada'
    ) then
        raise exception
            'Reserva encerrada ou inconsistente. Exige conciliação.';
    end if;

    for v_reserva in
        select variacao_id, quantidade
        from public.reservas_checkout_teste
        where pedido_id = p_pedido
        order by variacao_id
        for update
    loop
        update public.estoque_checkout_teste
        set estoque = estoque - v_reserva.quantidade,
            reservado = reservado - v_reserva.quantidade,
            atualizado_em = now()
        where variacao_id = v_reserva.variacao_id
          and estoque >= v_reserva.quantidade
          and reservado >= v_reserva.quantidade;

        if not found then
            raise exception
                'Estoque de teste inconsistente. Operação desfeita.';
        end if;

        update public.reservas_checkout_teste
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
    public.confirmar_venda_teste(uuid, uuid)
from public, anon, authenticated;

grant execute on function
    public.confirmar_venda_teste(uuid, uuid)
to service_role;

commit;