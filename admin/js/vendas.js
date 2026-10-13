document.addEventListener('DOMContentLoaded',Banco.executar(async()=>{
    if(!await adminPronto)return;
    let produtos=await Banco.produtos(),carrinho=[],vendaId=crypto.randomUUID(),enviando=false;
    const el=id=>document.getElementById(id),select=el('select-produto'),finish=el('btn-finish');
    function listarProdutos(){
        select.replaceChildren(new Option('Selecione um produto',''));
        produtos.filter(p=>p.ativo&&p.disponivel>0).forEach(p=>select.append(new Option(`${p.nome} — ${p.tamanho} / ${p.cor} (${p.disponivel} disponíveis)`,p.id)));
        el('preco-unit').value='0,00';
    }
    const clientes=await Banco.listar('clientes');
    clientes.forEach(c=>el('select-cliente').append(new Option(c.nome,c.codigo)));
    select.addEventListener('change',()=>{el('preco-unit').value=Number(produtos.find(p=>p.id===select.value)?.preco||0).toFixed(2).replace('.',',');});
    function renderizar(){
        el('cart-body').replaceChildren();
        carrinho.forEach((i,index)=>{
            const tr=document.createElement('tr');tr.innerHTML=`<td>${Banco.esc(i.nome)} — ${Banco.esc(i.tamanho)} / ${Banco.esc(i.cor)}</td><td>${i.qtd}</td><td>${Banco.moeda(i.preco)}</td><td>${Banco.moeda(i.preco*i.qtd)}</td><td></td>`;
            const b=document.createElement('button');b.textContent='Remover';b.disabled=enviando;b.addEventListener('click',()=>{carrinho.splice(index,1);vendaId=crypto.randomUUID();renderizar();});tr.lastElementChild.append(b);el('cart-body').append(tr);
        });
        el('total-itens').textContent=carrinho.reduce((s,i)=>s+i.qtd,0);
        el('total-valor').textContent=Banco.moeda(carrinho.reduce((s,i)=>s+i.preco*i.qtd,0));
        finish.disabled=enviando||!carrinho.length||!el('select-pagamento').value;
        el('btn-add-cart').disabled=enviando;
    }
    el('btn-add-cart').addEventListener('click',Banco.executar(()=>{
        const p=produtos.find(p=>p.id===select.value),qtd=Number(el('quantidade').value);
        if(!p||!Number.isInteger(qtd)||qtd<=0)throw new Error('Selecione um produto e quantidade inteira positiva.');
        const existe=carrinho.find(i=>i.id===p.id);
        if(qtd+(existe?.qtd||0)>p.disponivel)throw new Error('Quantidade acima do estoque disponível.');
        if(existe)existe.qtd+=qtd;else carrinho.push({...p,qtd});vendaId=crypto.randomUUID();renderizar();
    }));
    el('select-pagamento').addEventListener('change',()=>{vendaId=crypto.randomUUID();renderizar();});
    el('select-cliente').addEventListener('change',()=>vendaId=crypto.randomUUID());
    finish.addEventListener('click',async()=>{
        if(enviando||!carrinho.length)return;
        if(!confirm('O pagamento já foi recebido fora do sistema? Confirmar registra a venda e baixa o estoque.'))return;
        enviando=true;renderizar();
        try{
            const raw=el('select-pagamento').selectedOptions[0].textContent.trim();
            const metodo=/dinheiro/i.test(raw)?'Dinheiro':/pix/i.test(raw)?'Pix':/débito|debito/i.test(raw)?'Cartão de Débito':'Cartão de Crédito';
            await Banco.rpc('registrar_venda_balcao',{venda_id:vendaId,itens:carrinho.map(i=>({id:i.id,qtd:i.qtd})),metodo,cliente_id:el('select-cliente').value||null});
            carrinho=[];vendaId=crypto.randomUUID();alert('Venda registrada e estoque atualizado no Supabase.');
            produtos=await Banco.produtos();listarProdutos();el('select-pagamento').value='';
        }catch(erro){Banco.mensagem(erro);}finally{enviando=false;renderizar();}
    });listarProdutos();renderizar();
}));
