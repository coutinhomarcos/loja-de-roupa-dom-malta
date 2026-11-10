'use strict';
document.addEventListener('DOMContentLoaded',Banco.executar(async()=>{
    if(!await adminPronto)return;
    const secao=document.createElement('section');secao.className='card';secao.style.marginTop='24px';
    secao.innerHTML='<h2>Pedidos com pagamento online</h2><p>Últimos 100 pedidos. Pesquise pelo protocolo para localizar um pedido anterior. Valores de teste permanecem no painel simulado.</p><label>Protocolo (opcional)<input id="buscaCheckout" maxlength="36" autocomplete="off"></label><button type="button" class="btn btn-primary" style="width:auto">Atualizar pedidos online</button><p role="status" aria-live="polite"></p><div class="table-responsive"><table style="width:100%"><thead><tr><th>Pedido / cliente</th><th>Pagamento / atendimento</th><th>Valores</th><th>Ações</th></tr></thead><tbody></tbody></table></div>';
    (document.querySelector('.content-body')||document.querySelector('main')).append(secao);
    const atualizar=secao.querySelector('button'),status=secao.querySelector('[role="status"]'),corpo=secao.querySelector('tbody'),busca=secao.querySelector('input');
    const nomes={aguardando_checkout:'Checkout em confirmação',aguardando_pagamento:'Aguardando pagamento',approved:'Aprovado',pending:'Pendente',in_process:'Em análise',cancelled:'Cancelado',rejected:'Recusado',refunded:'Estornado',charged_back:'Contestado',in_mediation:'Em mediação',authorized:'Autorizado, aguardando captura'};
    const etapas={aguardando_pagamento:'Aguardando pagamento',separacao:'Em separação',pronto_retirada:'Pronto para retirada',entregue:'Entregue'};
    let ocupado=false;
    async function chamada(dados){
        const {data:{session}}=await Banco.client.auth.getSession();if(!session)throw new Error('Entre novamente no painel.');
        const r=await fetch('/api/pagamento',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(dados)});
        const p=await r.json();if(!r.ok)throw new Error(p.erro||'Não foi possível consultar.');return p;
    }
    function botao(texto,fn){const b=document.createElement('button');b.type='button';b.className='btn';b.style.width='auto';b.textContent=texto;b.addEventListener('click',()=>executar(fn));return b;}
    async function executar(fn){if(ocupado)return;ocupado=true;secao.inert=true;try{await fn();}catch(e){status.textContent=e.message;}finally{ocupado=false;secao.inert=false;}}
    async function carregar(){
        const {pedidos}=await chamada({acao:'listar',id:busca.value.trim()||undefined});corpo.replaceChildren();
        for(const p of pedidos){
            const tr=document.createElement('tr');
            const identidade=document.createElement('td');identidade.textContent=p.id+' · '+(p.cliente?.nome||'Cliente')+' · '+(p.cliente?.telefone||'');
            const situacao=document.createElement('td');situacao.textContent=(nomes[p.status]||'Conferir pagamento')+' · '+(etapas[p.atendimento]||'Conferir atendimento')+(p.conciliacao?' · Conferência: '+p.conciliacao.replaceAll('_',' '):'')+(p.solicitacao_cancelamento?' · Cliente solicitou cancelamento/estorno':'');
            const valores=document.createElement('td');valores.textContent='Pedido '+Banco.moeda(p.total)+' · Estornado '+Banco.moeda(p.valor_estornado)+' · Taxa '+(p.taxa_mp==null?'não informada':Banco.moeda(p.taxa_mp))+' · Líquido '+(p.valor_liquido==null?'não informado':Banco.moeda(p.valor_liquido));
            const acoes=document.createElement('td');
            acoes.append(botao('Conferir no Mercado Pago',async()=>{await chamada({acao:'consultar',administrativo:true,id:p.id});await carregar();}));
            if(p.status==='approved'||p.estorno_pendente){
                acoes.append(botao('Estornar / retomar',async()=>{
                    const chave='domMaltaEstornoLoja:'+p.id;let local=null;
                    try{local=JSON.parse(sessionStorage.getItem(chave)||'null');}catch{sessionStorage.removeItem(chave);}
                    const atual=await chamada({acao:'consultar',administrativo:true,id:p.id,tentativa_estorno:local?.tentativa});
                    if(atual.estorno_consultado?.estado==='confirmado'){sessionStorage.removeItem(chave);local=null;}
                    let tentativa=atual.estorno_pendente||local;
                    const saldo=Math.max(0,Math.round((Number(atual.total)-Number(atual.valor_estornado||0))*100)/100);
                    if(!tentativa){const entrada=prompt('Valor a estornar em reais (máximo '+Banco.moeda(saldo)+'):',saldo.toFixed(2));if(entrada===null)return;const valor=Number(entrada.replace(',','.'));if(!Number.isFinite(valor)||valor<=0||valor>saldo||Math.abs(valor*100-Math.round(valor*100))>0.000001)throw new Error('Informe um valor em centavos dentro do saldo.');tentativa={tentativa:crypto.randomUUID(),valor};}
                    if(!confirm('Confirmar estorno de '+Banco.moeda(tentativa.valor)+'? A operação será enviada ao Mercado Pago. Peças não serão repostas automaticamente.'))return;
                    sessionStorage.setItem(chave,JSON.stringify(tentativa));
                    const r=await chamada({acao:'estornar',id:p.id,tentativa:tentativa.tentativa,valor:Number(tentativa.valor)});
                    if(r.estorno?.estado==='confirmado')sessionStorage.removeItem(chave);
                    await carregar();status.textContent='Estorno confirmado. Confira os valores atualizados e a devolução física das peças.';
                }));
                if(p.status==='approved'&&!p.conciliacao&&!p.solicitacao_cancelamento&&['separacao','pronto_retirada'].includes(p.atendimento)){
                    const proximo=p.atendimento==='separacao'?'pronto_retirada':'entregue';
                    acoes.append(botao(proximo==='entregue'?'Confirmar entrega':'Marcar pronto para retirada',async()=>{if(!confirm('Confirmar esta etapa do atendimento?'))return;await chamada({acao:'atender',id:p.id,estado:proximo});await carregar();}));
                }
            }
            tr.append(identidade,situacao,valores,acoes);corpo.append(tr);
        }
        status.textContent=pedidos.length?pedidos.length+' pedido(s) carregado(s).':'Nenhum pedido online encontrado.';
    }
    atualizar.addEventListener('click',()=>executar(carregar));await executar(carregar);
}));
