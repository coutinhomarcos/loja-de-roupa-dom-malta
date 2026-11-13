document.addEventListener('DOMContentLoaded',Banco.executar(async()=>{
    if(!await adminPronto)return;
    const [produtos,vendas,transacoes,configuracoes]=await Promise.all([Banco.produtos(),Banco.listar('vendas'),Banco.listar('transacoes'),Banco.resultado(Banco.client.from('configuracoes_loja').select('limite_estoque,aviso_estoque').eq('id',1))]);
    const cfg=configuracoes[0]||{limite_estoque:5,aviso_estoque:true};
    const hoje=CalculosLoja.dia(),resumo=CalculosLoja.resumo(vendas,transacoes,produtos);
    const valores=[CalculosLoja.resumo(vendas.filter(v=>CalculosLoja.dia(v.data)===hoje),[],[]).faturamento,resumo.faturamento,resumo.lucro,resumo.despesas];
    document.querySelectorAll('.summary-cards article strong').forEach((el,i)=>el.textContent=Banco.moeda(valores[i]));
    const semanal=document.getElementById('resumoSemanal');
    const tabela=document.createElement('table');tabela.setAttribute('aria-label','Vendas dos últimos sete dias');
    const cabecalho=document.createElement('tr');for(const texto of ['Data','Total vendido']){const th=document.createElement('th');th.textContent=texto;cabecalho.append(th);}tabela.append(cabecalho);
    for(let i=6;i>=0;i--){const data=new Date();data.setDate(data.getDate()-i);const dia=CalculosLoja.dia(data);const tr=document.createElement('tr');for(const texto of [dia.split('-').reverse().join('/'),Banco.moeda(CalculosLoja.resumo(vendas.filter(v=>CalculosLoja.dia(v.data)===dia),[],[]).faturamento)]){const td=document.createElement('td');td.textContent=texto;tr.append(td);}tabela.append(tr);}
    semanal.replaceChildren(tabela);
    const painel=document.querySelector('.dashboard-grid .panel:last-child');
    const titulos=painel?.querySelectorAll('h2');
    if(titulos?.[0]?.nextElementSibling)titulos[0].nextElementSibling.textContent=`${vendas.length} vendas registradas`;
    if(titulos?.[1]?.nextElementSibling)titulos[1].nextElementSibling.textContent=cfg.aviso_estoque?`${produtos.filter(p=>p.ativo&&p.disponivel<=cfg.limite_estoque).length} variações com estoque baixo`:'Aviso de estoque desativado nas preferências';
}));
