document.addEventListener('DOMContentLoaded',async()=>{
    const form=document.getElementById('formPedido'),lista=document.getElementById('itensCarrinho'),mensagem=document.getElementById('mensagemCompra'),enviar=document.getElementById('enviarPedido'),totalEl=document.getElementById('totalCarrinho');
    const cfg=window.DOMMaltaConfig;
    const banco=window.supabase?.createClient(cfg.url,cfg.chavePublica,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const sessao=window.supabase.createClient(cfg.url,cfg.chavePublica);
    async function chamada(dados){
        const {data:{session}}=await sessao.auth.getSession();
        if(!session)throw new Error('Entre no painel de estoque desta versão de testes e volte aqui.');
        const r=await fetch('/api/pagamento-teste',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(dados)});
        const resposta=await r.json();if(!r.ok)throw new Error(resposta.erro||'Falha ao iniciar teste.');return resposta;
    }
    try{const r=await fetch('/api/pagamento-teste');const c=await r.json();if(!r.ok||!c.habilitado)throw new Error();}
    catch{mensagem.textContent='Esta compra funciona somente na publicação Preview configurada na Vercel.';enviar.disabled=true;return;}
    const moeda=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const criar=(tag,texto)=>{const e=document.createElement(tag);e.textContent=texto;return e;};
    let valido=false,total=0,ocupado=false,tentativa=null;
    function campos(){const entrega=form.elements.recebimento.value==='entrega';document.getElementById('camposEndereco').hidden=!entrega;['cep','logradouro','numero','bairro','cidade','uf'].forEach(n=>form.elements[n].required=entrega);}
    form.elements.recebimento.addEventListener('change',campos);campos();
    async function carregar(){
        if(ocupado)return;
        ocupado=true;valido=false;enviar.disabled=true;lista.replaceChildren();totalEl.textContent='';mensagem.textContent='Consultando preços e estoque…';
        try{
            const itens=Carrinho.ler();if(!itens.length){mensagem.textContent='Seu carrinho está vazio. Escolha as peças na Coleção.';return;}
            if(!banco)throw new Error('Conexão indisponível');
            const {data:vs,error}=await banco.from('produto_variacoes').select('id,produto_id,tamanho,cor,estoque,reservado').in('id',itens.map(i=>i.id));if(error)throw error;
            const ids=[...new Set(vs.map(v=>v.produto_id))];
            const {data:ps,error:ep}=ids.length?await banco.from('produtos').select('id,nome,preco').eq('ativo',true).in('id',ids):{data:[],error:null};if(ep)throw ep;
            total=0;valido=true;
            for(const item of itens){
                const v=vs.find(v=>v.id===item.id),p=v&&ps.find(p=>p.id===v.produto_id),disp=p?Math.max(0,v.estoque-v.reservado):0;
                const linha=criar('article','');linha.className='compra-item';linha.append(criar('h3',p?`${p.nome} — ${v.tamanho} / ${v.cor}`:'Produto indisponível'));
                if(p){total+=Math.round(Number(p.preco)*100)*item.quantidade;linha.append(criar('p',`${moeda(p.preco)} por peça · ${disp} disponíveis`));}
                if(item.quantidade>disp){valido=false;linha.append(criar('p','Quantidade indisponível. Ajuste ou remova esta peça.'));}
                const label=criar('label','Quantidade'),q=document.createElement('input');q.type='number';q.min='1';q.max=String(Math.max(1,disp));q.step='1';q.value=item.quantidade;
                q.addEventListener('change',()=>{const n=Number(q.value);if(!Number.isInteger(n)||n<1||n>disp){q.value=item.quantidade;mensagem.textContent='Informe uma quantidade inteira dentro do estoque disponível.';return;}const atuais=Carrinho.ler();const alvo=atuais.find(i=>i.id===item.id);if(alvo)alvo.quantidade=n;Carrinho.salvar(atuais);tentativa=null;carregar();});label.append(q);linha.append(label);
                const remover=criar('button','Remover');remover.type='button';remover.className='remover-item';remover.addEventListener('click',()=>{Carrinho.salvar(Carrinho.ler().filter(i=>i.id!==item.id));tentativa=null;carregar();});linha.append(remover);lista.append(linha);
            }
            totalEl.textContent='Subtotal das peças: '+moeda(total/100);enviar.disabled=!valido;mensagem.textContent=valido?'Revise seus dados. Frete a combinar, sem valor de entrega incluído no subtotal.':'Revise os itens indisponíveis antes de enviar.';
        }catch(erro){mensagem.textContent='Não foi possível atualizar o carrinho. Verifique a conexão e clique em Atualizar disponibilidade.';console.error(erro);}finally{ocupado=false;}
    }
    document.getElementById('recarregarCarrinho').addEventListener('click',carregar);
    form.addEventListener('submit',async evento=>{
        evento.preventDefault();if(!valido||ocupado||!form.reportValidity())return;
        const f=new FormData(form),get=n=>String(f.get(n)||'').trim(),entrega=get('recebimento')==='entrega';
        const endereco=entrega?`${get('logradouro')}, ${get('numero')}${get('complemento')?' — '+get('complemento'):''} — ${get('bairro')} — ${get('cidade')}/${get('uf').toUpperCase()}`:'';
        const cliente={nome:get('nome'),email:get('email'),telefone:get('telefone').replace(/\D/g,''),recebimento:get('recebimento'),cep:entrega?get('cep').replace(/\D/g,''):'',endereco,observacoes:get('observacoes')};
        if(!/^\d{10,11}$/.test(cliente.telefone)){mensagem.textContent='Informe telefone com DDD (10 ou 11 dígitos).';return;}
        if(entrega&&(!/^\d{8}$/.test(cliente.cep)||! /^[A-Z]{2}$/.test(get('uf').toUpperCase()))){mensagem.textContent='Confira o CEP com 8 dígitos e a UF com 2 letras.';return;}
        if(endereco.length>500){mensagem.textContent='O endereço deve ter no máximo 500 caracteres.';return;}
        const itens=Carrinho.ler(),assinatura=JSON.stringify({cliente,itens,total});
        if(!tentativa||tentativa.assinatura!==assinatura)tentativa={id:crypto.randomUUID(),assinatura};
        ocupado=true;enviar.disabled=true;form.inert=true;lista.inert=true;mensagem.textContent='Enviando seu pedido…';
        try{
            const data=await chamada({acao:'criar',id:tentativa.id,cliente,itens,total:total/100});
            sessionStorage.setItem('domMaltaUltimoTeste',data.id);
            // Carrinho só será limpo por ação explícita; abrir checkout não é pagamento.
            const destino=new URL(data.checkout_url);
            if(destino.protocol!=='https:'||!['www.mercadopago.com.br','sandbox.mercadopago.com.br'].includes(destino.hostname))throw new Error('Endereço de pagamento inválido.');
            window.location.assign(destino.href);
        } catch (erro) {
            mensagem.textContent = erro.message || 'Não foi possível abrir o pagamento de teste.';
            mensagem.style.scrollMarginTop = '100px';
            mensagem.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        finally{ocupado=false;form.inert=false;lista.inert=false;enviar.disabled=!valido;}
    });
    window.addEventListener('storage',()=>{if(!ocupado){tentativa=null;carregar();}});carregar();
});
