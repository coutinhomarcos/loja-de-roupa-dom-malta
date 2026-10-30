'use strict';

// Apenas servidor Vercel. Nenhuma credencial é enviada ao navegador.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADOS = new Set([
    'approved', 'pending', 'in_process', 'rejected',
    'cancelled', 'refunded', 'charged_back',
    'authorized', 'in_mediation'
]);

class Falha extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function configuracao() {
    const e = process.env;

    if (e.VERCEL_ENV !== 'preview' || e.MERCADO_PAGO_MODO !== 'teste') {
        throw new Falha(
            403,
            'Pagamento de teste disponível somente no ambiente Preview.'
        );
    }

    if (
        !e.MERCADO_PAGO_ACCESS_TOKEN
        || !e.SUPABASE_SECRET_KEY?.startsWith('sb_secret_')
        || !e.SUPABASE_URL
    ) {
        throw new Falha(
            503,
            'Confira as variáveis do ambiente Preview e publique novamente.'
        );
    }

    const urlBanco = new URL(e.SUPABASE_URL);

    if (
        urlBanco.protocol !== 'https:'
        || !urlBanco.hostname.endsWith('.supabase.co')
        || urlBanco.pathname !== '/'
    ) {
        throw new Falha(
            503,
            'SUPABASE_URL deve conter somente o endereço HTTPS do projeto.'
        );
    }

    const host = e.VERCEL_URL;
    const hostValido = /^[a-z0-9-]+\.vercel\.app$/i;

    if (!host || !hostValido.test(host)) {
        throw new Falha(503, 'Endereço da publicação indisponível.');
    }

    return {
        banco: urlBanco.origin,
        origem: 'https://' + host,
        alias: e.VERCEL_BRANCH_URL && hostValido.test(e.VERCEL_BRANCH_URL)
            ? 'https://' + e.VERCEL_BRANCH_URL
            : null,
        chave: e.SUPABASE_SECRET_KEY,
        token: e.MERCADO_PAGO_ACCESS_TOKEN
    };
}

async function jsonExterno(url, opcoes = {}, origem = 'banco') {
    let resposta;

    try {
        resposta = await fetch(url, {
            ...opcoes,
            redirect: 'error',
            signal: AbortSignal.timeout(10000)
        });
    } catch {
        throw new Falha(
            502,
            'Não foi possível consultar '
            + (origem === 'mp' ? 'o Mercado Pago' : 'o Supabase')
            + '. Tente novamente.'
        );
    }

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
        if (origem === 'banco' && dados?.code === 'P0001') {
            throw new Falha(409, dados.message);
        }

        if (origem === 'banco' && dados?.code === 'PGRST202') {
            throw new Falha(
                503,
                'Confira se os scripts SQL do pagamento de teste foram executados no Supabase.'
            );
        }

        throw new Falha(
            502,
            (origem === 'mp' ? 'Mercado Pago' : 'Supabase')
            + ' recusou a consulta. Confira as credenciais e a configuração.'
        );
    }

    if (!dados) {
        throw new Falha(502, 'Resposta externa inválida.');
    }

    return dados;
}

function banco(c, caminho, metodo = 'GET', dados) {
    // Chaves sb_secret vão em apikey, nunca em Authorization: Bearer.
    return jsonExterno(c.banco + '/rest/v1/' + caminho, {
        method: metodo,
        headers: {
            apikey: c.chave,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
        },
        ...(dados === undefined ? {} : { body: JSON.stringify(dados) })
    });
}

function mp(c, caminho, metodo = 'GET', dados) {
    return jsonExterno(
        'https://api.mercadopago.com' + caminho,
        {
            method: metodo,
            headers: {
                Authorization: 'Bearer ' + c.token,
                'Content-Type': 'application/json'
            },
            ...(dados === undefined ? {} : { body: JSON.stringify(dados) })
        },
        'mp'
    );
}

async function administrador(c, req) {
    const auth = req.headers.authorization || '';

    if (!/^Bearer [\w.-]+$/.test(auth) || auth.length > 10000) {
        throw new Falha(
            401,
            'Entre no painel de estoque desta versão de testes e volte aqui.'
        );
    }

    let usuario;

    try {
        usuario = await jsonExterno(c.banco + '/auth/v1/user', {
            headers: {
                apikey: c.chave,
                Authorization: auth
            }
        });
    } catch {
        throw new Falha(
            401,
            'Sua sessão expirou. Entre novamente no painel desta versão de testes.'
        );
    }

    if (!UUID.test(usuario.id)) {
        throw new Falha(401, 'Sessão inválida.');
    }

    const rows = await banco(
        c,
        'administradores?select=usuario_id&usuario_id=eq.' + usuario.id
    );

    if (!rows.length) {
        throw new Falha(
            403,
            'Somente o administrador pode iniciar os testes de pagamento.'
        );
    }

    return usuario.id;
}

