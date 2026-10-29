-- Etapa 04: Checkout Pro SOMENTE TESTE. Execute após 02 e 03.
-- Não altera pedidos_site, estoque, vendas nem transacoes.
begin;
create table if not exists public.pedidos_mp_teste (
 id uuid primary key, criado_em timestamptz not null default now(),
 admin_id uuid not null references auth.users(id), vendedor_id text not null,
 cliente jsonb not null, solicitacao jsonb not null, itens jsonb not null,
 total numeric(12,2) not null check(total>0),
 status text not null default 'aguardando_checkout' check(status in
 ('aguardando_checkout','aguardando_pagamento','approved','pending','in_process','rejected','cancelled','refunded','charged_back','authorized','in_mediation')),
 criacao_iniciada boolean not null default false,
 preferencia_id text unique, checkout_url text, pagamento_id text unique,
 consultado_em timestamptz
);
alter table public.pedidos_mp_teste enable row level security;
revoke all on public.pedidos_mp_teste from public,anon,authenticated;
grant select on public.pedidos_mp_teste to authenticated;
grant all on public.pedidos_mp_teste to service_role;
drop policy if exists "Admin consulta seus testes MP" on public.pedidos_mp_teste;
create policy "Admin consulta seus testes MP" on public.pedidos_mp_teste for select to authenticated
using(admin_id=(select auth.uid()) and exists(select 1 from public.administradores where usuario_id=(select auth.uid())));
create or replace function public.criar_pedido_mp_teste(p_id uuid,p_cliente jsonb,p_itens jsonb,p_total numeric,p_admin uuid,p_vendedor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 existente public.pedidos_mp_teste%rowtype; item jsonb; registro record;
 qtd integer; soma numeric(12,2):=0; lista jsonb:='[]';
begin
 if not exists(select 1 from public.administradores where usuario_id=p_admin) or coalesce(p_vendedor,'') !~ '^[0-9]{1,30}$' then raise exception 'Administrador ou vendedor inválido.'; end if;
 if p_id is null or p_cliente is null or jsonb_typeof(p_cliente)<>'object' or octet_length(p_cliente::text)>8000
 or p_itens is null or jsonb_typeof(p_itens)<>'array' then raise exception 'Dados do pedido inválidos.'; end if;
 if jsonb_array_length(p_itens)<1 or jsonb_array_length(p_itens)>50 then raise exception 'Escolha entre 1 e 50 variações.'; end if;
 if length(trim(coalesce(p_cliente->>'nome','')))<3 or length(p_cliente->>'nome')>120
 or coalesce(p_cliente->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_cliente->>'email')>160
 or coalesce(p_cliente->>'telefone','') !~ '^[0-9]{10,11}$'
 or coalesce(p_cliente->>'recebimento','') not in ('retirada','entrega') or length(coalesce(p_cliente->>'observacoes',''))>500 then raise exception 'Confira nome, e-mail, telefone e recebimento.'; end if;
 if p_cliente->>'recebimento'='entrega' and (coalesce(p_cliente->>'cep','') !~ '^[0-9]{8}$' or length(trim(coalesce(p_cliente->>'endereco','')))<10 or length(p_cliente->>'endereco')>500) then raise exception 'Confira CEP e endereço completo.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existente from public.pedidos_mp_teste where id=p_id;
 if found then
  if existente.cliente<>p_cliente or existente.solicitacao<>p_itens or existente.admin_id<>p_admin or existente.vendedor_id<>p_vendedor or existente.total<>p_total then raise exception 'Pedido já enviado com outros dados.'; end if;
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
 insert into public.pedidos_mp_teste(id,cliente,solicitacao,itens,total,admin_id,vendedor_id) values(p_id,p_cliente,p_itens,lista,soma,p_admin,p_vendedor) returning * into existente;
 return to_jsonb(existente);
end;
$$;

revoke all on function public.criar_pedido_mp_teste(uuid,jsonb,jsonb,numeric,uuid,text) from public,anon,authenticated;
grant execute on function public.criar_pedido_mp_teste(uuid,jsonb,jsonb,numeric,uuid,text) to service_role;
-- Uma criação externa por pedido: um timeout não pode gerar checkouts duplicados.
create or replace function public.iniciar_checkout_mp_teste(p_id uuid,p_admin uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pedido public.pedidos_mp_teste%rowtype;
begin
 select * into pedido from public.pedidos_mp_teste where id=p_id and admin_id=p_admin for update;
 if not found then raise exception 'Teste não encontrado.'; end if;
 if pedido.checkout_url is not null then return to_jsonb(pedido)||jsonb_build_object('criar',false); end if;
 if pedido.criacao_iniciada then raise exception 'A tentativa anterior ainda não tem confirmação. Aguarde e consulte o teste. Para reiniciar, use um novo pedido de teste.'; end if;
 update public.pedidos_mp_teste set criacao_iniciada=true where id=p_id;
 return to_jsonb(pedido)||jsonb_build_object('criar',true);
end;
$$;
revoke all on function public.iniciar_checkout_mp_teste(uuid,uuid) from public,anon,authenticated;
grant execute on function public.iniciar_checkout_mp_teste(uuid,uuid) to service_role;
commit;
