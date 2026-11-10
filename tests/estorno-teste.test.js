'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estornar } = require('../lib/pagamento-teste').interno;
const id = '11111111-1111-4111-8111-111111111111';
for (const confirmado of [false, true]) {
    test(confirmado ? 'tentativa confirmada não envia segundo estorno' : 'estorno envia chave persistida e confere retorno', async () => {
        const original = global.fetch;
        const comprador = process.env.MERCADO_PAGO_TEST_BUYER_ID;
        process.env.MERCADO_PAGO_TEST_BUYER_ID = '456';
        let pedidosEstorno = 0;
        global.fetch = async (url, opcoes) => {
            let dados;
            if (url.includes('rpc/iniciar_estorno_teste')) dados = { tentativa: id, pagamento_id: '789', valor: 5, estado: confirmado ? 'confirmado' : 'iniciado' };
            else if (url.includes('/payments/789/refunds')) {
                pedidosEstorno++;
                assert.equal(opcoes.headers['X-Idempotency-Key'], id);
                assert.deepEqual(JSON.parse(opcoes.body), { amount: 5 });
                dados = { id: 987, payment_id: 789, amount: 5, status: 'approved' };
            } else if (url.includes('rpc/concluir_estorno_teste')) dados = { tentativa: id, estado: 'confirmado' };
            else if (url.includes('/payments/search')) dados = { results: [{ id: '789', status: 'approved' }], paging: { total: 1 } };
            else if (url.includes('/payments/789')) dados = { id: 789, status: 'approved', payer: { id: 456 }, collector_id: 123, external_reference: id, currency_id: 'BRL', transaction_amount: 10, transaction_amount_refunded: 0, date_last_updated: '2026-11-09T12:00:00Z' };
            else if (url.includes('rpc/conciliar_pagamento_teste')) dados = { id, status: 'approved', pagamento_id: '789', valor_estornado: 0 };
            else if (url.includes('/pedidos_mp_teste?')) dados = [{ id, vendedor_id: '123', preferencia_id: 'pref', pagamento_id: '789', total: 10, status: 'approved' }];
            else if (url.includes('/checkout/preferences/pref')) dados = { id: 'pref', collector_id: 123, external_reference: id };
            else if (url.includes('/reservas_checkout_teste?')) dados = [{ estado: 'consumida' }];
            else if (url.includes('/estornos_checkout_teste?')) dados = [];
            else throw new Error('Chamada inesperada: ' + url);
            return { ok: true, json: async () => dados };
        };
        try {
            const r = await estornar({ banco: 'https://banco.local' }, id, '123', { id, tentativa: id, valor: 5 });
            assert.equal(r.estorno.estado, 'confirmado');
            assert.equal(pedidosEstorno, confirmado ? 0 : 1);
        } finally {
            global.fetch = original;
            if (comprador === undefined) delete process.env.MERCADO_PAGO_TEST_BUYER_ID;
            else process.env.MERCADO_PAGO_TEST_BUYER_ID = comprador;
        }
    });
}
test('valor inválido é recusado antes de acessar o gateway', async () => {
    await assert.rejects(estornar({}, id, '123', { id, tentativa: id, valor: 0.001 }), /valor|tentativa/i);
});