async function vendedorTeste(c) {
    const vendedor = await mp(c, '/users/me');

    if (
        !Array.isArray(vendedor.tags)
        || !vendedor.tags.includes('test_user')
        || !/^\d{1,30}$/.test(String(vendedor.id))
    ) {
        throw new Falha(
            403,
            'Credencial bloqueada: selecione as credenciais de TESTE do vendedor no Mercado Pago. Conta real não é aceita nesta etapa.'
        );
    }

    return String(vendedor.id);
}

function checkoutValido(valor) {
    const url = new URL(valor);

    if (
        url.protocol !== 'https:'
        || ![
            'www.mercadopago.com.br',
            'sandbox.mercadopago.com.br'
        ].includes(url.hostname)
        || url.username
        || url.password
    ) {
        throw new Falha(502, 'Endereço de checkout inválido.');
    }

    return url.href;
}

async function criar(c, admin, vendedor, body) {
    if (
        !UUID.test(body.id)
        || !Array.isArray(body.itens)
        || body.itens.length === 0
        || body.itens.length > 50
        || !Number.isFinite(body.total)
    ) {
        throw new Falha(400, 'Dados do carrinho inválidos.');
    }

    const pedido = await banco(c, 'rpc/criar_pedido_mp_teste', 'POST', {
        p_id: body.id,
        p_cliente: body.cliente,
        p_itens: body.itens,
        p_total: body.total,
        p_admin: admin,
        p_vendedor: vendedor
    });

    if (pedido.preferencia_id && pedido.checkout_url) {
        return {
            id: pedido.id,
            checkout_url: checkoutValido(pedido.checkout_url)
        };
    }

    await banco(c, 'rpc/reservar_estoque_teste', 'POST', {
        p_pedido: pedido.id,
        p_admin: admin
    });

    const reservas = await banco(
        c,
        'reservas_checkout_teste?select=expira_em,estado'
        + '&pedido_id=eq.' + pedido.id
    );

    const vencimentos = reservas.map(reserva =>
        Date.parse(reserva.expira_em)
    );

    if (
        reservas.length === 0
        || reservas.some(reserva => reserva.estado !== 'reservada')
        || vencimentos.some(data => !Number.isFinite(data))
        || Math.min(...vencimentos) <= Date.now()
    ) {
        throw new Falha(409, 'A reserva de teste não está ativa.');
    }

    const expiraEm = new Date(Math.min(...vencimentos)).toISOString();

    const inicio = await banco(
        c,
        'rpc/iniciar_checkout_mp_teste',
        'POST',
        {
            p_id: pedido.id,
            p_admin: admin
        }
    );

    if (!inicio.criar) {
        return {
            id: inicio.id,
            checkout_url: checkoutValido(inicio.checkout_url)
        };
    }

    const retorno = c.origem
        + '/pages/resultado-teste.html?pedido=' + pedido.id;

    const preferencia = await mp(c, '/checkout/preferences', 'POST', {
        items: pedido.itens.map(item => ({
            id: item.variacao_id,
            title: (
                'TESTE — ' + item.nome
                + ' — ' + item.tamanho
                + ' / ' + item.cor
            ).slice(0, 250),
            quantity: item.quantidade,
            currency_id: 'BRL',
            unit_price: Number(item.preco)
        })),
        external_reference: pedido.id,
        expires: true,
        expiration_date_from: new Date(Date.now() - 60000).toISOString(),
        expiration_date_to: expiraEm,
        back_urls: {
            success: retorno,
            failure: retorno,
            pending: retorno
        },
        auto_return: 'approved',
        statement_descriptor: 'DOM MALTA TESTE'
        // Sem payer com dados reais: comprador usa sua conta fictícia.
        // A consulta autenticada confirma o status nesta etapa.
    });

    if (
        String(preferencia.collector_id) !== vendedor
        || !preferencia.id
    ) {
        throw new Falha(502, 'Vendedor da preferência não confere.');
    }

    const url = checkoutValido(preferencia.init_point);

    const salvos = await banco(
        c,
        'pedidos_mp_teste?id=eq.' + pedido.id
        + '&admin_id=eq.' + admin,
        'PATCH',
        {
            preferencia_id: String(preferencia.id),
            checkout_url: url,
            status: 'aguardando_pagamento'
        }
    );

    if (salvos.length !== 1) {
        throw new Falha(
            502,
            'Não foi possível salvar o checkout. Consulte o teste antes de reiniciar.'
        );
    }

    return {
        id: pedido.id,
        checkout_url: url
    };
}

