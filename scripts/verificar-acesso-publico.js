'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const contexto={window:{}};vm.runInNewContext(fs.readFileSync('js/supabase-config.js','utf8'),contexto);const cfg=contexto.window.DOMMaltaConfig;
 for(const tabela of ['administradores','clientes','transacoes','vendas','produto_custos','pedidos_site','pedidos_checkout']){
  const r=await fetch(cfg.url+'/rest/v1/'+tabela+'?select=*&limit=1',{headers:{apikey:cfg.chavePublica}});const dados=await r.json();
  assert.ok([401,403].includes(r.status)||(r.ok&&Array.isArray(dados)&&dados.length===0),'Dados privados expostos: '+tabela);console.log(tabela+': acesso anônimo bloqueado/sem registros');
 }
 const r=await fetch(cfg.url+'/rest/v1/produtos?select=id,ativo&ativo=eq.false&limit=1',{headers:{apikey:cfg.chavePublica}});assert.ok(r.ok);assert.deepEqual(await r.json(),[]);console.log('Produtos ocultos: não expostos');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
