/* A coleção consulta o mesmo banco do painel, usando apenas leitura pública. */
document.addEventListener('DOMContentLoaded',async()=>{
    const aviso=document.getElementById('avisoCatalogo');
    const cfg=window.DOMMaltaConfig;
    const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    try{
        if(!window.supabase)throw new Error('Conexão indisponível');
        const banco=window.supabase.createClient(cfg.url,cfg.chavePublica,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
        const pResult=await banco.from('produtos').select('id,nome,categoria,descricao,imagem_url,preco').eq('ativo',true);
        if(pResult.error)throw pResult.error;
        const vResult=await banco.from('produto_variacoes').select('id,produto_id,tamanho,cor,estoque,reservado');
        if(vResult.error)throw vResult.error;
        const produtos=pResult.data,vs=vResult.data;
        // As fotos originais continuam disponíveis em um mostruário separado.
        // As ofertas vendáveis são somente as cadastradas no banco.
        if(!produtos.length){aviso.textContent='Nenhum produto cadastrado para venda. As fotos abaixo são o mostruário da loja; consulte disponibilidade pelo contato.';return;}
        aviso.textContent='Escolha tamanho e cor para consultar a disponibilidade. A solicitação será enviada pela página de contato.';
        const mostra=document.getElementById('catalogoBanco');
        produtos.forEach(p=>{
            const vars=vs.filter(v=>v.produto_id===p.id),card=document.createElement('article');card.className='produto';
            const categoria=normal(p.categoria);
            const destino=categoria.includes('calc')?'calcas':categoria.includes('bermuda')?'bermudas':categoria.includes('camis')?'camisas':'outros';
            const secao=mostra.querySelector(`[data-categoria="${destino}"]`);secao.hidden=false;secao.id='disponiveis_'+destino;
            const atalho=document.querySelector('.categorias-atalhos a[href="#'+destino+'"]');if(atalho)atalho.href='#disponiveis_'+destino;
            const img=document.createElement('img');
            const src=p.imagem_url||'../images/logo-dom-malta-atendimento-hd.jpg';
            const url=new URL(src,location.href);
            img.src=(url.protocol==='https:'||url.protocol==='http:'||/^data:image\/(jpeg|png|webp);base64,/.test(src))?src:'../images/logo-dom-malta-atendimento-hd.jpg';
            img.alt=p.nome;img.loading='lazy';
            const ampliar=document.createElement('button');ampliar.className='produto-imagem';ampliar.type='button';ampliar.setAttribute('aria-label','Ampliar '+p.nome);ampliar.append(img);
            ampliar.addEventListener('click',()=>abrirImagem(img));card.append(ampliar);
            const info=document.createElement('div');info.className='produto-info';
            const nome=document.createElement('h3');nome.textContent=p.nome;info.append(nome);
            const desc=document.createElement('p');desc.textContent=p.descricao||p.categoria;info.append(desc);
            const preco=document.createElement('p');preco.textContent=Number(p.preco).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});info.append(preco);
            const select=document.createElement('select');select.setAttribute('aria-label','Tamanho e cor de '+p.nome);
            vars.forEach(v=>{const disp=v.estoque-v.reservado;const option=new Option(`${v.tamanho} / ${v.cor} — ${disp>0?disp+' disponíveis':'Esgotado'}`,v.id);option.disabled=disp<=0;select.append(option);});
            const disponivel=vars.find(v=>v.estoque-v.reservado>0);if(disponivel)select.value=disponivel.id;
            const link=document.createElement('a');link.className='botao botao-dourado botao-compra';
            function atualizar(){
                const v=vars.find(v=>v.id===select.value);
                if(!v||v.estoque-v.reservado<=0){link.textContent='Esgotado';link.removeAttribute('href');select.disabled=true;return;}
                link.textContent='🛒 Solicitar compra';
                link.href='contato.html?'+new URLSearchParams({produto:`${p.nome} — ${v.tamanho} / ${v.cor} — ${preco.textContent}`});
            }
            select.addEventListener('change',atualizar);info.append(select,link);card.append(info);secao.querySelector('.galeria-produtos').append(card);atualizar();
        });
    }catch(erro){console.error(erro);aviso.textContent='Não foi possível consultar o estoque agora. As fotos abaixo são o mostruário; consulte disponibilidade pelo contato.';}
});
