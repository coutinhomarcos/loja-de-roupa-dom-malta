/* Apenas IDs de variações e quantidades ficam no navegador. */
(() => {
    const chave='domMaltaCarrinhoV1';
    const pagina=new URL('../pages/carrinho.html',document.currentScript.src).href;
    function ler(){
        try{
            const dados=JSON.parse(localStorage.getItem(chave)||'[]');
            if(!Array.isArray(dados))return [];
            const itens=new Map();
            dados.slice(0,50).forEach(i=>{if(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(i.id)&&Number.isInteger(i.quantidade)&&i.quantidade>0&&i.quantidade<=999)itens.set(i.id,{id:i.id,quantidade:i.quantidade});});
            return [...itens.values()];
        }catch{return [];}
    }
    function contador(){const n=ler().reduce((s,i)=>s+i.quantidade,0);document.querySelectorAll('[data-contador-carrinho]').forEach(e=>e.textContent=`🛒 Carrinho (${n})`);}
    function salvar(itens){localStorage.setItem(chave,JSON.stringify(itens));contador();}
    window.Carrinho={ler,salvar,adicionar(id,limite){
        const itens=ler(),item=itens.find(i=>i.id===id);
        if((item?.quantidade||0)>=limite)throw new Error('Você já adicionou todas as unidades disponíveis desta variação.');
        if(!item&&itens.length>=50)throw new Error('O limite é de 50 variações por pedido.');
        if(item)item.quantidade++;else itens.push({id,quantidade:1});salvar(itens);
    }};
    document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('nav.menu').forEach(menu=>{const link=document.createElement('a');link.href=pagina;link.dataset.contadorCarrinho='';menu.append(link);});contador();});
    window.addEventListener('storage',contador);
})();
