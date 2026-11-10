'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
    const cfg=window.DOMMaltaConfig;if(!cfg)return;
    try{
        const r=await fetch(cfg.url+'/rest/v1/rpc/dados_publicos_loja',{method:'POST',headers:{apikey:cfg.chavePublica,'Content-Type':'application/json'},body:'{}'});
        if(!r.ok)return;const loja=await r.json();if(!loja||(!loja.telefone&&!loja.endereco&&!loja.cnpj))return;
        const secao=document.createElement('section');secao.className='container compra-bloco';secao.style.marginTop='24px';
        const titulo=document.createElement('h2');titulo.textContent=loja.nome||'Dados da loja';secao.append(titulo);
        for(const texto of [loja.endereco,loja.cnpj?'CNPJ: '+loja.cnpj:''])if(texto){const p=document.createElement('p');p.textContent=texto;secao.append(p);}
        if(/^\d{10,13}$/.test(loja.telefone)){const a=document.createElement('a');a.className='botao';a.textContent='Falar diretamente com a loja';a.href='https://wa.me/'+(loja.telefone.length<=11?'55':'')+loja.telefone;a.target='_blank';a.rel='noopener noreferrer';secao.append(a);}
        document.querySelector('main')?.append(secao);
    }catch{/* Os contatos existentes continuam disponíveis se a conexão falhar. */}
});
