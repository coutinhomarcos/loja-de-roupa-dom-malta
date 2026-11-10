'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { consultar } = require('../lib/pagamento-teste').interno;
const id = '11111111-1111-4111-8111-111111111111';

for (const status of ['approved', 'refunded', 'charged_back', 'cancelled']) {
    test(status + ': concilia reserva encerrada sem nova baixa', async () => {
        const original = global.fetch;
        const comprador = process.env.MERCADO_PAGO_TEST_BUYER_ID;
        process.env.MERCADO_PAGO_TEST_BUYER_ID = '456';
        const chamadas = [];
        const pedido = { id, admin_id: id, vendedor_id: '123', preferencia_id: 'pref',
            pagamento_id: null, status: 'aguardando_pagamento', total: 10 };
        global.fetch = async (url, opcoes) => {
            chamadas.push(url);
            let dados;
            if (url.includes('/payments/search')) dados = { results: [{ id: '789', status }], paging: { total: 1 } };
            else if (url.includes('/payments/789')) dados = { id: '789', status, payer: { id: '456' }, collector_id: '123', external_reference: id, currency_id: 'BRL', transaction_amount: 10,
                date_last_updated: '2026-11-09T12:00:00Z', transaction_amount_refunded: status === 'refunded' ? 10 : 0,
                fee_details: [{ amount: 0.5 }], transaction_details: { net_received_amount: 9.5 } };
            else if (url.includes('/checkout/preferences/')) dados = { id: 'pref', collector_id: '123', external_reference: id };
            else if (url.includes('/reservas_checkout_teste?')) dados = [{ estado: 'expirada' }];
            else if (url.includes('/estornos_checkout_teste?')) dados = [];
            else if (url.includes('/rpc/liberar_reserva_teste')) dados = { reservas_liberadas: 0 };
            else if (url.includes('/rpc/conciliar_pagamento_teste')) {
                const snapshot = JSON.parse(opcoes.body).p_pagamento;
                assert.equal(snapshot.taxa, 0.5);
                assert.equal(snapshot.liquido, 9.5);
                assert.equal(snapshot.estornado, status === 'refunded' ? 10 : 0);
                dados = { id, status, pagamento_id: '789', conciliacao: status === 'approved' ? 'estorno_necessario' : 'reversao_pagamento' };
            }
            else if (url.includes('/pedidos_mp_teste?')) {
                assert.notEqual(opcoes.method, 'PATCH', 'O status deve ser atualizado dentro da conciliação atômica');
                dados = [pedido];
            }
            else throw new Error('Chamada inesperada: ' + url);
            return { ok: true, json: async () => dados };
        };
        try {
            const resultado = await consultar({ banco: 'https://banco.local', chave: 'teste', token: 'teste' }, id, '123', { id });
            assert.equal(resultado.status, status);
            assert.equal(chamadas.some(url => url.includes('confirmar_venda_teste')), false);
            if (status === 'approved') assert.equal(resultado.conciliacao, 'estorno_necessario');
            assert.equal(chamadas.filter(url => url.includes('rpc/conciliar_pagamento_teste')).length, 1);
        } finally {
            global.fetch = original;
            if (comprador === undefined) delete process.env.MERCADO_PAGO_TEST_BUYER_ID;
            else process.env.MERCADO_PAGO_TEST_BUYER_ID = comprador;
        }
    });
}
