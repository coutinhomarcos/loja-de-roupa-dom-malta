'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recuperarCheckout, associarCheckout } = require('../lib/pagamento-teste').interno;
const id = '11111111-1111-4111-8111-111111111111';

test('recupera preferência existente após resposta perdida, sem criar outra', async () => {
    const original = global.fetch;
    const chamadas = [];
    const pedido = { id, preferencia_id: null, status: 'aguardando_checkout', criacao_iniciada: true,
        itens: [{ variacao_id: id, quantidade: 2, preco: 10 }] };
    global.fetch = async (url, opcoes) => {
        chamadas.push({ url, opcoes });
        let dados;
        if (url.includes('/preferences/search')) dados = { total: 1, elements: [{ id: 'pref' }] };
        else if (url.includes('/preferences/pref')) dados = { id: 'pref', collector_id: 123, external_reference: id,
            items: [{ id, quantity: 2, unit_price: 10, currency_id: 'BRL' }], expires: true,
            expiration_date_to: '2026-11-09T13:00:00Z', init_point: 'https://www.mercadopago.com.br/checkout' };
        else if (url.includes('/reservas_checkout_teste?')) dados = [{ expira_em: '2026-11-09T13:00:00Z' }];
        else if (url.includes('/pedidos_mp_teste?')) dados = [{ ...pedido, ...JSON.parse(opcoes.body) }];
        else throw new Error('Chamada inesperada');
        return { ok: true, json: async () => dados };
    };
    try {
        await recuperarCheckout({ banco: 'https://banco.local' }, pedido, id, '123');
        assert.equal(pedido.preferencia_id, 'pref');
        assert.equal(chamadas.some(c => c.url.endsWith('/checkout/preferences') && c.opcoes.method === 'POST'), false);
        assert.equal(chamadas.filter(c => c.opcoes.method === 'PATCH').length, 1);
    } finally { global.fetch = original; }
});
test('resposta atrasada da criação preserva pagamento já conciliado', async () => {
    const original = global.fetch;
    let gravacoes = 0;
    global.fetch = async (url, opcoes) => {
        if (opcoes.method === 'PATCH') {
            gravacoes++;
            assert.match(url, /preferencia_id=is.null/);
            assert.match(url, /status=eq.aguardando_checkout/);
            return { ok: true, json: async () => [] };
        }
        return { ok: true, json: async () => [{ id, preferencia_id: 'pref', checkout_url: 'https://www.mercadopago.com.br/checkout', status: 'approved' }] };
    };
    try {
        const pedido = { id };
        await associarCheckout({ banco: 'https://banco.local' }, pedido, id,
            { preferencia_id: 'pref', checkout_url: 'https://www.mercadopago.com.br/checkout', status: 'aguardando_pagamento' });
        assert.equal(pedido.status, 'approved');
        assert.equal(gravacoes, 1);
    } finally { global.fetch = original; }
});
test('resultado de busca incompleto não permite associar checkout', async () => {
    const original = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => ({ total: 2, elements: [{ id: 'pref' }] }) });
    try {
        await assert.rejects(recuperarCheckout({ banco: 'https://banco.local' }, { id }, id, '123'), /conciliação|inconsistente/i);
    } finally { global.fetch = original; }
});
