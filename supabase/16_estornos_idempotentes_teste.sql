begin;
create table public.estornos_checkout_teste (
    tentativa uuid primary key,
    pedido_id uuid not null references public.pedidos_mp_teste(id),
    admin_id uuid not null references auth.users(id),
    pagamento_id text not null,
    valor numeric(12,2) not null check (valor>0),
    estornado_antes numeric(12,2) not null check (estornado_antes>=0),
    estado text not null default 'iniciado' check (estado in ('iniciado','confirmado')),
    estorno_id text unique,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);
create unique index estorno_teste_incerto_por_pedido on public.estornos_checkout_teste(pedido_id)
where estado='iniciado';
alter table public.estornos_checkout_teste enable row level security;
revoke all on public.estornos_checkout_teste from public,anon,authenticated;
grant select,insert,update on public.estornos_checkout_teste to service_role;

create or replace function public.iniciar_estorno_teste(p_pedido uuid,p_admin uuid,p_tentativa uuid,p_valor numeric)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
    v_pedido public.pedidos_mp_teste%rowtype;
    v_tentativa public.estornos_checkout_teste%rowtype;
begin
    select * into v_pedido from public.pedidos_mp_teste
    where id=p_pedido and admin_id=p_admin for update;
    if not found or not exists(select 1 from public.administradores where usuario_id=p_admin) then
        raise exception 'Pedido ou administrador não autorizado.';
    end if;
    if p_tentativa is null or p_valor is null or p_valor<=0 or p_valor<>round(p_valor,2)
       or not (p_valor between 0.01 and v_pedido.total) then
        raise exception 'Valor ou tentativa de estorno inválidos.';
    end if;
    select * into v_tentativa from public.estornos_checkout_teste where tentativa=p_tentativa;
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
    if exists(select 1 from public.estornos_checkout_teste where pedido_id=p_pedido and estado='iniciado') then
        raise exception 'Existe um estorno sem confirmação. Retome a mesma tentativa no resultado.';
    end if;
    -- Mesmo aprovado pelo gateway, o snapshot do pagamento pode demorar a atualizar.
    if exists(select 1 from public.estornos_checkout_teste where pedido_id=p_pedido
        and estado='confirmado' and estornado_antes+valor>v_pedido.valor_estornado) then
        raise exception 'Aguarde a atualização do estorno anterior antes de solicitar outro.';
    end if;
    insert into public.estornos_checkout_teste(tentativa,pedido_id,admin_id,pagamento_id,valor,estornado_antes)
    values(p_tentativa,p_pedido,p_admin,v_pedido.pagamento_id,p_valor,v_pedido.valor_estornado)
    returning * into v_tentativa;
    return to_jsonb(v_tentativa);
end;
$$;

create or replace function public.concluir_estorno_teste(p_tentativa uuid,p_admin uuid,p_reembolso jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
    v_tentativa public.estornos_checkout_teste%rowtype;
begin
    select * into v_tentativa from public.estornos_checkout_teste
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
    update public.estornos_checkout_teste set estado='confirmado',estorno_id=p_reembolso->>'id',atualizado_em=now()
    where tentativa=p_tentativa returning * into v_tentativa;
    return to_jsonb(v_tentativa);
end;
$$;
revoke all on function public.iniciar_estorno_teste(uuid,uuid,uuid,numeric) from public,anon,authenticated;
revoke all on function public.concluir_estorno_teste(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.iniciar_estorno_teste(uuid,uuid,uuid,numeric) to service_role;
grant execute on function public.concluir_estorno_teste(uuid,uuid,jsonb) to service_role;
commit;
