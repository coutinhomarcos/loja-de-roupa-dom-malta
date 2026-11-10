'use strict';

document.addEventListener('DOMContentLoaded', Banco.executar(async () => {
    if (!await adminPronto) return;

    const destino = document.querySelector('.content-body');
    if (!destino) return;

    const secao = document.createElement('section');
    secao.className = 'card';
    secao.style.marginTop = '24px';
    secao.setAttribute('aria-labelledby', 'titulo-vendas-teste');

    secao.innerHTML = `
        <h2 id="titulo-vendas-teste">Vendas simuladas — Mercado Pago</h2>
        <p>
            Ambiente de teste. Estes valores não entram nas receitas,
            no saldo ou no lucro da loja.
        </p>
        <button type="button" class="btn btn-primary"
                style="width:auto;margin:16px 0">
            Atualizar testes
        </button>
        <p role="status" aria-live="polite"></p>
        <div class="table-responsive">
            <table style="width:100%;border-collapse:collapse">
                <caption style="text-align:left;padding:12px 0">
                    Últimos 50 registros de venda simulada.
                    Taxas, estornos e líquido são snapshots informados pelo Mercado Pago.
                </caption>
                <thead>
                    <tr>
                        <th scope="col">Registrado em</th>
                        <th scope="col">Pedido</th>
                        <th scope="col">Pagamento</th>
                        <th scope="col">Valor simulado</th>
                        <th scope="col">Situação</th>
                        <th scope="col">Estornado</th>
                        <th scope="col">Taxas</th>
                        <th scope="col">Líquido informado</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    destino.append(secao);

    const botao = secao.querySelector('button');
    const mensagem = secao.querySelector('[role="status"]');
    const corpo = secao.querySelector('tbody');

    async function carregar() {
        botao.disabled = true;
        mensagem.textContent = 'Carregando vendas simuladas…';
        corpo.replaceChildren();

        try {
            const vendas = await Banco.resultado(
                Banco.client
                    .from('vendas_checkout_teste')
                    .select('pedido_id,pagamento_id,total,registrado_em,pedidos_mp_teste(status,conciliacao,valor_estornado,taxa_mp,valor_liquido)')
                    .order('registrado_em', { ascending: false })
                    .order('pedido_id', { ascending: true })
                    .limit(50)
            );

            let total = 0;

            for (const venda of vendas) {
                const linha = document.createElement('tr');
                const pedido = venda.pedidos_mp_teste || {};
                const estados = {
                    approved: 'Aprovado', refunded: 'Estornado', charged_back: 'Contestado', in_mediation: 'Em mediação'
                };
                const informado = valor => valor == null ? 'Não informado' : Banco.moeda(valor);
                const valores = [
                    new Date(venda.registrado_em).toLocaleString('pt-BR'),
                    venda.pedido_id,
                    venda.pagamento_id,
                    Banco.moeda(venda.total),
                    pedido.conciliacao === 'estorno_parcial' ? 'Estorno parcial' : estados[pedido.status] || pedido.status || 'Consultar resultado',
                    informado(pedido.valor_estornado),
                    informado(pedido.taxa_mp),
                    informado(pedido.valor_liquido)
                ];

                for (const valor of valores) {
                    const celula = document.createElement('td');
                    celula.textContent = valor;
                    celula.style.padding = '12px';
                    celula.style.borderBottom = '1px solid #e2e8f0';
                    linha.append(celula);
                }

                corpo.append(linha);
                total += Number(venda.total);
            }

            mensagem.textContent = vendas.length
                ? `${vendas.length} registro(s). Total simulado dos registros exibidos: ${Banco.moeda(total)}.`
                : 'Nenhuma venda simulada registrada para este administrador.';
        } catch (erro) {
            console.error('Falha ao carregar vendas simuladas:', erro);
            mensagem.textContent =
                'Não foi possível carregar as vendas simuladas. Clique em Atualizar testes para tentar novamente.';
        } finally {
            botao.disabled = false;
        }
    }

    botao.addEventListener('click', carregar);
    await carregar();
}));
