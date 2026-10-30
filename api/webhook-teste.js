'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');

const {
    Falha,
    UUID,
    configuracao,
    banco,
    mp,
    vendedorTeste,
    consultar
} = require('../lib/pagamento-teste').interno;

function verificarAssinatura(req) {
    const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!segredo) {
        throw new Falha(503, 'Assinatura do webhook não configurada.');
    }

    const url = new URL(req.url, 'https://webhook.local');
    const ids = url.searchParams.getAll('data.id');
    const assinatura = req.headers['x-signature'];
    const requisicao = req.headers['x-request-id'];

    if (
        ids.length !== 1
        || !/^\d{1,30}$/.test(ids[0])
        || typeof assinatura !== 'string'
        || assinatura.length > 1000
        || typeof requisicao !== 'string'
        || !/^[a-zA-Z0-9_-]{1,200}$/.test(requisicao)
    ) {
        throw new Falha(401, 'Notificação não autorizada.');
    }

    const partes = assinatura.split(',').map(parte => parte.trim());
    const valores = {};

    for (const parte of partes) {
        const separador = parte.indexOf('=');

        if (separador < 1) {
            throw new Falha(401, 'Assinatura inválida.');
        }

        const nome = parte.slice(0, separador);
        const valor = parte.slice(separador + 1);

        if (Object.hasOwn(valores, nome)) {
            throw new Falha(401, 'Assinatura inválida.');
        }

        valores[nome] = valor;
    }

    if (
        !/^\d{1,20}$/.test(valores.ts || '')
        || !/^[a-f0-9]{64}$/i.test(valores.v1 || '')
    ) {
        throw new Falha(401, 'Assinatura inválida.');
    }

    const manifesto = 'id:' + ids[0]
        + ';request-id:' + requisicao
        + ';ts:' + valores.ts + ';';

    const esperado = createHmac('sha256', segredo)
        .update(manifesto)
        .digest();

    const recebido = Buffer.from(valores.v1, 'hex');

    if (
        recebido.length !== esperado.length
        || !timingSafeEqual(recebido, esperado)
    ) {
        throw new Falha(401, 'Notificação não autorizada.');
    }

    return ids[0];
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
        // Mantém as restrições de Preview e vendedor de teste.
        const c = configuracao();

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            throw new Falha(405, 'Método não permitido.');
        }

        const pagamentoId = verificarAssinatura(req);

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
            throw new Falha(400, 'Notificação inválida.');
        }

        if (
            body.type !== 'payment'
            || String(body.data?.id) !== pagamentoId
        ) {
            throw new Falha(400, 'Evento de pagamento inválido.');
        }

        const vendedor = await vendedorTeste(c);

        // O status recebido na notificação nunca confirma a compra.
        const pagamento = await mp(
            c,
            '/v1/payments/' + pagamentoId
        );

        if (
            String(pagamento.id) !== pagamentoId
            || String(pagamento.collector_id) !== vendedor
        ) {
            throw new Falha(409, 'Pagamento não corresponde ao vendedor.');
        }

        const pedidoId = pagamento.external_reference;

        if (typeof pedidoId !== 'string' || !UUID.test(pedidoId)) {
            return res.status(200).json({
                teste: true,
                resultado: 'pagamento_fora_deste_fluxo'
            });
        }

        const pedidos = await banco(
            c,
            'pedidos_mp_teste?select=id,admin_id,vendedor_id,preferencia_id'
            + '&id=eq.' + pedidoId
        );

        if (!Array.isArray(pedidos)) {
            throw new Falha(502, 'Resposta de pedidos inválida.');
        }

        if (pedidos.length === 0) {
            return res.status(200).json({
                teste: true,
                resultado: 'pedido_nao_encontrado'
            });
        }

        const pedido = pedidos[0];

        if (
            pedidos.length !== 1
            || !UUID.test(pedido.admin_id)
            || pedido.vendedor_id !== vendedor
            || !pedido.preferencia_id
        ) {
            throw new Falha(409, 'Pedido de teste inconsistente.');
        }

        const administradores = await banco(
            c,
            'administradores?select=usuario_id'
            + '&usuario_id=eq.' + pedido.admin_id
        );

        if (
            !Array.isArray(administradores)
            || administradores.length !== 1
        ) {
            throw new Falha(403, 'Administrador não autorizado.');
        }

        // Reutiliza a validação de comprador, valor, moeda e pedido.
        // A função SQL impede repetir a baixa da reserva consumida.
        const resposta = await consultar(
            c,
            pedido.admin_id,
            vendedor,
            { id: pedidoId }
        );

        if (
            resposta.pagamento_id !== pagamentoId
            || resposta.status !== pagamento.status
        ) {
            // Não confirma processamento se a busca ainda não refletiu
            // o pagamento recebido. Uma nova tentativa será necessária.
            throw new Falha(
                503,
                'Pagamento ainda não conciliado. Tente novamente.'
            );
        }

        return res.status(200).json({
            teste: true,
            resultado: 'pagamento_verificado'
        });
    } catch (erro) {
        // Não registra assinatura, credenciais ou dados do cliente.
        return res.status(
            erro instanceof Falha ? erro.status : 500
        ).json({
            erro: erro instanceof Falha
                ? erro.message
                : 'Falha interna ao verificar a notificação.'
        });
    }
};