'use strict';
document.addEventListener('DOMContentLoaded',()=>{
    const el=id=>document.getElementById(id),form=el('formAcompanhamento'),id=el('pedidoId'),chave=el('pedidoChave'),status=el('pedidoStatus'),valores=el('pedidoValores'),checkout=el('pedidoCheckout'),copiar=el('copiarAcompanhamento');
    const nomes={aguardando_checkout:'Criação do pagamento em confirmação',aguardando_pagamento:'Aguardando pagamento',approved:'Pagamento aprovado',pending:'Pagamento pendente',in_process:'Pagamento em análise',rejected:'Pagamento recusado',cancelled:'Pagamento cancelado',refunded:'Pagamento estornado',charged_back:'Pagamento contestado',in_mediation:'Contestação em análise',authorized:'Pagamento autorizado, aguardando confirmação'};
    const etapas={separacao:'Em separação',pronto_retirada:'Pronto para retirada — combine com a loja',entregue:'Pedido entregue'};
    const moeda=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const cancelar=el('cancelarPedido');
    let ocupado=false,consulta=null;
    id.value=new URLSearchParams(location.search).get('pedido')||sessionStorage.getItem('domMaltaUltimoPedido')||'';
    chave.value=new URLSearchParams(location.hash.slice(1)).get('chave')||sessionStorage.getItem('domMaltaPedido:'+id.value)||'';
    if(location.hash)history.replaceState(null,'',location.pathname+location.search);
    async function consultar(){
        if(ocupado||!form.reportValidity())return;ocupado=true;form.inert=true;consulta=null;checkout.hidden=true;copiar.hidden=true;cancelar.hidden=true;valores.textContent='';status.textContent='Consultando seu pedido…';
        try{
            const r=await fetch('/api/pagamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'consultar',id:id.value.trim(),chave:chave.value.trim()})});
            const p=await r.json();if(!r.ok)throw new Error(p.erro||'Não foi possível consultar.');
            consulta={id:p.id,chave:chave.value.trim()};sessionStorage.setItem('domMaltaPedido:'+p.id,consulta.chave);
            let descricao=nomes[p.status]||'Atualização em conferência';
            if(p.estado_checkout==='expirado')descricao='Checkout expirado. Escolha as peças novamente para iniciar outro pedido.';
            if(p.estado_checkout==='criacao_pendente')descricao='Criação do checkout sem confirmação. Consulte novamente antes de criar outro pedido.';
            if(p.conciliacao==='estorno_necessario')descricao='Pagamento recebido sem disponibilidade das peças. Entre em contato com a loja para o estorno.';
            else if(p.conciliacao==='estorno_parcial')descricao='Pagamento com estorno parcial. Confira os valores e o atendimento com a loja.';
            else if(p.status==='approved'&&etapas[p.atendimento])descricao+=' · '+etapas[p.atendimento];
            if(p.solicitacao_cancelamento)descricao+=' · Cancelamento/estorno solicitado à loja; aguarde confirmação.';
            status.textContent=descricao;
            valores.textContent='Valor do pedido: '+moeda(p.total)+' · Estornado: '+moeda(p.valor_estornado||0);
            const vencimento=Date.parse(p.prazo_checkout?.expiration_date_to);
            if(!p.solicitacao_cancelamento&&p.checkout_url&&['aguardando_pagamento','pending','in_process','rejected'].includes(p.status)&&(!Number.isFinite(vencimento)||vencimento>Date.now())&&p.estado_checkout!=='expirado'){
                const u=new URL(p.checkout_url);if(u.protocol==='https:'&&['www.mercadopago.com.br','sandbox.mercadopago.com.br'].includes(u.hostname)&&!u.username&&!u.password){checkout.href=u.href;checkout.hidden=false;}
            }
            copiar.hidden=false;
            cancelar.hidden=p.solicitacao_cancelamento||['cancelled','refunded','charged_back'].includes(p.status);
        }catch(e){status.textContent=e.message;}finally{ocupado=false;form.inert=false;}
    }
    form.addEventListener('submit',e=>{e.preventDefault();consultar();});
    for(const campo of [id,chave])campo.addEventListener('input',()=>{consulta=null;checkout.hidden=true;copiar.hidden=true;cancelar.hidden=true;});
    copiar.addEventListener('click',async()=>{if(!consulta)return;try{await navigator.clipboard.writeText(location.origin+location.pathname+'?pedido='+consulta.id+'#chave='+encodeURIComponent(consulta.chave));status.textContent+=' Link privado copiado.';}catch{status.textContent+=' Não foi possível copiar. Guarde seu protocolo e a chave informada.';}});
    cancelar.addEventListener('click',async()=>{
        if(ocupado||!consulta||!confirm('Solicitar cancelamento ou estorno à loja? A confirmação depende da verificação do pagamento e do atendimento.'))return;
        ocupado=true;cancelar.disabled=true;
        try{const r=await fetch('/api/pagamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'cancelar',...consulta})});const p=await r.json();if(!r.ok)throw new Error(p.erro||'Não foi possível registrar.');status.textContent=p.mensagem;checkout.hidden=true;cancelar.hidden=true;}
        catch(e){status.textContent=e.message;}finally{ocupado=false;cancelar.disabled=false;}
    });
    if(id.value&&chave.value)consultar();
});
