document.addEventListener('DOMContentLoaded',Banco.executar(async()=>{
    if(!await adminPronto)return;
    const el=id=>document.getElementById(id);
    const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    function csv(nome,colunas,linhas){
        const campo=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
        const texto='\uFEFF'+[colunas,...linhas].map(l=>l.map(campo).join(';')).join('\r\n');
        const url=URL.createObjectURL(new Blob([texto],{type:'text/csv;charset=utf-8'}));
        const a=document.createElement('a');a.href=url;a.download=nome+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function periodo(inicio,fim){if(inicio>fim)throw new Error('O início deve ser anterior ao fim.');}
    el('form-relatorio-vendas').addEventListener('submit',Banco.executar(async e=>{
        e.preventDefault();const inicio=el('vendas-inicio').value,fim=el('vendas-fim').value;periodo(inicio,fim);
        const metodo=el('vendas-metodo').value,vendas=await Banco.listar('vendas');
        const lista=vendas.filter(v=>{const d=new Date(v.data).toLocaleDateString('en-CA');return d>=inicio&&d<=fim&&(metodo==='todos'||(metodo==='cartao'?normal(v.pagamento).includes('cartao'):normal(v.pagamento)===metodo));});
        csv('vendas',['Data','Pagamento','Total'],lista.map(v=>[new Date(v.data).toLocaleString('pt-BR'),v.pagamento,v.total]));
    }));
    const produtos=await Banco.produtos(),categorias=el('estoque-categoria');categorias.replaceChildren(new Option('Todas as categorias','todas'));
    [...new Set(produtos.map(p=>p.categoria))].forEach(c=>categorias.append(new Option(c,c)));
    el('form-relatorio-estoque').addEventListener('submit',Banco.executar(async e=>{
        e.preventDefault();const ps=await Banco.produtos(),status=el('estoque-status').value,categoria=categorias.value;
        const lista=ps.filter(p=>(categoria==='todas'||p.categoria===categoria)&&(status==='todos'||(status==='esgotado'?p.disponivel===0:p.disponivel>0&&p.disponivel<=5)));
        csv('estoque',['Código','Nome','Categoria','Tamanho','Cor','Físico','Reservado','Disponível','Preço','Custo'],lista.map(p=>[p.codigo,p.nome,p.categoria,p.tamanho,p.cor,p.estoque,p.reservado,p.disponivel,p.preco,p.custo]));
    }));
    el('form-relatorio-financeiro').addEventListener('submit',Banco.executar(async e=>{
        e.preventDefault();const inicio=el('fin-inicio').value,fim=el('fin-fim').value;periodo(inicio,fim);
        const tipo=el('fin-tipo').value,[ts,vs]=await Promise.all([Banco.listar('transacoes'),Banco.listar('vendas')]);
        const lista=[...ts,...vs.map(v=>({data:new Date(v.data).toLocaleDateString('en-CA'),tipo:'receita',descricao:'Venda de balcão',valor:v.total}))].filter(t=>t.data.slice(0,7)>=inicio&&t.data.slice(0,7)<=fim&&(tipo==='todos'||tipo===t.tipo));
        csv('financeiro',['Data','Tipo','Descrição','Valor'],lista.map(t=>[t.data,t.tipo,t.descricao,t.valor]));
    }));
}));
