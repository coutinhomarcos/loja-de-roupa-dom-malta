'use strict';
// Gera a migration de produção a partir das regras já verificadas no sandbox.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const mapa = require('../lib/checkout-mapa');
function ler(nome) {
    const caminho = 'supabase/' + nome;
    return fs.existsSync(caminho) ? fs.readFileSync(caminho, 'utf8')
        : execFileSync('git', ['show', 'a8131969dba302c2723050526cd480f55891a1a1:' + caminho], { encoding: 'utf8' });
}
function converter(sql) {
    for (const [antes, depois] of Object.entries(mapa)) sql = sql.replaceAll(antes, depois);
    return sql.replaceAll('_teste', '_loja').replaceAll('de teste', 'da loja')
        .replace(/^begin;\s*|\s*commit;\s*$/gm, '');
}
let pedido = ler('04_mercado_pago_teste.sql');
pedido = pedido.replace('vendedor_id text not null,', () => "vendedor_id text not null, acesso_hash text not null check(acesso_hash ~ '^[a-f0-9]{64}$'),");
pedido = pedido.replace('p_vendedor text)', 'p_vendedor text,p_acesso_hash text)')
    .replaceAll('uuid,jsonb,jsonb,numeric,uuid,text)', 'uuid,jsonb,jsonb,numeric,uuid,text,text)');
pedido = pedido.replace('if p_id is null', () => "if p_acesso_hash is null or p_acesso_hash !~ '^[a-f0-9]{64}$' then raise exception 'Chave do pedido inválida.'; end if;\n if p_id is null")
    .replace('if existente.cliente<>p_cliente', 'if existente.acesso_hash<>p_acesso_hash or existente.cliente<>p_cliente')
    .replace("not in ('retirada','entrega')", "<> 'retirada'")
    .replace('total,admin_id,vendedor_id) values(p_id,p_cliente,p_itens,lista,soma,p_admin,p_vendedor)',
        'total,admin_id,vendedor_id,acesso_hash) values(p_id,p_cliente,p_itens,lista,soma,p_admin,p_vendedor,p_acesso_hash)');
let reservas = ler('05_reserva_estoque_teste.sql');
reservas = reservas.slice(reservas.indexOf('create table if not exists public.reservas_checkout_teste'), reservas.indexOf('-- Acesso somente'));
reservas = reservas.replace('references public.estoque_checkout_teste(variacao_id)', 'references public.produto_variacoes(id)');
const view = `alter table public.produto_variacoes add column if not exists atualizado_em timestamptz not null default now();
create or replace view public.estoque_checkout as select id variacao_id,estoque,reservado,atualizado_em from public.produto_variacoes;
revoke all on public.estoque_checkout from public,anon,authenticated;
grant select,update on public.estoque_checkout to service_role;`;
const permissoes = `alter table public.reservas_checkout enable row level security;
revoke all on public.reservas_checkout from public,anon,authenticated;
grant select,insert,update on public.reservas_checkout to service_role;
grant select,insert,update on public.vendas,public.clientes,public.transacoes to service_role;`;
const reservar = ler('06_funcoes_reserva_teste.sql').replace('    end loop;','    end loop;\n    update public.pedidos_mp_teste set checkout_expira_em=v_expira where id=p_pedido;');
const partes = [pedido,reservas,reservar,ler('08_confirmar_venda_teste.sql'),
    ler('09_conciliacao_expiracao_teste.sql'),ler('13_vendas_checkout_teste.sql'),ler('14_registrar_venda_checkout_teste.sql'),
    ler('15_conciliar_excecoes_teste.sql'),ler('16_estornos_idempotentes_teste.sql')];
const sql = '-- Gerado por scripts/gerar-checkout-loja.js. Não habilita pagamentos.\nbegin;\n'
    + view + '\n' + partes.map(converter).join('\n') + '\n' + permissoes
    + '\n' + fs.readFileSync('supabase/templates/checkout-loja.sql','utf8') + '\ncommit;\n';
fs.writeFileSync('supabase/18_integracao_checkout_loja.sql',sql);
let teste = converter(fs.readFileSync('tests/conciliacao-banco.sql','utf8'));
teste = teste.replaceAll('total,status,criacao_iniciada,preferencia_id)', 'total,status,criacao_iniciada,preferencia_id,acesso_hash)')
    .replaceAll("'123','{}','[]'", "'123',jsonb_build_object('nome','Cliente de verificação','email',v_pedido::text||'@invalid.local','telefone','31999999999'),'[]'")
    .replace('true,v_pedido::text);', "true,v_pedido::text,repeat('a',64));")
    .replace('true,v_sem_estoque::text);', "true,v_sem_estoque::text,repeat('b',64));");
teste = teste.replace('end $$;', () => `
    if (select count(*) from public.vendas where id=v_pedido and origem='checkout')<>1 then raise exception 'Venda não integrada ou duplicada'; end if;
    if exists(select 1 from public.vendas where id=v_sem_estoque) then raise exception 'Registrou venda sem estoque'; end if;
    if (select sum(valor) from public.transacoes where pedido_checkout=v_pedido and natureza_checkout='reversao')<>20 then raise exception 'Contestação financeira incorreta'; end if;
    if (select count(*) from public.transacoes where pedido_checkout=v_pedido and natureza_checkout='taxa')<>1 then raise exception 'Taxa duplicada'; end if;
    if (select compras from public.clientes where email=v_pedido::text||'@invalid.local')<>1 then raise exception 'Compras do cliente duplicadas'; end if;
end $$;`);
fs.writeFileSync('tests/checkout-loja-banco.sql','begin;\n'+teste+'\nrollback;\n');
console.log('Migration da loja gerada, sem executar pagamentos.');