async function consultar(c, admin, vendedor, body) {
    if (!UUID.test(body.id)) {
        throw new Falha(400, 'Protocolo inválido.');
    }

    const rows = await banco(
        c,
        'pedidos_mp_teste?select=*&id=eq.' + body.id
        + '&admin_id=eq.' + admin
    );

    if (!rows.length) {
        throw new Falha(
            404,
            'Teste não encontrado para este administrador.'
        );
    }

    const pedido = rows[0];

    if (pedido.vendedor_id !== vendedor) {
        throw new Falha(
            409,
            'As credenciais do vendedor foram alteradas após criar este teste.'
        );
    }

    let ausenciaPagamentosConfirmada = false;

    if (pedido.preferencia_id) {
        const busca = await mp(
            c,
            '/v1/payments/search?external_reference='
            + pedido.id
            + '&sort=date_created&criteria=desc&limit=50'
        );

        if (
            !Array.isArray(busca.results)
            || !Number.isInteger(busca.paging?.total)
            || busca.paging.total < 0
            || busca.paging.total < busca.results.length
        ) {
            throw new Falha(
                502,
                'Resposta inválida ao consultar pagamentos. Reserva mantida.'
            );
        }

        const encontrados = busca.results;

        ausenciaPagamentosConfirmada =
            busca.paging.total === 0
            && encontrados.length === 0
            && pedido.pagamento_id === null
            && pedido.status === 'aguardando_pagamento';

        // O retorno do navegador nunca confirma um pagamento.
        // Prioriza aprovado, depois pagamento em andamento.
        const candidato =
            encontrados.find(p => p.status === 'approved')
            || encontrados.find(p =>
                ['pending', 'in_process', 'authorized', 'in_mediation']
                    .includes(p.status)
            )
            || encontrados.find(p =>
                String(p.id) === pedido.pagamento_id
            )
            || encontrados[0];

        if (candidato) {
            if (!/^\d{1,30}$/.test(String(candidato.id))) {
                throw new Falha(
                    502,
                    'Identificador de pagamento inválido.'
                );
            }

            const pagamento = await mp(
                c,
                '/v1/payments/' + candidato.id
            );

            const divergencias = [];
            const compradorId = String(pagamento.payer?.id || '');
            const compradorEsperado = (
                process.env.MERCADO_PAGO_TEST_BUYER_ID || ''
            ).trim();

            if (!/^\d{1,30}$/.test(compradorEsperado)) {
                throw new Falha(
                    503,
                    'Configure MERCADO_PAGO_TEST_BUYER_ID no ambiente Preview.'
                );
            }

            if (compradorId !== compradorEsperado) {
                divergencias.push(
                    'comprador diferente da conta de teste configurada'
                );
            }

            if (String(pagamento.id) !== String(candidato.id)) {
                divergencias.push('identificador do pagamento');
            }

            if (String(pagamento.collector_id) !== vendedor) {
                divergencias.push('vendedor');
            }

            if (pagamento.external_reference !== pedido.id) {
                divergencias.push('protocolo do pedido');
            }

            if (pagamento.currency_id !== 'BRL') {
                divergencias.push('moeda');
            }

            if (
                Math.round(Number(pagamento.transaction_amount) * 100)
                !== Math.round(Number(pedido.total) * 100)
            ) {
                divergencias.push('valor');
            }

            if (!ESTADOS.has(pagamento.status)) {
                divergencias.push('status');
            }

            if (divergencias.length) {
                throw new Falha(
                    409,
                    'Divergência: ' + divergencias.join(', ')
                    + '. Nenhuma venda foi registrada.'
                );
            }

            const dados = {
                status: pagamento.status,
                pagamento_id: String(pagamento.id),
                consultado_em: new Date().toISOString(),
                encerramento_verificado_em: null
            };

            const salvos = await banco(
                c,
                'pedidos_mp_teste?id=eq.' + pedido.id
                + '&admin_id=eq.' + admin,
                'PATCH',
                dados
            );

            if (!Array.isArray(salvos) || salvos.length !== 1) {
                throw new Falha(
                    502,
                    'Não foi possível atualizar o pedido de teste.'
                );
            }

            Object.assign(pedido, dados);

            if (pagamento.status === 'approved') {
                await banco(c, 'rpc/confirmar_venda_teste', 'POST', {
                    p_pedido: pedido.id,
                    p_admin: admin
                });
            }
        }
    }

    let prazoCheckout = null;

    if (pedido.preferencia_id) {
        const preferencia = await mp(
            c,
            '/checkout/preferences/'
            + encodeURIComponent(pedido.preferencia_id)
        );

        if (
            String(preferencia.id) !== pedido.preferencia_id
            || String(preferencia.collector_id) !== vendedor
            || preferencia.external_reference !== pedido.id
        ) {
            throw new Falha(
                409,
                'A preferência não corresponde a este pedido.'
            );
        }

        prazoCheckout = {
            expires: preferencia.expires ?? null,
            expiration_date_from: preferencia.expiration_date_from ?? null,
            expiration_date_to: preferencia.expiration_date_to ?? null,
            preference_expired: preferencia.preference_expired ?? null
        };

        const vencimento = Date.parse(preferencia.expiration_date_to);

        if (
            ausenciaPagamentosConfirmada
            && preferencia.expires === true
            && Number.isFinite(vencimento)
            && vencimento <= Date.now() - 60000
        ) {
            // Confere novamente após consultar a preferência vencida.
            const novaBusca = await mp(
                c,
                '/v1/payments/search?external_reference='
                + pedido.id
                + '&sort=date_created&criteria=desc&limit=50'
            );

            if (
                !Array.isArray(novaBusca.results)
                || novaBusca.paging?.total !== 0
                || novaBusca.results.length !== 0
            ) {
                throw new Falha(
                    409,
                    'A ausência de pagamentos não foi confirmada. Reserva mantida.'
                );
            }

            const atualizados = await banco(
                c,
                'pedidos_mp_teste?id=eq.' + pedido.id
                + '&admin_id=eq.' + admin
                + '&status=eq.aguardando_pagamento'
                + '&pagamento_id=is.null'
                + '&preferencia_id=eq.'
                + encodeURIComponent(pedido.preferencia_id),
                'PATCH',
                {
                    checkout_expira_em: new Date(vencimento).toISOString(),
                    encerramento_verificado_em: new Date().toISOString()
                }
            );

            if (
                !Array.isArray(atualizados)
                || atualizados.length !== 1
            ) {
                throw new Falha(
                    409,
                    'O pedido mudou durante a consulta. Consulte novamente.'
                );
            }

            const liberacao = await banco(
                c,
                'rpc/liberar_reserva_teste',
                'POST',
                {
                    p_pedido: pedido.id,
                    p_admin: admin,
                    p_motivo: 'expiracao'
                }
            );

            prazoCheckout.reserva = liberacao;
        }
    }

    return {
        id: pedido.id,
        total: pedido.total,
        status: pedido.status,
        pagamento_id: pedido.pagamento_id,
        checkout_url: pedido.checkout_url,
        prazo_checkout: prazoCheckout,
        teste: true
    };
}

