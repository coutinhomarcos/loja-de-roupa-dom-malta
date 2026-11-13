/* Filtros públicos: estoque disponível considera reservas e a mesma combinação. */
(function(root){
 const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function combinar(v,f){return(!f.tamanho||normal(v.tamanho)===normal(f.tamanho))&&(!f.cor||normal(v.cor)===normal(f.cor))&&(!f.disponibilidade||(f.disponibilidade==='disponivel'?Number(v.estoque)-Number(v.reservado||0)>0:Number(v.estoque)-Number(v.reservado||0)<=0));}
 function filtrar(produtos,variacoes,f={}){
  return produtos.filter(p=>{
   const texto=normal([p.nome,p.categoria,p.descricao].join(' '));if(!normal(f.busca).trim().split(/\s+/).every(t=>texto.includes(t)))return false;
   return(!f.tamanho&&!f.cor&&!f.disponibilidade)||variacoes.some(v=>v.produto_id===p.id&&combinar(v,f));
  });
 }
 const api={filtrar,combinar};if(typeof module!=='undefined')module.exports=api;else root.CatalogoFiltros=api;
})(typeof window!=='undefined'?window:globalThis);
