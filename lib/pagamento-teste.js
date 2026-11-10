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
                const caminho = new URL(url).pathname;

        const etapa = origem === 'mp'
            ? (
                caminho === '/users/me'
                    ? 'consultar_vendedor'
                    : /^\/v1\/payments\/\d+$/.test(caminho)
                        ? 'consultar_pagamento'
                        : caminho === '/v1/payments/search'
                            ? 'buscar_pagamentos'
                            : 'outra_consulta_mp'
            )
            : 'consulta_supabase';

        console.error('[pagamento-teste] consulta externa recusada', {
            servico: origem === 'mp' ? 'mercado_pago' : 'supabase',
            etapa,
            status_http: resposta.status
        });
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
    if (c.real) {
        for (const [antes, depois] of Object.entries(require('./checkout-mapa'))) caminho = caminho.replaceAll(antes, depois);
    }
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

function mp(c, caminho, metodo = 'GET', dados, idempotencia) {
    return jsonExterno(
        'https://api.mercadopago.com' + caminho,
        {
            method: metodo,
            headers: {
                Authorization: 'Bearer ' + c.token,
                'Content-Type': 'application/json',
                ...(idempotencia ? { 'X-Idempotency-Key': idempotencia } : {})
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
    console.info('[pagamento-teste] vendedor configurado', {
    vendedor_id: String(vendedor.id)
});

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

    let webhook;

    try {
        webhook = new URL(c.real ? c.origem + '/api/webhook' : process.env.MERCADO_PAGO_WEBHOOK_URL);
    } catch {
        throw new Falha(503, 'Confira MERCADO_PAGO_WEBHOOK_URL na Vercel.');
    }

    if (
        webhook.protocol !== 'https:'
        || (c.real ? webhook.origin !== c.origem : !/^loja-de-roupa-dom-malta-[a-z0-9-]+\.vercel\.app$/.test(webhook.hostname))
        || webhook.pathname !== (c.real ? '/api/webhook' : '/api/webhook-teste')
        || webhook.username
        || webhook.password
        || webhook.port
        || webhook.hash
        || (!c.real && !webhook.searchParams.get('x-vercel-protection-bypass')?.trim())
    ) {
        throw new Falha(503, 'Endereço do webhook de teste inválido.');
    }

    const pedido = await banco(c, 'rpc/criar_pedido_mp_teste', 'POST', {
        p_id: body.id,
        p_cliente: body.cliente,
        p_itens: body.itens,
        p_total: body.total,
        p_admin: admin,
        p_vendedor: vendedor,
        ...(c.real ? { p_acesso_hash: body.acesso_hash } : {})
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
        + (c.real ? '/pages/pedido.html?pedido=' : '/pages/resultado-teste.html?pedido=') + pedido.id;


    const preferencia = await mp(c, '/checkout/preferences', 'POST', {
        items: pedido.itens.map(item => ({
            id: item.variacao_id,
            title: (
                (c.real ? '' : 'TESTE — ') + item.nome
                + ' — ' + item.tamanho
                + ' / ' + item.cor
            ).slice(0, 250),
            quantity: item.quantidade,
            currency_id: 'BRL',
            unit_price: Number(item.preco)
        })),
        external_reference: pedido.id,
        notification_url: webhook.href,
        expires: true,
        expiration_date_from: new Date(Date.now() - 60000).toISOString(),
        expiration_date_to: expiraEm,
        back_urls: {
            success: retorno,
            failure: retorno,
            pending: retorno
        },
        auto_return: 'approved',
        statement_descriptor: c.real ? 'DOM MALTA' : 'DOM MALTA TESTE'
        // Sem payer com dados reais: comprador usa sua conta fictícia.
        // Webhook assinado e consulta autenticada conciliam o pagamento.
    });

    if (
        String(preferencia.collector_id) !== vendedor
        || !preferencia.id
    ) {
        throw new Falha(502, 'Vendedor da preferência não confere.');
    }

    const url = checkoutValido(preferencia.init_point);

    await associarCheckout(c, pedido, admin, {
        preferencia_id: String(preferencia.id),
        checkout_url: url,
        status: 'aguardando_pagamento'
    });

    return {
        id: pedido.id,
        checkout_url: url
    };
}

async function associarCheckout(c, pedido, admin, dados) {
    const caminho = 'pedidos_mp_teste?id=eq.' + pedido.id + '&admin_id=eq.' + admin;
    const salvos = await banco(c, caminho
        + '&preferencia_id=is.null&status=eq.aguardando_checkout&criacao_iniciada=eq.true', 'PATCH', dados);
    if (!Array.isArray(salvos)) throw new Falha(502, 'Resposta inválida ao associar checkout.');
    if (salvos.length === 1) {
        Object.assign(pedido, salvos[0]);
        return;
    }
    const atuais = await banco(c, caminho + '&select=*');
    if (!Array.isArray(atuais) || atuais.length !== 1
        || atuais[0].preferencia_id !== dados.preferencia_id
        || atuais[0].checkout_url !== dados.checkout_url) {
        throw new Falha(409, 'O pedido mudou durante a associação do checkout. Consulte novamente.');
    }
    // Uma recuperação ou webhook pode ter confirmado o pagamento antes da
    // resposta original da criação. Nunca regride o status nessa situação.
    Object.assign(pedido, atuais[0]);
}

async function recuperarCheckout(c, pedido, admin, vendedor) {
    const busca = await mp(c, '/checkout/preferences/search?external_reference=' + pedido.id + '&limit=2');
    if (!Array.isArray(busca.elements) || !Number.isInteger(busca.total)
        || busca.total < 0 || busca.total !== busca.elements.length || busca.total > 1) {
        throw new Falha(409, 'Busca de checkout inconsistente. Exige conciliação; nenhuma nova cobrança foi criada.');
    }
    if (busca.total === 0) {
        if (c.real && Number.isFinite(Date.parse(pedido.checkout_expira_em))
            && Date.parse(pedido.checkout_expira_em) <= Date.now() - 120000) {
            const pagamentos = await mp(c,'/v1/payments/search?external_reference='+pedido.id+'&limit=1');
            if (!Array.isArray(pagamentos.results) || pagamentos.paging?.total!==0 || pagamentos.results.length!==0) {
                throw new Falha(409,'Existe pagamento em conciliação. A reserva foi mantida.');
            }
            await banco(c,'rpc/expirar_checkout_sem_preferencia','POST',{p_pedido:pedido.id,p_admin:admin});
        }
        return;
    }
    const encontrado = busca.elements[0];
    if (typeof encontrado.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(encontrado.id)) {
        throw new Falha(502, 'Identificador de checkout inválido.');
    }
    const p = await mp(c, '/checkout/preferences/' + encodeURIComponent(encontrado.id));
    const reservas = await banco(c, 'reservas_checkout_teste?select=expira_em&pedido_id=eq.' + pedido.id);
    const limite = Math.min(...reservas.map(r => Date.parse(r.expira_em)));
    const itens = Array.isArray(p.items) ? p.items : [];
    if (p.id !== encontrado.id || String(p.collector_id) !== vendedor || p.external_reference !== pedido.id
        || p.expires !== true || !Number.isFinite(limite)
        || !Number.isFinite(Date.parse(p.expiration_date_to))
        || Math.abs(Date.parse(p.expiration_date_to) - limite) > 1000
        || itens.length !== pedido.itens.length || new Set(itens.map(i => i.id)).size !== itens.length
        || pedido.itens.some(item => !itens.some(i => i.id === item.variacao_id
            && i.currency_id === 'BRL' && i.quantity === item.quantidade
            && Math.round(Number(i.unit_price) * 100) === Math.round(Number(item.preco) * 100)))) {
        throw new Falha(409, 'Checkout encontrado não corresponde à reserva e aos itens. Exige conciliação.');
    }
    const dados = { preferencia_id: p.id, checkout_url: checkoutValido(p.init_point), status: 'aguardando_pagamento' };
    await associarCheckout(c, pedido, admin, dados);
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
    let conciliacao = pedido.conciliacao || null;

    if (!pedido.preferencia_id && (pedido.criacao_iniciada
        || (c.real && Date.parse(pedido.checkout_expira_em) <= Date.now() - 120000))) {
        await recuperarCheckout(c, pedido, admin, vendedor);
    }

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
        if (body.pagamento_id && !/^\d{1,30}$/.test(String(body.pagamento_id))) {
            throw new Falha(400, 'Identificador de pagamento inválido.');
        }
        const candidato = body.pagamento_id
            ? { id: String(body.pagamento_id) }
            : encontrados.find(p => p.status === 'approved')
            || encontrados.find(p =>
                ['pending', 'in_process', 'authorized', 'in_mediation']
                    .includes(p.status)
            )
            || encontrados.find(p =>
                String(p.id) === pedido.pagamento_id
            )
            || encontrados[0];

        if (candidato) {
            ausenciaPagamentosConfirmada = false;
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

            if (!c.real && !/^\d{1,30}$/.test(compradorEsperado)) {
                throw new Falha(
                    503,
                    'Configure MERCADO_PAGO_TEST_BUYER_ID no ambiente Preview.'
                );
            }

            if (!c.real && compradorId !== compradorEsperado) {
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

            const snapshot = snapshotPagamento(pagamento);
            const conciliado = await banco(c, 'rpc/conciliar_pagamento_teste', 'POST', {
                p_pedido: pedido.id,
                p_admin: admin,
                p_vendedor: vendedor,
                p_pagamento: snapshot
            });
            if (conciliado?.id !== pedido.id || conciliado.pagamento_id !== snapshot.id
                || !ESTADOS.has(conciliado.status)) {
                throw new Falha(502, 'Resposta inválida da conciliação do pagamento de teste.');
            }
            Object.assign(pedido, conciliado);
            conciliacao = conciliado.conciliacao || null;
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

    const reservasFinais = await banco(c,
        'reservas_checkout_teste?select=estado&pedido_id=eq.' + pedido.id);
    const estornosPendentes = await banco(c,
        'estornos_checkout_teste?select=tentativa,valor,estado&pedido_id=eq.' + pedido.id
        + '&admin_id=eq.' + admin + '&estado=eq.iniciado');
    let estornoConsultado = null;
    if (body.tentativa_estorno) {
        if (!UUID.test(body.tentativa_estorno)) throw new Falha(400, 'Tentativa de estorno inválida.');
        const tentativas = await banco(c,
            'estornos_checkout_teste?select=tentativa,valor,estado&pedido_id=eq.' + pedido.id
            + '&admin_id=eq.' + admin + '&tentativa=eq.' + body.tentativa_estorno);
        estornoConsultado = tentativas[0] || null;
    }

    return {
        id: pedido.id,
        total: pedido.total,
        status: pedido.status,
        pagamento_id: pedido.pagamento_id,
        checkout_url: pedido.checkout_url,
        prazo_checkout: prazoCheckout,
        estado_checkout: estadoCheckout(pedido, reservasFinais),
        conciliacao,
        aprovacao_tardia: pedido.aprovacao_tardia || false,
        valor_estornado: pedido.valor_estornado ?? 0,
        taxa_mp: pedido.taxa_mp ?? null,
        valor_liquido: pedido.valor_liquido ?? null,
        estorno_pendente: estornosPendentes[0] || null,
        estorno_consultado: estornoConsultado,
        atendimento: pedido.atendimento || null,
        solicitacao_cancelamento: pedido.solicitacao_cancelamento || false,
        solicitacao_estorno: pedido.solicitacao_estorno || false,
        teste: !c.real
    };
}

async function estornar(c, admin, vendedor, body) {
    if (!UUID.test(body.id) || !UUID.test(body.tentativa)
        || typeof body.valor !== 'number' || !Number.isFinite(body.valor)
        || body.valor <= 0 || Math.abs(body.valor * 100 - Math.round(body.valor * 100)) > 0.000001) {
        throw new Falha(400, 'Confira o valor e a tentativa de estorno.');
    }
    // A consulta valida novamente comprador fictício, vendedor, pedido e valor.
    await consultar(c, admin, vendedor, { id: body.id });
    const tentativa = await banco(c, 'rpc/iniciar_estorno_teste', 'POST', {
        p_pedido: body.id, p_admin: admin, p_tentativa: body.tentativa, p_valor: body.valor
    });
    if (tentativa.tentativa !== body.tentativa || Number(tentativa.valor) !== body.valor
        || !/^\d{1,30}$/.test(tentativa.pagamento_id)
        || !['iniciado', 'confirmado'].includes(tentativa.estado)) {
        throw new Falha(502, 'Tentativa de estorno inconsistente.');
    }
    if (tentativa.estado !== 'confirmado') {
        const reembolso = await mp(c, '/v1/payments/' + tentativa.pagamento_id + '/refunds',
            'POST', { amount: body.valor }, body.tentativa);
        if (reembolso.status !== 'approved' || String(reembolso.payment_id) !== tentativa.pagamento_id
            || Number(reembolso.amount) !== body.valor || !/^\d{1,30}$/.test(String(reembolso.id))) {
            throw new Falha(503, 'Estorno ainda sem confirmação. Consulte e retome a mesma tentativa.');
        }
        await banco(c, 'rpc/concluir_estorno_teste', 'POST', {
            p_tentativa: body.tentativa, p_admin: admin,
            p_reembolso: { id: String(reembolso.id), payment_id: String(reembolso.payment_id),
                amount: Number(reembolso.amount), status: reembolso.status }
        });
    }
    return { ...await consultar(c, admin, vendedor, { id: body.id }),
        estorno: { tentativa: body.tentativa, valor: body.valor, estado: 'confirmado' } };
}

function snapshotPagamento(p) {
    const moeda = (valor, nome) => {
        if (typeof valor !== 'number' || !Number.isFinite(valor)
            || Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001) {
            throw new Falha(502, 'Valor ' + nome + ' inválido no pagamento.');
        }
        return Math.round(valor * 100) / 100;
    };
    const atualizado = Date.parse(p.date_last_updated);
    const aprovado = p.date_approved == null ? null : Date.parse(p.date_approved);
    if (!Number.isFinite(atualizado) || (aprovado !== null && !Number.isFinite(aprovado))) {
        throw new Falha(502, 'Data de atualização do pagamento inválida.');
    }
    const total = moeda(p.transaction_amount, 'total');
    const estornado = moeda(p.transaction_amount_refunded, 'estornado');
    if (estornado < 0 || estornado > total) throw new Falha(502, 'Valor estornado fora do total pago.');
    let taxa = null;
    if (p.fee_details != null) {
        if (!Array.isArray(p.fee_details)) throw new Falha(502, 'Taxas do pagamento inválidas.');
        taxa = p.fee_details.reduce((s, t) => s + Math.round(moeda(t.amount, 'da taxa') * 100), 0) / 100;
    }
    return {
        id: String(p.id), status: p.status, total, estornado, taxa,
        liquido: p.transaction_details?.net_received_amount == null ? null
            : moeda(p.transaction_details.net_received_amount, 'líquido'),
        atualizado_em: new Date(atualizado).toISOString(),
        aprovado_em: aprovado === null ? null : new Date(aprovado).toISOString()
    };
}

function estadoCheckout(pedido, reservas) {
    if (['aguardando_checkout','aguardando_pagamento'].includes(pedido.status) && !pedido.pagamento_id
        && reservas.length>0 && reservas.every(r=>r.estado==='expirada')) return 'expirado';
    if (pedido.criacao_iniciada && !pedido.preferencia_id) return 'criacao_pendente';
    // O relógio do navegador e a ausência de reserva não provam expiração.
    return null;
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
            'estornar',
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
                'pedidos_mp_teste?select=id,criado_em,status,total,pagamento_id,preferencia_id,criacao_iniciada,conciliacao,aprovacao_tardia,valor_estornado,taxa_mp,valor_liquido,reservas_checkout_teste(estado)'
                + '&admin_id=eq.' + admin
                + '&order=criado_em.desc&limit=20'
            );

            return res.status(200).json({ pedidos: pedidos.map(p => ({
                id: p.id, criado_em: p.criado_em, status: p.status, total: p.total,
                estado_checkout: estadoCheckout(p, p.reservas_checkout_teste || []),
                conciliacao: p.conciliacao,
                aprovacao_tardia: p.aprovacao_tardia,
                valor_estornado: p.valor_estornado,
                taxa_mp: p.taxa_mp,
                valor_liquido: p.valor_liquido
            })) });
        }

        const vendedor = await vendedorTeste(c);

        const resposta = body.acao === 'estornar'
            ? await estornar(c, admin, vendedor, body)
            : body.acao === 'criar'
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
module.exports.interno = {
    Falha,
    UUID,
    configuracao,
    banco,
    mp,
    vendedorTeste,
    consultar,
    snapshotPagamento,
    recuperarCheckout,
    estornar,
    associarCheckout,
    criar,
    administrador,
    estadoCheckout
};
