document.addEventListener('DOMContentLoaded',async()=>{
 if(!await adminPronto)return;
 const lista=document.getElementById('listaPedidos'),botao=document.getElementById('atualizarPedidos');
 const criar=(tag,txt)=>{const e=document.createElement(tag);e.textContent=txt;return e;};
 async function carregar(){
  botao.disabled=true;
  try{
   const pedidos=await Banco.resultado(Banco.client.from('pedidos_site').select('id,criado_em,status,cliente,itens,total').order('criado_em',{ascending:false}).limit(100));lista.replaceChildren();
   if(!pedidos.length)lista.append(criar('p','Nenhum pedido recebido.'));
   for(const p of pedidos){
    const card=criar('article','');card.style.cssText='padding:20px;margin:18px 0;border:1px solid #aaa;border-radius:10px;overflow-wrap:anywhere';
    card.append(criar('h2','Pedido '+p.id),criar('p',new Date(p.criado_em).toLocaleString('pt-BR')+' · Pendente de contato'),criar('p',p.cliente.nome+' · '+p.cliente.email+' · '+p.cliente.telefone),criar('p',p.cliente.recebimento==='entrega'?'Entrega: '+p.cliente.endereco+' · CEP '+p.cliente.cep:'Retirada na loja'));
    const itens=criar('ul','');for(const i of p.itens)itens.append(criar('li',`${i.quantidade} × ${i.nome} — ${i.tamanho} / ${i.cor} — ${Banco.moeda(i.preco)} por peça`));
    card.append(itens,criar('strong','Subtotal das peças: '+Banco.moeda(p.total)),criar('p','Frete a combinar.'));
    if(p.cliente.observacoes)card.append(criar('p','Observações: '+p.cliente.observacoes));lista.append(card);
   }
   document.getElementById('mensagemBanco').textContent='Exibindo até 100 pedidos mais recentes.';
  }catch(e){Banco.mensagem(e);}finally{botao.disabled=false;}
 }
 botao.addEventListener('click',carregar);carregar();
});
