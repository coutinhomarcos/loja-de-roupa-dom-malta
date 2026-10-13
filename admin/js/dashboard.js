document.addEventListener('DOMContentLoaded',Banco.executar(async()=>{
    if(!await adminPronto)return;
    const [produtos,vendas,transacoes]=await Promise.all([Banco.produtos(),Banco.listar('vendas'),Banco.listar('transacoes')]);
    const hoje=new Date().toLocaleDateString('pt-BR');
    const receitas=vendas.reduce((s,v)=>s+Number(v.total),0)+transacoes.filter(t=>t.tipo==='receita').reduce((s,t)=>s+Number(t.valor),0);
    const despesas=transacoes.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+Number(t.valor),0);
    const valores=[vendas.filter(v=>new Date(v.data).toLocaleDateString('pt-BR')===hoje).reduce((s,v)=>s+Number(v.total),0),vendas.reduce((s,v)=>s+Number(v.total),0),receitas-despesas,despesas];
    document.querySelectorAll('.summary-cards article strong').forEach((el,i)=>el.textContent=Banco.moeda(valores[i]));
    const painel=document.querySelector('.dashboard-grid .panel:last-child');
    const titulos=painel?.querySelectorAll('h2');
    if(titulos?.[0]?.nextElementSibling)titulos[0].nextElementSibling.textContent=`${vendas.length} vendas registradas`;
    if(titulos?.[1]?.nextElementSibling)titulos[1].nextElementSibling.textContent=`${produtos.filter(p=>p.disponivel<=5).length} variações com estoque baixo`;
}));
