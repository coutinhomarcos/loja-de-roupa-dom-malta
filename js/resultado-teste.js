document.addEventListener('DOMContentLoaded', () => {
    const cfg = window.DOMMaltaConfig;
    const cliente = window.supabase.createClient(cfg.url, cfg.chavePublica);
    const mensagem = document.getElementById('statusTeste');
    const lista = document.getElementById('testesRecentes');
    const campo = document.getElementById('protocoloTeste');
    const botao = document.getElementById('consultarTeste');
    const retomar = document.getElementById('retomarTeste');
    const nomes = {
        aguardando_checkout: 'Checkout ainda não confirmado', aguardando_pagamento: 'Aguardando pagamento de teste',
        approved: 'Pagamento de teste aprovado', pending: 'Pagamento de teste pendente', in_process: 'Em análise',
        rejected: 'Pagamento de teste recusado', cancelled: 'Pagamento de teste cancelado', refunded: 'Pagamento de teste devolvido',
        charged_back: 'Contestação do pagamento de teste', authorized: 'Pagamento autorizado, ainda não capturado', in_mediation: 'Em mediação'
    };
    let ocupado = false;
    async function chamada(dados) {
        const { data: { session } } = await cliente.auth.getSession();
        if (!session) throw new Error('Entre no painel de estoque desta versão de testes e depois atualize esta página.');
        const r = await fetch('/api/pagamento-teste', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(dados) });
        const data = await r.json();
        if (!r.ok) throw new Error(data.erro || 'Não foi possível consultar o teste.');
        return data;
    }
    const moeda = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    async function consultar() {
        if (ocupado) return;
        ocupado = true; botao.disabled = true; retomar.hidden = true;
        mensagem.textContent = 'Consultando diretamente no Mercado Pago…';
        try {
            const p = await chamada({ acao: 'consultar', id: campo.value.trim() });
            mensagem.textContent = (nomes[p.status] || p.status) + ' · Subtotal: ' + moeda(p.total) + '. Estoque e financeiro reais permanecem sem alterações.';
            if (p.status === 'pending') mensagem.textContent += ' Nos testes com Pix, o status pode continuar pendente. Não efetue transferência real.';
            if (p.checkout_url && ['aguardando_pagamento','pending','in_process','rejected'].includes(p.status)) {
                const u = new URL(p.checkout_url);
                if (u.protocol === 'https:' && ['www.mercadopago.com.br','sandbox.mercadopago.com.br'].includes(u.hostname)) { retomar.href = u.href; retomar.hidden = false; }
            }
        } catch (e) { mensagem.textContent = e.message; }
        finally { ocupado = false; botao.disabled = false; }
    }
    async function recentes() {
        try {
            const { pedidos } = await chamada({ acao: 'listar' });
            lista.replaceChildren();
            for (const p of pedidos) {
                const li = document.createElement('li'), b = document.createElement('button');
                b.type = 'button'; b.className = 'botao';
                b.textContent = new Date(p.criado_em).toLocaleString('pt-BR') + ' · ' + moeda(p.total) + ' · ' + (nomes[p.status] || p.status);
                b.addEventListener('click', () => { campo.value = p.id; consultar(); }); li.append(b); lista.append(li);
            }
            if (!pedidos.length) lista.textContent = 'Nenhum pedido de teste criado.';
        } catch (e) { mensagem.textContent = e.message; }
    }
    document.getElementById('formConsultaTeste').addEventListener('submit', e => { e.preventDefault(); consultar(); });
    campo.value = new URLSearchParams(location.search).get('pedido') || sessionStorage.getItem('domMaltaUltimoTeste') || '';
    // Nunca confia em status=approved ou payment_id fornecidos pela URL.
    if (campo.value) consultar();
    recentes();
});
