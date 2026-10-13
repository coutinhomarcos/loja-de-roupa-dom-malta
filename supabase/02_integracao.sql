-- Execute este arquivo UMA VEZ no SQL Editor, depois das etapas já concluídas.
-- Não apaga produtos, administradores ou dados existentes.
begin;

create table if not exists public.clientes (
  codigo uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  telefone text not null default '',
  email text not null default '',
  compras integer not null default 0,
  "ultimaCompra" text not null default '-',
  criado_em timestamptz not null default now()
);
create table if not exists public.transacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receita', 'despesa')),
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  categoria text not null,
  data date not null default current_date,
  origem text not null default 'manual',
  criado_em timestamptz not null default now()
);
create table if not exists public.vendas (
  id uuid primary key,
  data timestamptz not null default now(),
  cliente uuid references public.clientes(codigo) on delete set null,
  pagamento text not null,
  total numeric(12,2) not null check (total >= 0),
  itens jsonb not null,
  origem text not null default 'balcao'
);
alter table public.clientes enable row level security;
alter table public.transacoes enable row level security;
alter table public.vendas enable row level security;
revoke all on public.clientes, public.transacoes, public.vendas from anon, authenticated;
grant select, insert, update, delete on public.clientes, public.transacoes, public.vendas to authenticated;

-- Políticas sem dar acesso a clientes ou pessoas que apenas criem um login.
create policy "Administrador gerencia clientes" on public.clientes
for all to authenticated
using (exists (select 1 from public.administradores where usuario_id = (select auth.uid())))
with check (exists (select 1 from public.administradores where usuario_id = (select auth.uid())));
create policy "Administrador gerencia transacoes" on public.transacoes
for all to authenticated
using (exists (select 1 from public.administradores where usuario_id = (select auth.uid())))
with check (exists (select 1 from public.administradores where usuario_id = (select auth.uid())));
create policy "Administrador gerencia vendas" on public.vendas
for all to authenticated
using (exists (select 1 from public.administradores where usuario_id = (select auth.uid())))
with check (exists (select 1 from public.administradores where usuario_id = (select auth.uid())));

-- Somente leitura de produtos ativos para a coleção. Custos e clientes ficam privados.
grant usage on schema public to anon;
grant select on public.produtos, public.produto_variacoes to anon;
create policy "Catalogo publico" on public.produtos
for select to anon, authenticated using (ativo = true);
create policy "Variacoes publicas" on public.produto_variacoes
for select to anon, authenticated
using (exists (select 1 from public.produtos p where p.id = produto_id and p.ativo));

create unique index if not exists variacao_cor_tamanho_normalizados
on public.produto_variacoes(produto_id, lower(trim(tamanho)), lower(trim(cor)));