async function expirarAutomaticamente(c, req, body) {
    const { timingSafeEqual } = require('node:crypto');
    const segredo = process.env.CRON_TESTE_SECRET || '';
    const autorizacao = req.headers.authorization || '';

    if (!/^[a-f0-9]{64}$/.test(segredo)) {
        throw new Falha(503, 'Chave da automação não configurada.');
    }

    const esperado = Buffer.from('Bearer ' + segredo);
    const recebido = Buffer.from(autorizacao);

    if (
        recebido.length !== esperado.length
        || !timingSafeEqual(recebido, esperado)
    ) {
        throw new Falha(401, 'Automação não autorizada.');
    }

    if (typeof body.id !== 'string' || !UUID.test(body.id)) {
        throw new Falha(400, 'Protocolo inválido.');
    }

    const reservas = await banco(
        c,
        'reservas_checkout_teste?select=expira_em'
        + '&pedido_id=eq.' + body.id
        + '&estado=eq.reservada'
    );

    if (!Array.isArray(reservas)) {
        throw new Falha(502, 'Resposta de reservas inválida.');
    }

    if (reservas.length === 0) {
        return { teste: true, resultado: 'sem_reserva_ativa' };
    }

    const limite = Date.now() - 60000;

    if (reservas.some(reserva => {
        const vencimento = Date.parse(reserva.expira_em);
        return !Number.isFinite(vencimento) || vencimento > limite;
    })) {
        return { teste: true, resultado: 'reserva_ainda_no_prazo' };
    }

    const pedidos = await banco(
        c,
        'pedidos_mp_teste?select=id,admin_id'
        + '&id=eq.' + body.id
    );

    if (
        !Array.isArray(pedidos)
        || pedidos.length !== 1
        || !UUID.test(pedidos[0].admin_id)
    ) {
        throw new Falha(409, 'Pedido de teste inconsistente.');
    }

    const admin = pedidos[0].admin_id;

    const administradores = await banco(
        c,
        'administradores?select=usuario_id&usuario_id=eq.' + admin
    );

    if (!Array.isArray(administradores) || administradores.length !== 1) {
        throw new Falha(403, 'Administrador do teste não autorizado.');
    }

    const vendedor = await vendedorTeste(c);

    // Reutiliza as verificações de pagamento e a liberação existentes.
    const resposta = await consultar(c, admin, vendedor, {
        id: body.id
    });

    return {
        teste: true,
        resultado: resposta.prazo_checkout?.reserva
            ? 'reserva_verificada'
            : 'reserva_mantida',
        reserva: resposta.prazo_checkout?.reserva || null
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
        const c = configuracao();

        if (req.method === 'GET') {
            return res.status(200).json({
                habilitado: true,
                modo: 'teste'
            });
        }

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            throw new Falha(405, 'Método não permitido.');
        }

        // Não habilita CORS; POST precisa de sessão do administrador.
        if (
            req.headers.origin
            && req.headers.origin !== c.origem
            && req.headers.origin !== c.alias
        ) {
            throw new Falha(
                403,
                'Abra o teste pelo endereço desta publicação Preview.'
            );
        }

        if (
            !(req.headers['content-type'] || '')
                .startsWith('application/json')
        ) {
            throw new Falha(415, 'Envie JSON.');
        }

        let body;

        try {
            body = typeof req.body === 'string'
                ? JSON.parse(req.body)
                : req.body;
        } catch {
            throw new Falha(400, 'JSON inválido.');
        }

        if (
            !body
            || typeof body !== 'object'
            || Array.isArray(body)
            || JSON.stringify(body).length > 24000
        ) {
            throw new Falha(400, 'Requisição inválida.');
        }

                if (![
            'criar',
            'consultar',
            'listar',
            'estoque',
            'expirar_automaticamente'
        ].includes(body.acao)) {
            throw new Falha(400, 'Ação inválida.');
        }

        if (body.acao === 'expirar_automaticamente') {
            const resposta = await expirarAutomaticamente(c, req, body);
            return res.status(200).json(resposta);
        }

        const admin = await administrador(c, req);

        if (body.acao === 'estoque') {
            const ids = body.ids;

            if (
                !Array.isArray(ids)
                || ids.length === 0
                || ids.length > 50
                || !ids.every(id =>
                    typeof id === 'string' && UUID.test(id)
                )
            ) {
                throw new Falha(
                    400,
                    'Identificadores de estoque inválidos.'
                );
            }

            const estoque = await banco(
                c,
                'estoque_checkout_teste?select=variacao_id,estoque,reservado'
                + '&variacao_id=in.(' + ids.join(',') + ')'
            );

            return res.status(200).json({ estoque });
        }

        if (body.acao === 'listar') {
            const pedidos = await banco(
                c,
                'pedidos_mp_teste?select=id,criado_em,status,total'
                + '&admin_id=eq.' + admin
                + '&order=criado_em.desc&limit=20'
            );

            return res.status(200).json({ pedidos });
        }

        const vendedor = await vendedorTeste(c);

        const resposta = body.acao === 'criar'
            ? await criar(c, admin, vendedor, body)
            : await consultar(c, admin, vendedor, body);

        return res.status(200).json(resposta);
    } catch (erro) {
        // Nunca registra tokens, headers, dados pessoais
        // ou respostas integrais do gateway.
        return res.status(
            erro instanceof Falha ? erro.status : 500
        ).json({
            erro: erro instanceof Falha
                ? erro.message
                : 'Falha interna. Confira a configuração do teste.'
        });
    }
};