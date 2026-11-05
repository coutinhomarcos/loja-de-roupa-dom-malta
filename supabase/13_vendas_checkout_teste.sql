begin;

create table public.vendas_checkout_teste (
    pedido_id uuid primary key
        references public.pedidos_mp_teste(id),

    pagamento_id text not null unique,
    admin_id uuid not null references auth.users(id),

    registrado_em timestamptz not null default now(),

    total numeric(12,2) not null check (total > 0),
    itens jsonb not null check (jsonb_typeof(itens) = 'array'),

    origem text not null default 'mercado_pago_teste'
        check (origem = 'mercado_pago_teste')
);

alter table public.vendas_checkout_teste
    enable row level security;

revoke all on public.vendas_checkout_teste
from public, anon, authenticated;

grant select on public.vendas_checkout_teste
to authenticated;

grant select, insert on public.vendas_checkout_teste
to service_role;

create policy "Administrador consulta suas vendas de teste"
on public.vendas_checkout_teste
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

commit;