-- Produto + todas as variações + despesa são salvos na mesma transação.
create or replace function public.cadastrar_produto_grade(dados jsonb, grade jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  produto uuid;
  item jsonb;
  numero integer := 0;
  quantidade integer;
  total_quantidade bigint := 0;
  custo numeric;
  codigo_base text;
begin
  if not exists (select 1 from public.administradores where usuario_id = auth.uid()) then
    raise exception 'Acesso restrito ao administrador';
  end if;
  if grade is null or jsonb_typeof(grade) <> 'array' or jsonb_array_length(grade) not between 1 and 200 then
    raise exception 'A grade deve ter entre 1 e 200 variacoes';
  end if;
  codigo_base := upper(trim(dados->>'codigo'));
  if codigo_base is null or codigo_base !~ '^[A-Z0-9_-]{1,40}$'
     or coalesce(trim(dados->>'nome'), '') = ''
     or coalesce(trim(dados->>'categoria'), '') = '' then
    raise exception 'Informe codigo, nome e categoria validos';
  end if;
  custo := (dados->>'custo')::numeric;
  if custo is null or custo < 0 then raise exception 'Custo invalido'; end if;
  insert into public.produtos(codigo,nome,categoria,marca,descricao,imagem_url,preco)
  values(codigo_base,trim(dados->>'nome'),trim(dados->>'categoria'),
         dados->>'marca',dados->>'descricao',dados->>'imagem_url',(dados->>'preco')::numeric)
  returning id into produto;
  insert into public.produto_custos(produto_id,custo) values(produto,custo);
  for item in select value from jsonb_array_elements(grade) loop
    numero := numero + 1;
    if coalesce(trim(item->>'tamanho'), '') = '' or coalesce(trim(item->>'cor'), '') = ''
       or coalesce(item->>'estoque', '') !~ '^[0-9]+$' then
      raise exception 'Tamanho, cor ou quantidade invalida';
    end if;
    quantidade := (item->>'estoque')::integer;
    insert into public.produto_variacoes(produto_id,codigo,tamanho,cor,estoque)
    values(produto,codigo_base || '-' || lpad(numero::text,3,'0'),trim(item->>'tamanho'),trim(item->>'cor'),quantidade);
    total_quantidade := total_quantidade + quantidade;
  end loop;
  if custo * total_quantidade > 0 then
    insert into public.transacoes(tipo,descricao,valor,categoria,origem)
    values('despesa','Compra inicial de estoque - ' || trim(dados->>'nome'),
           custo * total_quantidade,'Fornecedores','compra-produto');
  end if;
  return produto;
end;
$$;

-- Uma edição atualiza produto, custo e variação em conjunto.
create or replace function public.editar_variacao(variacao uuid, dados jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare produto uuid;
begin
  if not exists (select 1 from public.administradores where usuario_id = auth.uid()) then
    raise exception 'Acesso restrito ao administrador';
  end if;
  select produto_id into produto from public.produto_variacoes where id = variacao for update;
  if produto is null then raise exception 'Variacao nao encontrada'; end if;
  if coalesce(trim(dados->>'nome'), '') = '' or coalesce(trim(dados->>'categoria'), '') = ''
     or coalesce(trim(dados->>'tamanho'), '') = '' or coalesce(trim(dados->>'cor'), '') = ''
     or coalesce(dados->>'estoque', '') !~ '^[0-9]+$' then
    raise exception 'Dados invalidos';
  end if;
  update public.produtos set nome=trim(dados->>'nome'), categoria=trim(dados->>'categoria'),
    preco=(dados->>'preco')::numeric where id=produto;
  update public.produto_custos set custo=(dados->>'custo')::numeric where produto_id=produto;
  update public.produto_variacoes set tamanho=trim(dados->>'tamanho'), cor=trim(dados->>'cor'),
    estoque=(dados->>'estoque')::integer where id=variacao;
end;
$$;

-- Venda de balcão: registrar apenas quando o pagamento tiver sido recebido.
-- O banco calcula os preços e impede venda acima do estoque disponível.
create or replace function public.registrar_venda_balcao(
  venda_id uuid, itens jsonb, metodo text, cliente_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  v record;
  qtd integer;
  total_venda numeric := 0;
  resumo jsonb := '[]'::jsonb;
  inserida uuid;
begin
  if not exists (select 1 from public.administradores where usuario_id = auth.uid()) then
    raise exception 'Acesso restrito ao administrador';
  end if;
  if metodo not in ('Dinheiro','Pix','Cartão de Crédito','Cartão de Débito') then
    raise exception 'Forma de pagamento invalida';
  end if;
  if itens is null or jsonb_typeof(itens) <> 'array' or jsonb_array_length(itens) not between 1 and 200 then
    raise exception 'Carrinho invalido';
  end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(itens)) <> jsonb_array_length(itens) then
    raise exception 'Agrupe as quantidades de cada variacao';
  end if;
  insert into public.vendas(id,cliente,pagamento,total,itens)
    values(venda_id,cliente_id,metodo,0,'[]'::jsonb)
    on conflict(id) do nothing returning id into inserida;
  if inserida is null then return venda_id; end if;
  -- Mesma ordem de bloqueio em vendas concorrentes.
  perform id from public.produto_variacoes
    where id in (select (value->>'id')::uuid from jsonb_array_elements(itens))
    order by id for update;
  for item in select value from jsonb_array_elements(itens) loop
    if coalesce(item->>'qtd','') !~ '^[1-9][0-9]*$' then raise exception 'Quantidade invalida'; end if;
    qtd := (item->>'qtd')::integer;
    select pv.*, p.nome, p.preco, p.ativo, pc.custo into v
    from public.produto_variacoes pv
    join public.produtos p on p.id=pv.produto_id
    join public.produto_custos pc on pc.produto_id=p.id
    where pv.id=(item->>'id')::uuid;
    if not found then raise exception 'Variacao nao encontrada'; end if;
    if not v.ativo or v.estoque-v.reservado < qtd then raise exception 'Estoque insuficiente para % / % / %', v.nome,v.tamanho,v.cor; end if;
    update public.produto_variacoes set estoque=estoque-qtd where id=v.id;
    total_venda := total_venda + v.preco*qtd;
    resumo := resumo || jsonb_build_array(jsonb_build_object(
      'id',v.id,'codigo',v.codigo,'nome',v.nome,'tamanho',v.tamanho,'cor',v.cor,
      'qtd',qtd,'preco',v.preco,'custoUnit',v.custo));
  end loop;
  update public.vendas set total=total_venda,itens=resumo where id=venda_id;
  if cliente_id is not null then
    update public.clientes set compras=compras+1,"ultimaCompra"=to_char(current_date,'DD/MM/YYYY') where codigo=cliente_id;
  end if;
  return venda_id;
end;
$$;

revoke all on function public.cadastrar_produto_grade(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.editar_variacao(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.registrar_venda_balcao(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.cadastrar_produto_grade(jsonb,jsonb) to authenticated;
grant execute on function public.editar_variacao(uuid,jsonb) to authenticated;
grant execute on function public.registrar_venda_balcao(uuid,jsonb,text,uuid) to authenticated;
commit;
