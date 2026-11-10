'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

async function tela(pedido, dadosIniciais = {}) {
    const elementos = new Map();
    const armazenamento = new Map(Object.entries(dadosIniciais));
    const requisicoes = [];
    const elemento = () => ({ hidden: true, textContent: '', value: '', children: [],
        eventos: {}, addEventListener(nome, fn) { this.eventos[nome] = fn; }, removeAttribute() {}, reportValidity() { return true; },
        append(e) { this.children.push(e); }, replaceChildren() { this.children = []; } });
    let iniciar;
    const document = { addEventListener: (_, fn) => { iniciar = fn; },
        getElementById: id => { if (!elementos.has(id)) elementos.set(id, elemento()); return elementos.get(id); },
        createElement: elemento };
    vm.runInNewContext(fs.readFileSync('js/resultado-teste.js', 'utf8'), {
        document, window: { confirm: () => true, DOMMaltaConfig: {}, supabase: { createClient: () => ({ auth: {
            getSession: async () => ({ data: { session: { access_token: 'teste' } } })
        } }) } }, location: { search: '?pedido=protocolo' },
        sessionStorage: { getItem: k => armazenamento.get(k), setItem: (k,v) => armazenamento.set(k,v), removeItem: k => armazenamento.delete(k) },
        crypto: { randomUUID: () => '22222222-2222-4222-8222-222222222222' }, URL, URLSearchParams,
        fetch: async (_, opcoes) => {
            const dados = JSON.parse(opcoes.body);
            requisicoes.push(dados);
            return { ok: true, json: async () => dados.acao === 'listar' ? { pedidos: [pedido] }
                : dados.acao === 'estornar' ? { ...pedido, estorno: { estado: 'confirmado' } } : pedido };
        }
    });
    iniciar();
    await new Promise(resolve => setImmediate(resolve));
    elementos.armazenamento = armazenamento;
    elementos.requisicoes = requisicoes;
    return elementos;
}

test('expiração verificada aparece no resultado e no histórico sem retomar checkout', async () => {
    const elementos = await tela({ id: 'protocolo', criado_em: new Date().toISOString(), total: 10,
        status: 'aguardando_pagamento', estado_checkout: 'expirado', checkout_url: 'https://www.mercadopago.com.br/checkout' });
    assert.match(elementos.get('statusTeste').textContent, /Checkout expirado/);
    assert.match(elementos.get('testesRecentes').children[0].children[0].textContent, /Checkout expirado/);
    assert.equal(elementos.get('retomarTeste').hidden, true);
});
test('estorno confirmado com resposta perdida permite novo estorno parcial', async () => {
    const tentativaAnterior = '11111111-1111-4111-8111-111111111111';
    const chave = 'domMaltaEstornoTeste:protocolo';
    const elementos = await tela({ id: 'protocolo', criado_em: new Date().toISOString(), total: 10,
        status: 'approved', valor_estornado: 4, estorno_consultado: { tentativa: tentativaAnterior, valor: 4, estado: 'confirmado' } },
        { [chave]: JSON.stringify({ tentativa: tentativaAnterior, valor: 4 }) });
    assert.equal(elementos.armazenamento.has(chave), false);
    elementos.get('valorEstorno').value = '2';
    await elementos.get('estornoTeste').eventos.submit({ preventDefault() {} });
    const estorno = elementos.requisicoes.find(r => r.acao === 'estornar');
    assert.equal(estorno.valor, 2);
    assert.notEqual(estorno.tentativa, tentativaAnterior);
});

test('aprovação após liberação informa conciliação sem oferecer checkout', async () => {
    const elementos = await tela({ criado_em: new Date().toISOString(), total: 10,
        status: 'approved', conciliacao: 'pagamento_apos_liberacao' });
    assert.match(elementos.get('statusTeste').textContent, /conciliação/i);
    assert.equal(elementos.get('retomarTeste').hidden, true);
});
test('falta de estoque orienta estorno e mostra valores conciliados', async () => {
    const elementos = await tela({ id: 'protocolo', criado_em: new Date().toISOString(), total: 10,
        status: 'approved', conciliacao: 'estorno_necessario', valor_estornado: 0, taxa_mp: 0.5, valor_liquido: 9.5 });
    assert.match(elementos.get('statusTeste').textContent, /estorno necessário/i);
    assert.match(elementos.get('valoresTeste').textContent, /9,50/);
    assert.equal(elementos.get('estornoTeste').hidden, false);
});
test('aprovação tardia atendida informa baixa simulada sem nova cobrança', async () => {
    const elementos = await tela({ criado_em: new Date().toISOString(), total: 10,
        status: 'approved', aprovacao_tardia: true });
    assert.match(elementos.get('statusTeste').textContent, /após o prazo.*atendido/i);
    assert.equal(elementos.get('retomarTeste').hidden, true);
});
