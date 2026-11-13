const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('falha da rede permite tentar novamente e limpa o estado de erro após recuperar',async()=>{
 let pronto,tentar,chamadas=0;const atributos={},compra={disabled:false},aviso={after(e){tentar=e;}};
 const mostra={dataset:{},setAttribute(k,v){atributos[k]=v;},querySelectorAll:s=>s==='.botao-compra'?[compra]:[]};
 const document={getElementById:id=>({avisoCatalogo:aviso,catalogoBanco:mostra})[id],createElement:()=>({addEventListener(e,fn){this.acao=fn;}}),addEventListener(e,fn){if(e==='DOMContentLoaded')pronto=fn;}};
 const window={navigator:{onLine:false},addEventListener(){}};
 const CatalogoLoja={async obter(){if(++chamadas===1)throw new Error('offline');return{produtos:[],variacoes:[]};}};
 vm.runInNewContext(fs.readFileSync('js/catalogo.js','utf8'),{document,window,CatalogoLoja,console:{error(){}}});await pronto();await new Promise(r=>setImmediate(r));
 assert.equal(tentar.hidden,false);assert.match(aviso.textContent,/sem conexão/);assert.equal(compra.disabled,true);assert.equal(atributos['aria-busy'],'false');
 await tentar.acao();await new Promise(r=>setImmediate(r));assert.equal(tentar.hidden,true);assert.match(aviso.textContent,/Nenhum produto/);assert.equal(chamadas,2);
});
