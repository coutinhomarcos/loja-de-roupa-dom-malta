begin;

create or replace function public.liberar_reserva_teste(
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
    v_pedido public.pedidos_mp_teste%rowtype;
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

    -- Repetir a chamada não devolve peças novamente.
    if not exists (
        select 1
        from public.reservas_checkout_teste
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

    -- Um checkout aberto pode ter recebido pagamento.
    -- Não basta o relógio vencer para liberar suas peças.
    if v_pedido.criacao_iniciada
       or v_pedido.preferencia_id is not null then
        if v_pedido.status not in (
            'cancelled', 'refunded', 'charged_back'
        ) then
            raise exception
                'Confirme o encerramento no Mercado Pago antes de liberar.';
        end if;
    end if;

    if p_motivo = 'expiracao' then
        if exists (
            select 1
            from public.reservas_checkout_teste
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
        from public.reservas_checkout_teste
        where pedido_id = p_pedido
          and estado = 'reservada'
        order by variacao_id
        for update
    loop
        update public.estoque_checkout_teste
        set reservado = reservado - v_reserva.quantidade,
            atualizado_em = now()
        where variacao_id = v_reserva.variacao_id
          and reservado >= v_reserva.quantidade;

        if not found then
            raise exception
                'Saldo reservado inconsistente. Operação desfeita.';
        end if;

        update public.reservas_checkout_teste
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
    public.liberar_reserva_teste(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
    public.liberar_reserva_teste(uuid, uuid, text)
to service_role;

commit;