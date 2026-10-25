-- Execute somente este arquivo, depois da integração 02 já instalada.
-- Pedidos são solicitações de contato. Sem cobrança, reserva ou baixa no estoque.
begin;
create table if not exists public.pedidos_site (
 id uuid primary key, criado_em timestamptz not null default now(),
 status text not null default 'pendente_contato' check(status in ('pendente_contato','cancelado')),
 cliente jsonb not null, solicitacao jsonb not null, itens jsonb not null,
 total numeric(12,2) not null check(total>=0)
);
alter table public.pedidos_site enable row level security;
revoke all on public.pedidos_site from public,anon,authenticated;
grant select on public.pedidos_site to authenticated;
drop policy if exists "Administrador consulta pedidos do site" on public.pedidos_site;
create policy "Administrador consulta pedidos do site" on public.pedidos_site for select to authenticated
using(exists(select 1 from public.administradores where usuario_id=(select auth.uid())));
create or replace function public.criar_pedido_site(p_id uuid,p_cliente jsonb,p_itens jsonb,p_total numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 existente public.pedidos_site%rowtype; item jsonb; registro record;
 qtd integer; soma numeric(12,2):=0; lista jsonb:='[]';
begin
 if p_id is null or p_cliente is null or jsonb_typeof(p_cliente)<>'object' or octet_length(p_cliente::text)>8000
 or p_itens is null or jsonb_typeof(p_itens)<>'array' then raise exception 'Dados do pedido inválidos.'; end if;
 if jsonb_array_length(p_itens)<1 or jsonb_array_length(p_itens)>50 then raise exception 'Escolha entre 1 e 50 variações.'; end if;
 if length(trim(coalesce(p_cliente->>'nome','')))<3 or length(p_cliente->>'nome')>120
 or coalesce(p_cliente->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_cliente->>'email')>160
 or coalesce(p_cliente->>'telefone','') !~ '^[0-9]{10,11}$'
 or coalesce(p_cliente->>'recebimento','') not in ('retirada','entrega') or length(coalesce(p_cliente->>'observacoes',''))>500 then raise exception 'Confira nome, e-mail, telefone e recebimento.'; end if;
 if p_cliente->>'recebimento'='entrega' and (coalesce(p_cliente->>'cep','') !~ '^[0-9]{8}$' or length(trim(coalesce(p_cliente->>'endereco','')))<10 or length(p_cliente->>'endereco')>500) then raise exception 'Confira CEP e endereço completo.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existente from public.pedidos_site where id=p_id;
 if found then
  if existente.cliente<>p_cliente or existente.solicitacao<>p_itens then raise exception 'Pedido já enviado com outros dados.'; end if;
  return jsonb_build_object('id',existente.id,'total',existente.total);
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
 insert into public.pedidos_site(id,cliente,solicitacao,itens,total) values(p_id,p_cliente,p_itens,lista,soma);
 return jsonb_build_object('id',p_id,'total',soma);
end;
$$;
revoke all on function public.criar_pedido_site(uuid,jsonb,jsonb,numeric) from public;
grant execute on function public.criar_pedido_site(uuid,jsonb,jsonb,numeric) to anon,authenticated;
commit;
