(function(root){
    function pagina(pecas,categoria,indice,quantidade=6){
        const lista=categoria==='todas'?pecas:pecas.filter(p=>p.categoria===categoria);
        const paginas=Math.ceil(lista.length/quantidade);
        indice=indice>=0&&indice<paginas?indice:0;
        return{itens:lista.slice(indice*quantidade,(indice+1)*quantidade),total:lista.length,paginas,indice,
            de:lista.length?indice*quantidade+1:0,ate:Math.min((indice+1)*quantidade,lista.length)};
    }
    const api={pagina,avancar:(indice,paginas,sentido)=>paginas?(indice+sentido+paginas)%paginas:0};
    if(typeof module!=='undefined')module.exports=api;
    else root.AraraNavegacao=api;
})(typeof window!=='undefined'?window:globalThis);
