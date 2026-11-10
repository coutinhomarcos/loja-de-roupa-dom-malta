'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const id='11111111-1111-4111-8111-111111111111';
async function carrinho(habilitado){
    const elementos=new Map(),requisicoes=[];let iniciar,destino=null,manuais=0;
    const elemento=()=>({value:'',textContent:'',disabled:false,hidden:false,style:{},eventos:{},children:[],
        addEventListener(n,f){this.eventos[n]=f;},append(e){this.children.push(e);},replaceChildren(){this.children=[];},reportValidity(){return true;},reset(){}});
    const el=n=>{if(!elementos.has(n))elementos.set(n,elemento());return elementos.get(n);};
    el('formPedido').elements=Object.fromEntries(['recebimento','cep','logradouro','numero','bairro','cidade','uf'].map(n=>[n,elemento()]));
    el('formPedido').elements.recebimento.value='retirada';
    const cliente={nome:'Cliente de teste',email:'cliente@invalid.local',telefone:'31999999999',recebimento:'retirada',observacoes:''};
    const client={from(tabela){const q={select(){return q;},eq(){return q;},async in(){return {data:tabela==='produto_variacoes'?[{id,produto_id:id,tamanho:'M',cor:'Preto',estoque:5,reservado:0}]:[{id,nome:'Camisa',preco:10}],error:null};}};return q;},async rpc(){manuais++;return{data:{id,total:10},error:null};}};
    vm.runInNewContext(fs.readFileSync('js/checkout.js','utf8'),{
        document:{addEventListener:(_,f)=>{iniciar=f;},getElementById:el,createElement:elemento},
        window:{DOMMaltaConfig:{},supabase:{createClient:()=>client},addEventListener(){},location:{assign:u=>{destino=u;}}},
        Carrinho:{ler:()=>[{id,quantidade:1}],salvar(){}},
        FormData:class{get(n){return cliente[n]||'';}},
        sessionStorage:{setItem(){}},crypto:{randomUUID:()=>id,getRandomValues:b=>b.fill(1)},
        btoa:s=>Buffer.from(s,'binary').toString('base64'),URL,console:{error(){}},
        fetch:async(_,opcoes)=>{
            if(!opcoes)return{ok:true,json:async()=>({habilitado})};
            requisicoes.push(JSON.parse(opcoes.body));return{ok:true,json:async()=>({id,checkout_url:'https://www.mercadopago.com.br/checkout'})};
        }
    });
    iniciar();await new Promise(r=>setImmediate(r));
    return {el,requisicoes,get destino(){return destino;},get manuais(){return manuais;}};
}
test('retirada com pagamento habilitado abre checkout e não cria pedido manual',async()=>{
    const c=await carrinho(true);
    await c.el('recarregarCarrinho').eventos.click();
    assert.equal(c.el('enviarPedido').disabled,false,'Disponibilidade deve continuar funcionando com pagamento habilitado');
    await c.el('formPedido').eventos.submit({preventDefault(){}});
    assert.equal(c.requisicoes.length,1);assert.equal(c.requisicoes[0].acao,'criar');
    assert.match(c.requisicoes[0].chave,/^[A-Za-z0-9_-]{43}$/);
    assert.equal(c.manuais,0);assert.equal(c.destino,'https://www.mercadopago.com.br/checkout');
});
test('sem pagamentos configurados preserva envio do pedido por contato',async()=>{
    const c=await carrinho(false);await c.el('formPedido').eventos.submit({preventDefault(){}});
    assert.equal(c.manuais,1);assert.equal(c.requisicoes.length,0);assert.equal(c.destino,null);
    assert.match(c.el('mensagemCompra').textContent,/Pedido recebido/);
});
