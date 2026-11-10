'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { snapshotPagamento } = require('../lib/pagamento-teste').interno;
const pagamento = { id: 123, status: 'approved', transaction_amount: 20,
    transaction_amount_refunded: 0, date_last_updated: '2026-11-09T12:00:00Z' };
test('não inventa taxa nem líquido quando o gateway não informa', () => {
    const p = snapshotPagamento(pagamento);
    assert.equal(p.taxa, null);
    assert.equal(p.liquido, null);
});
test('recusa estorno acima do total e atualização inválida', () => {
    assert.throws(() => snapshotPagamento({ ...pagamento, transaction_amount_refunded: 21 }), /estornado/);
    assert.throws(() => snapshotPagamento({ ...pagamento, date_last_updated: 'invalida' }), /atualização/);
    assert.throws(() => snapshotPagamento({ ...pagamento, transaction_amount_refunded: undefined }), /estornado/);
});
test('soma taxas em centavos e conserva o estorno acumulado', () => {
    const p = snapshotPagamento({ ...pagamento, fee_details: [{ amount: 0.1 }, { amount: 0.2 }], transaction_amount_refunded: 5 });
    assert.equal(p.taxa, 0.3);
    assert.equal(p.estornado, 5);
});
