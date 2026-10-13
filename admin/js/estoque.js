window.registrarEntrada = () => { location.href='cadastro-produto.html'; };
document.addEventListener('DOMContentLoaded', Banco.executar(async()=>{
    if(!await adminPronto)return;
    let produtos=await Banco.produtos();
    const tbody=document.getElementById('stockTable'),busca=document.getElementById('searchStock');
    function renderizar(){
        tbody.replaceChildren();const termo=busca.value.toLocaleLowerCase('pt-BR');
        produtos.filter(p=>`${p.nome} ${p.codigo} ${p.categoria} ${p.tamanho} ${p.cor}`.toLocaleLowerCase('pt-BR').includes(termo)).forEach(p=>{
            const tr=document.createElement('tr'),status=p.disponivel<=0?'Crítico':p.disponivel<=5?'Atenção':'OK';
            tr.innerHTML=`<td>${Banco.esc(p.codigo)}</td><td>${Banco.esc(p.nome)}</td><td>${Banco.esc(p.categoria)}</td><td>${Banco.esc(p.tamanho)}</td><td>${Banco.esc(p.cor)}</td><td title="Físico: ${p.estoque}; reservado: ${p.reservado}"><strong>${p.disponivel}</strong></td><td>5</td><td>${status}</td><td></td>`;
            const td=tr.lastElementChild;
            const editar=document.createElement('button');editar.textContent='✏️';editar.title='Editar estoque';editar.addEventListener('click',Banco.executar(async()=>{if(await Inventario.editar(p)){produtos=await Banco.produtos();renderizar();}}));td.append(editar);
            const ocultar=document.createElement('button');ocultar.textContent=p.ativo?'Ocultar':'Exibir';ocultar.title='Visibilidade de todo o produto no site';
            ocultar.addEventListener('click',Banco.executar(async()=>{
                if(!confirm(`${p.ativo?'Ocultar':'Exibir'} ${p.nome} e todas as suas variações no site?`))return;
                await Banco.atualizar('produtos',{ativo:!p.ativo},'id',p.produto_id);produtos=await Banco.produtos();renderizar();
            }));td.append(ocultar);tbody.append(tr);
        });
        for(const [id,v]of Object.entries({totalProdutosEstoque:new Set(produtos.map(p=>p.produto_id)).size,estoqueDisponivel:produtos.reduce((s,p)=>s+p.disponivel,0),estoqueBaixo:produtos.filter(p=>p.disponivel>0&&p.disponivel<=5).length,produtosEsgotados:produtos.filter(p=>p.disponivel<=0).length}))document.getElementById(id).textContent=v;
    }
    busca.addEventListener('input',renderizar);renderizar();
}));
