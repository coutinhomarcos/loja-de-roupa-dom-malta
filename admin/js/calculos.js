/* Cálculos compartilhados: valores internos em centavos, data comercial de São Paulo. */
(function(root){
 const centavos=v=>Math.round(Number(v||0)*100);
 const soma=(xs,fn)=>xs.reduce((s,x)=>s+fn(x),0);
 function dia(valor=new Date()){
  const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(valor));
  const parte=t=>partes.find(p=>p.type===t).value;return `${parte('year')}-${parte('month')}-${parte('day')}`;
 }
 function resumo(vendas,transacoes,produtos){
  const faturamento=soma(vendas,v=>centavos(v.total));
  const receitas=faturamento+soma(transacoes.filter(t=>t.tipo==='receita'),t=>centavos(t.valor));
  const despesas=soma(transacoes.filter(t=>t.tipo==='despesa'),t=>centavos(t.valor));
  const custos=soma(vendas,v=>soma(v.itens||[],i=>centavos(i.custoUnit)*Number(i.qtd)));
  const ajustes=soma(transacoes.filter(t=>t.origem==='checkout'&&t.tipo==='despesa'),t=>centavos(t.valor));
  const previsto=soma(produtos.filter(p=>p.ativo!==false),p=>(centavos(p.preco)-centavos(p.custo))*Math.max(0,Number(p.disponivel)));
  return{receitas:receitas/100,despesas:despesas/100,saldo:(receitas-despesas)/100,lucro:(faturamento-custos-ajustes)/100,previsto:previsto/100,faturamento:faturamento/100};
 }
 const api={resumo,dia};if(typeof module!=='undefined')module.exports=api;else root.CalculosLoja=api;
})(typeof window!=='undefined'?window:globalThis);
