/* A coleção consulta o mesmo banco do painel, usando apenas leitura pública. */
document.addEventListener('DOMContentLoaded',async()=>{
    const aviso=document.getElementById('avisoCatalogo');
    const mostra=document.getElementById('catalogoBanco');
    if(!aviso||!mostra)return;
    const tentar=document.createElement('button');tentar.type='button';tentar.className='botao';tentar.textContent='Tentar novamente';tentar.hidden=true;aviso.after(tentar);
    tentar.addEventListener('click',()=>renderizar(true));
    const inicio=mostra.dataset.inicio==='true';
    const base=inicio?'':'../';
    const formFiltros=document.getElementById('filtrosColecao');let dadosAtuais=null;
    function filtros(){return formFiltros?{busca:document.getElementById('buscaColecao').value,tamanho:document.getElementById('tamanhoColecao').value,cor:document.getElementById('corColecao').value,disponibilidade:document.getElementById('disponibilidadeColecao').value}:{};}
    function opcoes(dados){
        if(!formFiltros)return;
        for(const [id,campo] of [['tamanhoColecao','tamanho'],['corColecao','cor']]){
            const select=document.getElementById(id),valor=select.value;
            const valores=[...new Set(dados.variacoes.filter(v=>dados.produtos.some(p=>p.id===v.produto_id)).map(v=>v[campo]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true}));
            while(select.options.length>1)select.remove(1);valores.forEach(v=>select.append(new Option(v,v)));if(valores.includes(valor))select.value=valor;
        }
    }
    async function renderizar(recarregar=false){
    tentar.hidden=true;mostra.setAttribute('aria-busy','true');
    try{
        const dados=dadosAtuais=(!dadosAtuais||recarregar)?await CatalogoLoja.obter(recarregar):dadosAtuais;
        opcoes(dados);const selecao=filtros();const temFiltros=Object.values(selecao).some(v=>String(v).trim());
        const pResult={data:formFiltros?CatalogoFiltros.filtrar(dados.produtos,dados.variacoes,selecao):dados.produtos};
        const vs=dados.variacoes;
        const produtos=inicio?pResult.data.filter(p=>vs.some(v=>v.produto_id===p.id&&v.estoque-v.reservado>0)).slice(0,4):pResult.data;
        mostra.querySelectorAll('.galeria-destaques,.galeria-produtos').forEach(e=>e.replaceChildren());
        mostra.querySelectorAll('.catalogo-vazio').forEach(e=>e.remove());
        if(formFiltros){
            document.getElementById('resultadoFiltros').textContent=produtos.length+' '+(produtos.length===1?'produto encontrado':'produtos encontrados')+(temFiltros?' com os filtros selecionados.':'.');
            const mostruario=document.getElementById('mostruarioColecao');if(mostruario)mostruario.hidden=temFiltros;
            mostra.querySelectorAll('[data-categoria]').forEach(secao=>{secao.hidden=!produtos.some(p=>CatalogoLoja.categoria(p.categoria,p.nome).aba===secao.dataset.categoria);});
        }
        // As fotos originais continuam disponíveis em um mostruário separado.
        // As ofertas vendáveis são somente as cadastradas no banco.
        if(!produtos.length){aviso.textContent=temFiltros?'Nenhuma peça corresponde à busca. Tente outra combinação ou limpe os filtros.':inicio?'Ainda não há peças disponíveis em destaque. Confira nossa coleção ou fale com a loja.':'Nenhum produto cadastrado para venda. As fotos abaixo são o mostruário da loja; consulte disponibilidade pelo contato.';return;}
        aviso.textContent='Escolha tamanho e cor para consultar a disponibilidade. Adicione suas peças ao carrinho para revisar o pedido.';
        if(!inicio){
            mostra.querySelectorAll('[data-categoria]').forEach(secao=>{
                const categoria=secao.dataset.categoria;
                const tem=produtos.some(p=>{return CatalogoLoja.categoria(p.categoria,p.nome).aba===categoria;});
                if(!tem){const texto=document.createElement('p');texto.className='catalogo-vazio';texto.textContent='Nenhum produto cadastrado nesta categoria no momento.';secao.append(texto);}
            });
        }
        produtos.forEach(p=>{
            const vars=vs.filter(v=>v.produto_id===p.id),card=document.createElement('article');card.className='produto';
            const destino=CatalogoLoja.categoria(p.categoria,p.nome).aba;
            const secao=inicio?mostra:mostra.querySelector(`[data-categoria="${destino}"]`);
            if(!inicio){secao.hidden=false;secao.id='disponiveis_'+destino;}
            const atalho=document.querySelector('.categorias-atalhos a[href="#'+destino+'"]');if(atalho)atalho.href='#disponiveis_'+destino;
            const img=document.createElement('img');
            const src=p.imagem_url||base+'images/logo-dom-malta-atendimento-hd.jpg';
            const url=new URL(src,location.href);
            img.src=(url.protocol==='https:'||url.protocol==='http:'||/^data:image\/(jpeg|png|webp);base64,/.test(src))?src:base+'images/logo-dom-malta-atendimento-hd.jpg';
            img.alt=p.nome;img.loading='lazy';img.decoding='async';
            const ampliar=document.createElement('button');ampliar.className='produto-imagem';ampliar.type='button';ampliar.setAttribute('aria-label',(inicio?'Ver na coleção: ':'Ampliar ')+p.nome);
            if(new URL(img.src,location.href).pathname.endsWith('/logo-dom-malta-atendimento-hd.jpg')){
                const marca=document.createElement('span');marca.className='marca-catalogo';
                const desenho=document.createElement('span');desenho.className='marca-catalogo-imagem';desenho.append(img);
                const frase=document.createElement('span');frase.className='marca-catalogo-frase';frase.textContent='Elegância que impõe respeito';
                marca.append(desenho,frase);ampliar.append(marca);
            }else ampliar.append(img);
            ampliar.addEventListener('click',()=>{if(inicio)location.href='pages/colecao.html#disponiveis_'+destino;else abrirImagem(img);});card.append(ampliar);
            const info=document.createElement('div');info.className='produto-info';
            const nome=document.createElement('h3');nome.textContent=p.nome;info.append(nome);
            const desc=document.createElement('p');desc.textContent=p.descricao||p.categoria;info.append(desc);
            const preco=document.createElement('p');preco.textContent=Number(p.preco).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+(p.demonstracao?' (exemplo)':'');info.append(preco);
            const select=document.createElement('select');select.setAttribute('aria-label','Tamanho e cor de '+p.nome);
            vars.forEach(v=>{const disp=v.estoque-v.reservado;const option=new Option(`${v.tamanho} / ${v.cor} — ${disp>0?disp+' disponíveis':'Esgotado'}`,v.id);option.disabled=disp<=0;select.append(option);});
            const candidatas=vars.filter(v=>formFiltros&&CatalogoFiltros.combinar(v,selecao));const correspondente=temFiltros?(candidatas.find(v=>v.estoque-v.reservado>0)||candidatas[0]):null;const disponivel=vars.find(v=>v.estoque-v.reservado>0);if(correspondente||disponivel)select.value=(correspondente||disponivel).id;
            const link=document.createElement('button');link.type='button';link.className='botao botao-dourado botao-compra';
            function atualizar(){
                if(p.demonstracao){link.textContent='Peça de teste · sem compra';link.disabled=true;return;}
                const v=vars.find(v=>v.id===select.value);
                if(!v||v.estoque-v.reservado<=0){link.textContent='Esgotado';link.disabled=true;select.disabled=!vars.some(v=>v.estoque-v.reservado>0);return;}
                link.textContent='🛒 Adicionar ao carrinho';link.disabled=false;

            }
            link.addEventListener('click',()=>{try{const v=vars.find(v=>v.id===select.value);Carrinho.adicionar(v.id,v.estoque-v.reservado);aviso.textContent=p.nome+' adicionado ao carrinho. Use Carrinho no menu para revisar.';}catch(erro){aviso.textContent=erro.message;}});
            select.addEventListener('change',atualizar);info.append(select,link);card.append(info);secao.querySelector(inicio?'.galeria-destaques':'.galeria-produtos').append(card);atualizar();
        });
    }catch(erro){
        console.error(erro);tentar.hidden=false;
        aviso.textContent=window.navigator?.onLine===false?'Você está sem conexão. Confira sua internet e tente novamente.':'Não foi possível atualizar a disponibilidade agora. Tente novamente ou fale com a loja.';
        mostra.querySelectorAll('.botao-compra').forEach(b=>b.disabled=true);
        if(formFiltros)document.getElementById('resultadoFiltros').textContent='Resultados não atualizados. Tente novamente.';
    }finally{mostra.setAttribute('aria-busy','false');}
    }
    renderizar();
    if(formFiltros){
        formFiltros.addEventListener('submit',e=>e.preventDefault());
        document.getElementById('buscaColecao').addEventListener('input',()=>renderizar());
        formFiltros.querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>renderizar()));
        document.getElementById('limparFiltros').addEventListener('click',()=>{formFiltros.reset();renderizar();document.getElementById('buscaColecao').focus();});
    }
    window.addEventListener('catalogo:atualizado',()=>renderizar(true));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')renderizar(true);});
});


