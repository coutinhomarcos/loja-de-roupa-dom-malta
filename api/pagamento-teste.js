'use strict';

// Apenas servidor Vercel. Nenhuma credencial é enviada ao navegador.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS = new Set(['approved','pending','in_process','rejected','cancelled','refunded','charged_back','authorized','in_mediation']);
class Falha extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
function configuracao() {
    const e = process.env;
    if (e.VERCEL_ENV !== 'preview' || e.MERCADO_PAGO_MODO !== 'teste') {
        throw new Falha(403, 'Pagamento de teste disponível somente no ambiente Preview.');
    }
    if (!e.MERCADO_PAGO_ACCESS_TOKEN || !e.SUPABASE_SECRET_KEY?.startsWith('sb_secret_') || !e.SUPABASE_URL) {
        throw new Falha(503, 'Confira as quatro variáveis do ambiente Preview e publique novamente.');
    }
    const banco = new URL(e.SUPABASE_URL);
    if (banco.protocol !== 'https:' || !banco.hostname.endsWith('.supabase.co') || banco.pathname !== '/') {
        throw new Falha(503, 'SUPABASE_URL deve conter somente o endereço HTTPS do projeto.');
    }
    const host = e.VERCEL_URL;
    if (!host || !/^[a-z0-9-]+\.vercel\.app$/i.test(host)) throw new Falha(503, 'Endereço da publicação indisponível.');
    return { banco: banco.origin, origem: 'https://' + host, alias: e.VERCEL_BRANCH_URL && /^[a-z0-9-]+\.vercel\.app$/i.test(e.VERCEL_BRANCH_URL) ? 'https://' + e.VERCEL_BRANCH_URL : null, chave: e.SUPABASE_SECRET_KEY, token: e.MERCADO_PAGO_ACCESS_TOKEN };
}
async function jsonExterno(url, opcoes = {}, origem = 'banco') {
    let r;
    try { r = await fetch(url, { ...opcoes, redirect: 'error', signal: AbortSignal.timeout(10000) }); }
    catch { throw new Falha(502, 'Não foi possível consultar ' + (origem === 'mp' ? 'o Mercado Pago' : 'o Supabase') + '. Tente novamente.'); }
    const data = await r.json().catch(() => null);
    if (!r.ok) {
        if (origem === 'banco' && data?.code === 'P0001') throw new Falha(409, data.message);
        if (origem === 'banco' && data?.code === 'PGRST202') throw new Falha(503, 'Execute o arquivo 04_mercado_pago_teste.sql no Supabase.');
        throw new Falha(502, (origem === 'mp' ? 'Mercado Pago' : 'Supabase') + ' recusou a consulta. Confira as credenciais e a configuração.');
    }
    if (!data) throw new Falha(502, 'Resposta externa inválida.');
    return data;
}
function banco(c, caminho, metodo = 'GET', dados) {
    // Chaves sb_secret vão em apikey, nunca em Authorization: Bearer.
    return jsonExterno(c.banco + '/rest/v1/' + caminho, {
        method: metodo,
        headers: { apikey: c.chave, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        ...(dados === undefined ? {} : { body: JSON.stringify(dados) })
    });
}
function mp(c, caminho, metodo = 'GET', dados) {
    return jsonExterno('https://api.mercadopago.com' + caminho, {
        method: metodo,
        headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
        ...(dados === undefined ? {} : { body: JSON.stringify(dados) })
    }, 'mp');
}
async function administrador(c, req) {
    const auth = req.headers.authorization || '';
    if (!/^Bearer [\w.-]+$/.test(auth) || auth.length > 10000) throw new Falha(401, 'Entre no painel de estoque desta versão de testes e volte aqui.');
    let usuario;
    try { usuario = await jsonExterno(c.banco + '/auth/v1/user', { headers: { apikey: c.chave, Authorization: auth } }); }
    catch { throw new Falha(401, 'Sua sessão expirou. Entre novamente no painel desta versão de testes.'); }
    if (!UUID.test(usuario.id)) throw new Falha(401, 'Sessão inválida.');
    const rows = await banco(c, 'administradores?select=usuario_id&usuario_id=eq.' + usuario.id);
    if (!rows.length) throw new Falha(403, 'Somente o administrador pode iniciar os testes de pagamento.');
    return usuario.id;
}
async function vendedorTeste(c) {
    const vendedor = await mp(c, '/users/me');
    if (!Array.isArray(vendedor.tags) || !vendedor.tags.includes('test_user') || !/^\d{1,30}$/.test(String(vendedor.id))) {
        throw new Falha(403, 'Credencial bloqueada: selecione as credenciais de TESTE do vendedor no Mercado Pago. Conta real não é aceita nesta etapa.');
    }
    return String(vendedor.id);
}
function checkoutValido(valor) {
    const u = new URL(valor);
    if (u.protocol !== 'https:' || !['www.mercadopago.com.br','sandbox.mercadopago.com.br'].includes(u.hostname) || u.username || u.password) {
        throw new Falha(502, 'Endereço de checkout inválido.');
    }
    return u.href;
}
async function criar(c, admin, vendedor, body) {
    if (!UUID.test(body.id) || !Array.isArray(body.itens) || body.itens.length > 50 || !Number.isFinite(body.total)) {
        throw new Falha(400, 'Dados do carrinho inválidos.');
    }
    const pedido = await banco(c, 'rpc/criar_pedido_mp_teste', 'POST', {
        p_id: body.id, p_cliente: body.cliente, p_itens: body.itens, p_total: body.total,
        p_admin: admin, p_vendedor: vendedor
    });
    if (pedido.preferencia_id && pedido.checkout_url) return { id: pedido.id, checkout_url: checkoutValido(pedido.checkout_url) };
    const inicio = await banco(c, 'rpc/iniciar_checkout_mp_teste', 'POST', { p_id: pedido.id, p_admin: admin });
    if (!inicio.criar) return { id: inicio.id, checkout_url: checkoutValido(inicio.checkout_url) };
    const retorno = c.origem + '/pages/resultado-teste.html?pedido=' + pedido.id;
    const preferencia = await mp(c, '/checkout/preferences', 'POST', {
        items: pedido.itens.map(i => ({ id: i.variacao_id, title: ('TESTE — ' + i.nome + ' — ' + i.tamanho + ' / ' + i.cor).slice(0, 250), quantity: i.quantidade, currency_id: 'BRL', unit_price: Number(i.preco) })),
        external_reference: pedido.id,
        back_urls: { success: retorno, failure: retorno, pending: retorno },
        auto_return: 'approved',
        statement_descriptor: 'DOM MALTA TESTE'
        // Sem payer com dados reais: comprador entra com sua conta fictícia.
        // Sem notification_url nesta etapa: a consulta autenticada confirma o status.
    });
    if (String(preferencia.collector_id) !== vendedor || !preferencia.id) throw new Falha(502, 'Vendedor da preferência não confere.');
    // Checkout Pro atual utiliza o init_point com as credenciais do test seller.
    const url = checkoutValido(preferencia.init_point);
    const salvos = await banco(c, 'pedidos_mp_teste?id=eq.' + pedido.id + '&admin_id=eq.' + admin, 'PATCH', {
        preferencia_id: String(preferencia.id), checkout_url: url, status: 'aguardando_pagamento'
    });
    if (salvos.length !== 1) throw new Falha(502, 'Não foi possível salvar o checkout. Consulte o teste antes de reiniciar.');
    return { id: pedido.id, checkout_url: url };
}
async function consultar(c, admin, vendedor, body) {
    if (!UUID.test(body.id)) throw new Falha(400, 'Protocolo inválido.');
    const rows = await banco(c, 'pedidos_mp_teste?select=*&id=eq.' + body.id + '&admin_id=eq.' + admin);
    if (!rows.length) throw new Falha(404, 'Teste não encontrado para este administrador.');
    const pedido = rows[0];
    if (pedido.vendedor_id !== vendedor) throw new Falha(409, 'As credenciais do vendedor foram alteradas após criar este teste.');
    if (pedido.preferencia_id) {
        const busca = await mp(c, '/v1/payments/search?external_reference=' + pedido.id + '&sort=date_created&criteria=desc&limit=50');
        const encontrados = Array.isArray(busca.results) ? busca.results : [];
        // O retorno do navegador e seus parâmetros nunca confirmam um pagamento.
        // Prioriza um aprovado já associado ao pedido, depois aprovado, depois mais recente.
        const candidato = encontrados.find(p => String(p.id) === pedido.pagamento_id)
            || encontrados.find(p => p.status === 'approved') || encontrados[0];
        if (candidato) {
            if (!/^\d{1,30}$/.test(String(candidato.id))) throw new Falha(502, 'Identificador de pagamento inválido.');
            const pagamento = await mp(c, '/v1/payments/' + candidato.id);
            const divergencias = [];

            if (pagamento.live_mode !== false)
                divergencias.push('ambiente do pagamento');

            if (String(pagamento.collector_id) !== vendedor)
                divergencias.push('vendedor');

            if (pagamento.external_reference !== pedido.id)
                divergencias.push('protocolo do pedido');

            if (pagamento.currency_id !== 'BRL')
                divergencias.push('moeda');

            if (
                Math.round(Number(pagamento.transaction_amount) * 100)
                !== Math.round(Number(pedido.total) * 100)
            )
                divergencias.push('valor');

            if (!ESTADOS.has(pagamento.status))
                divergencias.push('status');

            if (divergencias.length) {
                throw new Falha(
                    409,
                    'Divergência: ' + divergencias.join(', ')
                    + '. Nenhuma venda foi registrada.'
                );
            }
            const dados = { status: pagamento.status, pagamento_id: String(pagamento.id), consultado_em: new Date().toISOString() };
            await banco(c, 'pedidos_mp_teste?id=eq.' + pedido.id + '&admin_id=eq.' + admin, 'PATCH', dados);
            Object.assign(pedido, dados);
        }
    }
    return { id: pedido.id, total: pedido.total, status: pedido.status, pagamento_id: pedido.pagamento_id, checkout_url: pedido.checkout_url, teste: true };
}
module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
        const c = configuracao();
        if (req.method === 'GET') return res.status(200).json({ habilitado: true, modo: 'teste' });
        if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); throw new Falha(405, 'Método não permitido.'); }
        // Não habilita CORS; POST precisa de sessão do administrador.
        if (req.headers.origin && req.headers.origin !== c.origem && req.headers.origin !== c.alias) throw new Falha(403, 'Abra o teste pelo endereço desta publicação Preview.');
        if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new Falha(415, 'Envie JSON.');
        let body;
        try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
        catch { throw new Falha(400, 'JSON inválido.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 24000) throw new Falha(400, 'Requisição inválida.');
        if (!['criar','consultar','listar'].includes(body.acao)) throw new Falha(400, 'Ação inválida.');
        const admin = await administrador(c, req);
        if (body.acao === 'listar') {
            const pedidos = await banco(c, 'pedidos_mp_teste?select=id,criado_em,status,total&admin_id=eq.' + admin + '&order=criado_em.desc&limit=20');
            return res.status(200).json({ pedidos });
        }
        const vendedor = await vendedorTeste(c);
        const resposta = body.acao === 'criar' ? await criar(c, admin, vendedor, body) : await consultar(c, admin, vendedor, body);
        return res.status(200).json(resposta);
    } catch (erro) {
        // Nunca registra tokens, headers, dados pessoais ou respostas integrais do gateway.
        return res.status(erro instanceof Falha ? erro.status : 500).json({ erro: erro instanceof Falha ? erro.message : 'Falha interna. Confira a configuração do teste.' });
    }
};
