/* Fonte pública compartilhada pela Coleção e pela arara. Nunca usa chave privada. */
(function(root){
    const normal=valor=>String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    function categoria(valor,nome=''){
        const texto=normal(valor||nome);
        if(texto.includes('calc'))return{aba:'calcas',etiqueta:'Calça'};
        if(texto.includes('bermuda'))return{aba:'bermudas',etiqueta:'Bermuda'};
        if(texto.includes('camiset'))return{aba:'camisas',etiqueta:'Camiseta'};
        if(texto.includes('camis'))return{aba:'camisas',etiqueta:'Camisa'};
        return{aba:'outros',etiqueta:String(valor||'Roupa')};
    }
    async function carregar(cfg,fetcher=fetch){
        if(!cfg?.url||!cfg.chavePublica)throw new Error('Configuração do catálogo indisponível.');
        async function tabela(nome,select,filtros=''){
            const todos=[];
            for(let offset=0;;offset+=500){
                const url=new URL('/rest/v1/'+nome,cfg.url);
                url.searchParams.set('select',select);url.searchParams.set('limit','500');url.searchParams.set('offset',String(offset));
                url.searchParams.set('order',nome==='produtos'?'criado_em.desc,id.asc':'id.asc');
                if(filtros)url.searchParams.set('ativo','eq.true');
                const r=await fetcher(url.href,{headers:{apikey:cfg.chavePublica},signal:AbortSignal.timeout(12000)});
                if(!r.ok)throw new Error('Não foi possível consultar o catálogo.');
                const linhas=await r.json();if(!Array.isArray(linhas))throw new Error('Resposta inválida do catálogo.');
                todos.push(...linhas);if(linhas.length<500)return todos;
            }
        }
        const [produtos,variacoes]=await Promise.all([
            tabela('produtos','id,nome,categoria,descricao,imagem_url,preco,criado_em','ativo'),
            tabela('produto_variacoes','id,produto_id,tamanho,cor,estoque,reservado'),
        ]);
        return{produtos,variacoes};
    }
    function pecasArara({produtos,variacoes}){
        return produtos.filter(p=>{
            if(p.ativo===false||!p.imagem_url)return false;
            try{return /^https?:$/.test(new URL(p.imagem_url,'http://localhost').protocol);}catch{return false;}
        }).map(p=>{
            const vars=variacoes.filter(v=>v.produto_id===p.id),c=categoria(p.categoria,p.nome);
            return{id:p.id,name:p.nome,image:p.imagem_url,tag:c.etiqueta,categoria:c.aba,
                description:p.descricao||'Confira cores, tamanhos e disponibilidade abaixo.',
                details:[...(p.demonstracao?['DADOS DE TESTE · sem compra']:[]),'Categoria: '+c.etiqueta,...vars.map(v=>{
                    const n=Math.max(0,Number(v.estoque)-Number(v.reservado||0));
                    return`${v.tamanho} / ${v.cor} — ${n>0?n+' disponíveis':'esgotado'}`;
                })],
            };
        });
    }
    let pendente=null,ultimo=0;
    function obter(force=false){
        if(!force&&pendente&&Date.now()-ultimo<15000)return pendente;
        ultimo=Date.now();pendente=carregar(root.DOMMaltaConfig).then(dados=>{
            if(root.DOMMaltaExemplos){dados.produtos.push(...root.DOMMaltaExemplos.produtos);dados.variacoes.push(...root.DOMMaltaExemplos.variacoes);}
            return dados;
        }).catch(e=>{pendente=null;throw e;});return pendente;
    }
    const api={categoria,carregar,pecasArara,obter};
    if(typeof module!=='undefined')module.exports=api;
    root.CatalogoLoja=api;
    root.addEventListener?.('storage',e=>{if(e.key==='domMaltaCatalogoAtualizado'){pendente=null;root.dispatchEvent(new Event('catalogo:atualizado'));}});
})(typeof window!=='undefined'?window:globalThis);

