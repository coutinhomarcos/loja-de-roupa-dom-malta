begin;

-- Estoque exclusivo da simulação.
create table if not exists public.estoque_checkout_teste (
    variacao_id uuid primary key
        references public.produto_variacoes(id),

    estoque integer not null default 0
        check (estoque >= 0),

    reservado integer not null default 0
        check (reservado >= 0 and reservado <= estoque),

    atualizado_em timestamptz not null default now()
);

-- Histórico das reservas da simulação.
create table if not exists public.reservas_checkout_teste (
    pedido_id uuid not null
        references public.pedidos_mp_teste(id),

    variacao_id uuid not null
        references public.estoque_checkout_teste(variacao_id),

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

-- Acesso somente pelo servidor nesta etapa.
alter table public.estoque_checkout_teste
    enable row level security;

alter table public.reservas_checkout_teste
    enable row level security;

revoke all on table
    public.estoque_checkout_teste,
    public.reservas_checkout_teste
from public, anon, authenticated;

grant select, insert, update on table
    public.estoque_checkout_teste,
    public.reservas_checkout_teste
to service_role;

commit;