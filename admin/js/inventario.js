/* Funções comuns às telas de Produtos e Estoque. */
window.Inventario = {
    async editar(p) {
        const dados={};
        for (const [campo,label] of [['nome','Nome (comum a todas as variações)'],['categoria','Categoria'],['tamanho','Tamanho desta variação'],['cor','Cor desta variação'],['custo','Custo (comum a todas as variações)'],['preco','Preço (comum a todas as variações)'],['estoque','Quantidade física desta variação']]) {
            const valor=prompt(label, p[campo]); if(valor===null) return false;
            dados[campo]=['custo','preco','estoque'].includes(campo) ? Number(valor.replace(',','.')) : valor.trim();
        }
        if (!dados.nome || !dados.categoria || !dados.tamanho || !dados.cor ||
            !Number.isFinite(dados.custo) || dados.custo < 0 || !Number.isFinite(dados.preco) || dados.preco < 0 ||
            !Number.isInteger(dados.estoque) || dados.estoque < p.reservado) throw new Error('Verifique os dados. O estoque deve cobrir as peças reservadas.');
        await Banco.rpc('editar_variacao',{variacao:p.id,dados}); return true;
    },
    visualizar(p) {
        alert(`${p.nome}\n${p.tamanho} / ${p.cor}\nEstoque físico: ${p.estoque}\nDisponível: ${p.disponivel}\nReservado: ${p.reservado}\nPreço: ${Banco.moeda(p.preco)}`);
    }
};
