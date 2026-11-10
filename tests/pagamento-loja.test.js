'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configuracao,pendencias,acesso,hash,handler}=require('../lib/pagamento');
const {banco}=require('../lib/pagamento-teste').interno;
const {estadoCheckout}=require('../lib/pagamento-teste').interno;
const id='11111111-1111-4111-8111-111111111111';
const ambiente={VERCEL_ENV:'production',SUPABASE_URL:'https://exemplo.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_fixture',
    MERCADO_PAGO_ACCESS_TOKEN:'fixture',MERCADO_PAGO_WEBHOOK_SECRET:'fixture',MERCADO_PAGO_VENDEDOR_ID:'123',
    LOJA_ADMIN_ID:id,CRON_SECRET:'fixture',MERCADO_PAGO_MODO:'producao',PAGAMENTOS_REAIS_HABILITADOS:'true',CHECKOUT_BANCO_INSTALADO:'true',CHECKOUT_EXPIRACAO_CONFIGURADA:'true'};
function comAmbiente(valores,fn){const antigo={...process.env};Object.assign(process.env,valores);return Promise.resolve().then(fn).finally(()=>{for(const k of Object.keys(process.env))if(!(k in antigo))delete process.env[k];Object.assign(process.env,antigo);});}
test('sem dados não anuncia cobrança nem acessa serviços externos',async()=>{
    await comAmbiente({...ambiente,PAGAMENTOS_REAIS_HABILITADOS:'false',MERCADO_PAGO_ACCESS_TOKEN:''},async()=>{
        const r={setHeader(){},status(n){this.codigo=n;return this;},json(v){this.body=v;return this;}};
        await handler({method:'GET',headers:{}},r);
        assert.equal(r.codigo,200);assert.deepEqual(r.body,{habilitado:false});
    });
});
test('desligar novas vendas preserva consulta e gestão de pedidos existentes',async()=>{
    await comAmbiente({...ambiente,PAGAMENTOS_REAIS_HABILITADOS:'false',CRON_SECRET:''},()=>{
        assert.equal(configuracao().real,true);
        assert.throws(()=>configuracao(true),/indisponível|disponível/);
    });
});
test('Preview nunca libera operações reais mesmo com todas as variáveis',async()=>{
    await comAmbiente({...ambiente,VERCEL_ENV:'preview'},()=>assert.throws(()=>configuracao(true),/disponível/));
});
test('a chave privada é conferida por hash e não aparece no caminho do banco',async()=>{
    const original=global.fetch;const chave='A'.repeat(43);let caminho;
    global.fetch=async(url)=>{caminho=url;return{ok:true,json:async()=>[{id}]};};
    try{await acesso({real:true,banco:'https://banco.local',admin:id},{id,chave});assert.match(caminho,/pedidos_checkout/);assert.ok(caminho.includes(hash(chave)));assert.ok(!caminho.includes(chave));}
    finally{global.fetch=original;}
});
test('pedido desconhecido não revela se o protocolo existe',async()=>{
    const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>[]});
    try{await assert.rejects(acesso({banco:'https://banco.local',admin:id},{id,chave:'A'.repeat(43)}),/Pedido não encontrado/);}
    finally{global.fetch=original;}
});
test('fluxo de produção mapeia também as relações e RPCs',async()=>{
    const original=global.fetch;let caminho;
    global.fetch=async(url)=>{caminho=url;return{ok:true,json:async()=>[]};};
    try{await banco({real:true,banco:'https://banco.local'},'pedidos_mp_teste?select=id,reservas_checkout_teste!inner(estado)');assert.match(caminho,/pedidos_checkout/);assert.match(caminho,/reservas_checkout!inner/);assert.ok(!caminho.includes('_teste'));}
    finally{global.fetch=original;}
});
test('checklist exige instalação do banco e configuração financeira antes de ativar',()=>{
    const p=pendencias({});assert.ok(p.includes('MERCADO_PAGO_ACCESS_TOKEN'));assert.ok(p.includes('CHECKOUT_BANCO_INSTALADO=true'));
});
test('criação sem preferência já expirada não aparece como criação pendente',()=>{
    assert.equal(estadoCheckout({status:'aguardando_checkout',criacao_iniciada:true,pagamento_id:null,preferencia_id:null},[{estado:'expirada'}]),'expirado');
});
test('painel permite retomar estorno total mesmo depois do status refunded',async()=>{
    await comAmbiente(ambiente,async()=>{
        const original=global.fetch;
        global.fetch=async(url)=>({ok:true,json:async()=>url.includes('/auth/v1/user')?{id}
            :url.includes('/administradores?')?[{usuario_id:id}]
            :[{id,status:'refunded',estornos_checkout:[{tentativa:id,valor:10,estado:'iniciado'}]}]});
        const r={setHeader(){},status(n){this.codigo=n;return this;},json(v){this.body=v;return this;}};
        try{await handler({method:'POST',headers:{authorization:'Bearer fixture.token.test','content-type':'application/json'},body:{acao:'listar'}},r);assert.equal(r.codigo,200);assert.equal(r.body.pedidos[0].estorno_pendente.tentativa,id);}
        finally{global.fetch=original;}
    });
});
