document.addEventListener('DOMContentLoaded', () => {
    const cfg = window.DOMMaltaConfig;
    const cliente = window.supabase.createClient(cfg.url, cfg.chavePublica);
    const mensagem = document.getElementById('statusTeste');
    const lista = document.getElementById('testesRecentes');
    const campo = document.getElementById('protocoloTeste');
    const botao = document.getElementById('consultarTeste');
    const retomar = document.getElementById('retomarTeste');
    const valores = document.getElementById('valoresTeste');
    const formEstorno = document.getElementById('estornoTeste');
    const valorEstorno = document.getElementById('valorEstorno');
    const botaoEstorno = document.getElementById('solicitarEstorno');
    const mensagemEstorno = document.getElementById('mensagemEstorno');
    let ultimoPedido = null;
    const nomes = {
        aguardando_checkout: 'Checkout ainda não confirmado', aguardando_pagamento: 'Aguardando pagamento de teste',
        approved: 'Pagamento de teste aprovado', pending: 'Pagamento de teste pendente', in_process: 'Em análise',
        rejected: 'Pagamento de teste recusado', cancelled: 'Pagamento de teste cancelado', refunded: 'Pagamento de teste devolvido',
        charged_back: 'Contestação do pagamento de teste', authorized: 'Pagamento autorizado, ainda não capturado', in_mediation: 'Em mediação'
    };
    function descricaoPedido(p) {
        if (p.conciliacao === 'pagamento_apos_liberacao') return 'Pagamento aprovado após liberação da reserva. Exige conciliação; nenhuma baixa adicional foi realizada';
        if (p.conciliacao === 'estorno_necessario') return 'Pagamento de teste aprovado, sem atendimento. Estorno necessário';
        if (p.conciliacao === 'estorno_parcial') return 'Pagamento de teste com estorno parcial';
        if (p.conciliacao === 'reversao_pagamento') return 'Pagamento de teste estornado';
        if (p.conciliacao === 'contestacao') return 'Pagamento de teste contestado. Conferência necessária';
        if (p.conciliacao === 'contestacao_em_analise') return 'Contestação em análise no Mercado Pago';
        if (p.estado_checkout === 'expirado') return 'Checkout expirado';
        if (p.estado_checkout === 'criacao_pendente') return 'Criação do checkout sem confirmação. Consulte novamente antes de criar outro pedido';
        if (p.aprovacao_tardia && p.status === 'approved') return 'Pagamento aprovado após o prazo. Pedido atendido no estoque simulado';
        return nomes[p.status] || p.status;
    }
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

        ocupado = true;
        botao.disabled = true;
        campo.disabled = true;
        ultimoPedido = null;
        formEstorno.hidden = true;
        valores.textContent = '';
        retomar.hidden = true;
        retomar.removeAttribute('href');
        mensagem.textContent = 'Consultando diretamente no Mercado Pago…';

        try {
            const chaveEstorno = 'domMaltaEstornoTeste:' + campo.value.trim();
            let tentativaLocal = null;
            try { tentativaLocal = JSON.parse(sessionStorage.getItem(chaveEstorno) || 'null'); } catch { sessionStorage.removeItem(chaveEstorno); }
            const p = await chamada({
                acao: 'consultar',
                id: campo.value.trim(),
                tentativa_estorno: tentativaLocal?.tentativa
            });
            if (p.estorno_consultado?.estado === 'confirmado') {
                sessionStorage.removeItem(chaveEstorno);
                tentativaLocal = null;
            }
            const pendente = p.estorno_pendente || tentativaLocal;
            if (pendente) p.estorno_pendente = pendente;
            ultimoPedido = p;
            const informado = v => v == null ? 'não informado' : moeda(v);
            valores.textContent = 'Valores de teste · Pago: ' + moeda(p.total)
                + ' · Estornado: ' + moeda(p.valor_estornado || 0)
                + ' · Taxas informadas: ' + informado(p.taxa_mp)
                + ' · Líquido informado pelo Mercado Pago: ' + informado(p.valor_liquido);
            const saldo = Math.max(0, Math.round((Number(p.total) - Number(p.valor_estornado || 0)) * 100)) / 100;
            formEstorno.hidden = !(pendente || (p.status === 'approved' && saldo > 0));
            valorEstorno.value = Number(p.estorno_pendente?.valor ?? saldo).toFixed(2);
            valorEstorno.max = String(p.estorno_pendente?.valor ?? saldo);
            valorEstorno.readOnly = !!p.estorno_pendente;
            botaoEstorno.textContent = p.estorno_pendente ? 'Retomar estorno de teste' : 'Solicitar estorno de teste';
            mensagemEstorno.textContent = p.estorno_pendente
                ? 'Existe uma tentativa sem confirmação. Retomar usa a mesma solicitação, sem duplicar o estorno.'
                : 'Informe o valor a devolver. Peças já baixadas não serão repostas automaticamente.';

            const prazo = p.prazo_checkout;
            const reserva = prazo?.reserva;

            const reservaExpirada =
                p.estado_checkout === 'expirado'
                || reserva?.estado === 'expirada';

            const vencimento = Date.parse(prazo?.expiration_date_to);

            const checkoutVencido =
                prazo?.expires === true
                && Number.isFinite(vencimento)
                && vencimento <= Date.now();

            let descricao = descricaoPedido(p);

            if (reservaExpirada) {
                descricao = 'Checkout expirado. '
                    + 'A reserva foi liberada';
            } else if (
                checkoutVencido
                && p.status === 'aguardando_pagamento'
            ) {
                descricao = 'Checkout expirado. '
                    + 'Liberação da reserva ainda não confirmada';
            }

            mensagem.textContent =
                descricao
                + ' · Subtotal: ' + moeda(p.total)
                + '. Estoque e financeiro reais permanecem sem alterações.';

            if (p.status === 'pending') {
                mensagem.textContent +=
                    ' Nos testes com Pix, o status pode continuar pendente. '
                    + 'Não efetue transferência real.';
            }
            if (['reversao_pagamento', 'estorno_parcial', 'contestacao', 'contestacao_em_analise'].includes(p.conciliacao)) {
                mensagem.textContent += ' Confira a reversão e a devolução das peças antes de repor estoque.';
            }

            if (
                !checkoutVencido
                && !reservaExpirada
                && p.checkout_url
                && [
                    'aguardando_pagamento',
                    'pending',
                    'in_process',
                    'rejected'
                ].includes(p.status)
            ) {
                const u = new URL(p.checkout_url);

                if (
                    u.protocol === 'https:'
                    && [
                        'www.mercadopago.com.br',
                        'sandbox.mercadopago.com.br'
                    ].includes(u.hostname)
                    && !u.username
                    && !u.password
                ) {
                    retomar.href = u.href;
                    retomar.hidden = false;
                }
            }
            await recentes();
        } catch (e) {
            mensagem.textContent = e.message;
        } finally {
            ocupado = false;
            botao.disabled = false;
            campo.disabled = false;
        }
    }
    formEstorno.addEventListener('submit', async evento => {
        evento.preventDefault();
        if (ocupado || !ultimoPedido || !formEstorno.reportValidity()) return;
        const pedido = ultimoPedido;
        const valor = Number(valorEstorno.value);
        if (!window.confirm('Confirmar estorno de TESTE de ' + moeda(valor) + '?')) return;
        const chave = 'domMaltaEstornoTeste:' + pedido.id;
        let tentativa = pedido.estorno_pendente;
        try { tentativa ||= JSON.parse(sessionStorage.getItem(chave) || 'null'); } catch { /* O servidor mantém a tentativa pendente. */ }
        if (tentativa && Number(tentativa.valor) !== valor) {
            mensagemEstorno.textContent = 'Consulte o resultado e retome a tentativa anterior antes de alterar o valor.';
            return;
        }
        tentativa ||= { tentativa: crypto.randomUUID(), valor };
        sessionStorage.setItem(chave, JSON.stringify(tentativa));
        ocupado = true;
        formEstorno.inert = true;
        botao.disabled = true;
        campo.disabled = true;
        mensagemEstorno.textContent = 'Solicitando estorno de teste…';
        let aviso;
        try {
            const r = await chamada({ acao: 'estornar', id: pedido.id, tentativa: tentativa.tentativa, valor });
            if (r.estorno?.estado !== 'confirmado') throw new Error('Estorno ainda sem confirmação.');
            sessionStorage.removeItem(chave);
            aviso = 'Estorno de teste confirmado pelo Mercado Pago. A atualização dos valores pode levar alguns instantes.';
        } catch (erro) {
            aviso = erro.message + ' A tentativa foi preservada; consulte antes de repetir.';
        } finally {
            ocupado = false;
            formEstorno.inert = false;
            botao.disabled = false;
            campo.disabled = false;
        }
        await consultar();
        mensagem.textContent += ' ' + aviso;
    });
    async function recentes() {
        try {
            const { pedidos } = await chamada({ acao: 'listar' });
            lista.replaceChildren();
            for (const p of pedidos) {
                const li = document.createElement('li'), b = document.createElement('button');
                b.type = 'button'; b.className = 'botao';
                b.textContent = new Date(p.criado_em).toLocaleString('pt-BR') + ' · ' + moeda(p.total) + ' · ' + descricaoPedido(p);
                b.addEventListener('click', () => { if (ocupado) return; campo.value = p.id; consultar(); }); li.append(b); lista.append(li);
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
