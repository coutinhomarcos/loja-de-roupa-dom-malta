begin;
create table public.configuracoes_loja(
    id integer primary key default 1 check(id=1),
    nome text not null default 'DOM MALTA' check(length(trim(nome)) between 1 and 120),
    cnpj text not null default '' check(cnpj='' or cnpj ~ '^[0-9]{14}$'),
    telefone text not null default '' check(telefone='' or telefone ~ '^[0-9]{10,13}$'),
    endereco text not null default '' check(length(endereco)<=500),
    limite_estoque integer not null default 5 check(limite_estoque between 1 and 9999),
    aviso_estoque boolean not null default true,
    atualizado_em timestamptz not null default now()
);
alter table public.configuracoes_loja enable row level security;
revoke all on public.configuracoes_loja from public,anon,authenticated;
grant select,insert,update on public.configuracoes_loja to authenticated;
create policy "Admin gerencia configuracoes da loja" on public.configuracoes_loja for all to authenticated
using(exists(select 1 from public.administradores where usuario_id=(select auth.uid())))
with check(exists(select 1 from public.administradores where usuario_id=(select auth.uid())));
insert into public.configuracoes_loja(id) values(1);
create or replace function public.dados_publicos_loja()
returns jsonb language sql stable security definer set search_path='' as $$
    select jsonb_build_object('nome',nome,'telefone',telefone,'endereco',endereco,'cnpj',cnpj)
    from public.configuracoes_loja where id=1;
$$;
revoke all on function public.dados_publicos_loja() from public,anon,authenticated;
grant execute on function public.dados_publicos_loja() to anon,authenticated;
commit;
