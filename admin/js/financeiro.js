document.addEventListener('DOMContentLoaded',Banco.executar(async()=>{
    if(!await adminPronto)return;
    const el=id=>document.getElementById(id),form=el('form-financeiro');
    let transacoes=await Banco.listar('transacoes');
    const [vendas,produtos]=await Promise.all([Banco.listar('vendas'),Banco.produtos()]);
    const dataHoje=()=>new Date().toLocaleDateString('en-CA');
    el('data-transacao').value=dataHoje();
    function renderizar(){
        const receitas=vendas.reduce((s,v)=>s+Number(v.total),0)+transacoes.filter(t=>t.tipo==='receita').reduce((s,t)=>s+Number(t.valor),0);
        const despesas=transacoes.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+Number(t.valor),0);
        const lucro=vendas.reduce((s,v)=>s+Number(v.total)-(v.itens||[]).reduce((a,i)=>a+Number(i.custoUnit)*i.qtd,0),0);
        const previsto=produtos.reduce((s,p)=>s+(p.preco-p.custo)*p.disponivel,0);
        for(const[id,v]of Object.entries({'total-receita':receitas,'total-despesa':despesas,'saldo-total':receitas-despesas,'lucro-realizado':lucro,'lucro-previsto':previsto})){if(el(id))el(id).textContent=Banco.moeda(v);}
        const tbody=document.querySelector('#tabela-financeiro tbody');tbody.replaceChildren();
        const linhas=[...transacoes,...vendas.map(v=>({data:v.data.slice(0,10),descricao:'Venda de balcão',categoria:'Vendas',tipo:'receita',valor:v.total,origem:'venda'}))].sort((a,b)=>b.data.localeCompare(a.data));
        for(const t of linhas){
            const tr=document.createElement('tr');tr.innerHTML=`<td>${Banco.esc(t.data.split('-').reverse().join('/'))}</td><td>${Banco.esc(t.descricao)}</td><td>${Banco.esc(t.categoria)}</td><td>${Banco.esc(t.tipo)}</td><td>${Banco.moeda(t.valor)}</td><td></td>`;
            if(t.origem==='manual'){
                const b=document.createElement('button');b.textContent='Excluir';b.addEventListener('click',Banco.executar(async()=>{
                    if(!confirm('Excluir este lançamento manual?'))return;await Banco.excluir('transacoes','id',t.id);transacoes=await Banco.listar('transacoes');renderizar();
                }));tr.lastElementChild.append(b);
            }else tr.lastElementChild.textContent='Automático';tbody.append(tr);
        }
    }
    form.addEventListener('submit',async e=>{
        e.preventDefault();const btn=form.querySelector('[type="submit"]');btn.disabled=true;
        try{
            const valor=Number(el('valor-transacao').value);
            if(!Number.isFinite(valor)||valor<=0||!el('descricao-transacao').value.trim())throw new Error('Informe descrição e valor positivo.');
            await Banco.salvar('transacoes',{id:crypto.randomUUID(),tipo:el('tipo-transacao').value,descricao:el('descricao-transacao').value.trim(),valor,categoria:el('categoria-transacao').value,data:el('data-transacao').value,origem:'manual'});
            transacoes=await Banco.listar('transacoes');renderizar();form.reset();el('data-transacao').value=dataHoje();
        }catch(erro){Banco.mensagem(erro);}finally{btn.disabled=false;}
    });renderizar();
}));
