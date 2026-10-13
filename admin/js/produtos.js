document.addEventListener('DOMContentLoaded', Banco.executar(async () => {
    if (!await adminPronto) return;
    let produtos=await Banco.produtos();
    const tbody=document.getElementById('listaProdutos'), busca=document.getElementById('buscarProduto');
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    function renderizar() {
        const termo=busca.value.toLocaleLowerCase('pt-BR'); tbody.replaceChildren();
        produtos.filter(p=>`${p.nome} ${p.codigo} ${p.categoria} ${p.tamanho} ${p.cor}`.toLocaleLowerCase('pt-BR').includes(termo)).forEach(p=>{
            const tr=document.createElement('tr');
            tr.innerHTML=`<td>${Banco.esc(p.codigo)}</td><td>👕</td><td>${Banco.esc(p.nome)}${p.ativo ? '' : ' (oculto)'}</td><td>${Banco.esc(p.categoria)}</td><td>${Banco.esc(p.tamanho)}</td><td>${Banco.esc(p.cor)}</td><td>${Banco.moeda(p.preco)}</td><td><span class="stock ${p.disponivel<=5?'stock-danger':'stock-ok'}">${p.disponivel}</span></td><td><div class="actions"></div></td>`;
            const actions=tr.querySelector('.actions');
            [['✎','Editar',Banco.executar(async()=>{if(await Inventario.editar(p)){produtos=await Banco.produtos();renderizar();}})],['◉','Visualizar',()=>Inventario.visualizar(p)]].forEach(([txt,label,fn])=>{
                const b=document.createElement('button');b.type='button';b.className='action-button';b.textContent=txt;b.title=label;b.addEventListener('click',fn);actions.append(b);
            }); tbody.append(tr);
        });
        set('totalProdutos',new Set(produtos.map(p=>p.produto_id)).size);
        set('produtosEstoque',produtos.reduce((s,p)=>s+p.disponivel,0));
        set('estoqueBaixo',produtos.filter(p=>p.disponivel<=5).length);
        set('valorEstoque',Banco.moeda(produtos.reduce((s,p)=>s+p.preco*p.disponivel,0)));
        const count=document.querySelector('.product-count');if(count)count.textContent=`${produtos.length} variações`;
    }
    busca.addEventListener('input',renderizar);
    document.getElementById('novoProduto').addEventListener('click',()=>location.href='cadastro-produto.html');renderizar();
}));
