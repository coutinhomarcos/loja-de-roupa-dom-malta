const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs');
test('Início inicia por escolha do cliente, permite próxima faixa e silenciar',async()=>{
  let iniciar,tocou=0;const botoes={};
  for(const nome of ['pausar','silenciar','proxima'])botoes[nome]={addEventListener(e,fn){this.acao=fn;},setAttribute(){}};
  const audio={dataset:{pasta:'audio/playlist/',inicioManual:'true'},paused:true,muted:false,addEventListener(){},play(){tocou++;this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
  const titulo={};const painel={querySelector:s=>s==='.faixa-atual'?titulo:botoes[s.match(/"(.*?)"/)[1]],contains:()=>false};
  const contexto={URL,location:{href:'http://localhost/index.html'},window:{DOM_MALTA_MUSICAS:[{arquivo:'a.mp3',titulo:'A'},{arquivo:'b.mp3',titulo:'B'}]},document:{querySelector:s=>s==='.musica-pagina'?audio:s==='.controle-musica'?painel:null,getElementById:()=>null,addEventListener:(e,fn)=>{if(e==='DOMContentLoaded')iniciar=fn;}}};
  vm.runInNewContext(fs.readFileSync('js/musica.js','utf8'),contexto);iniciar();assert.equal(tocou,0);
  const primeira=audio.src;botoes.proxima.acao();await Promise.resolve();assert.notEqual(audio.src,primeira);assert.equal(tocou,1);
  botoes.silenciar.acao();assert.equal(audio.muted,true);botoes.pausar.acao();assert.equal(audio.paused,true);
});
test('som de outra aba pausa o anterior, mas segundo plano mantém a reprodução',async()=>{
  const canais=[];
  class Canal{constructor(){canais.push(this);}addEventListener(e,fn){this.receber=fn;}postMessage(data){canais.filter(c=>c!==this).forEach(c=>c.receber?.({data}));}close(){}}
  function pagina(){
    const eventos={},botoes={};let pronto;
    for(const n of ['pausar','silenciar','proxima'])botoes[n]={addEventListener(e,fn){this.acao=fn;},setAttribute(){}};
    const audio={dataset:{pasta:'audio/playlist/'},paused:true,muted:false,addEventListener(e,fn){eventos['audio:'+e]=fn;},play(){this.paused=false;eventos['audio:playing']?.();return Promise.resolve();},pause(){this.paused=true;eventos['audio:pause']?.();}};
    const painel={querySelector:s=>s==='.faixa-atual'?{}:botoes[s.match(/"(.*?)"/)[1]],contains:()=>false};
    const document={hidden:false,querySelector:s=>s==='.musica-pagina'?audio:s==='.controle-musica'?painel:null,querySelectorAll:()=>[audio],getElementById:()=>null,addEventListener(e,fn){if(e==='DOMContentLoaded')pronto=fn;else eventos[e]=fn;}};
    const window={BroadcastChannel:Canal,DOM_MALTA_MUSICAS:[{arquivo:'a.mp3',titulo:'A'}],addEventListener(e,fn){eventos['window:'+e]=fn;}};
    vm.runInNewContext(fs.readFileSync('js/musica.js','utf8'),{document,window,URL,location:{href:'http://localhost/pages/colecao.html'}});pronto();return{audio,botoes,eventos,document};
  }
  const a=pagina(),b=pagina();assert.equal(a.audio.paused,true);assert.equal(b.audio.paused,true);
  a.botoes.pausar.acao();await Promise.resolve();assert.equal(a.audio.paused,false);
  b.botoes.pausar.acao();await Promise.resolve();assert.equal(a.audio.paused,true);assert.equal(b.audio.paused,false);
  b.document.hidden=true;b.eventos.visibilitychange?.();assert.equal(b.audio.paused,false);
});


test('trocar de página restaura faixa, tempo e silêncio; pausa manual é preservada',async()=>{
 const memoria={};const sessionStorage={getItem:k=>memoria[k]??null,setItem:(k,v)=>{memoria[k]=v;}};
 function pagina(){
  let pronto;const eventos={},botoes={};
  for(const n of ['pausar','silenciar','proxima'])botoes[n]={addEventListener(e,fn){this.acao=fn;},setAttribute(){}};
  const audio={dataset:{pasta:'../audio/playlist/'},paused:true,muted:false,currentTime:0,addEventListener(e,fn){eventos['audio:'+e]=fn;},play(){this.paused=false;eventos['audio:playing']?.();return Promise.resolve();},pause(){this.paused=true;eventos['audio:pause']?.();}};
  const painel={querySelector:s=>s==='.faixa-atual'?{}:botoes[s.match(/"(.*?)"/)[1]]};
  const document={querySelector:s=>s==='.musica-pagina'?audio:s==='.controle-musica'?painel:null,addEventListener(e,fn){if(e==='DOMContentLoaded')pronto=fn;}};
  const window={sessionStorage,DOM_MALTA_MUSICAS:[{arquivo:'a.mp3',titulo:'A'},{arquivo:'b.mp3',titulo:'B'}],addEventListener(e,fn){eventos[e]=fn;}};
  vm.runInNewContext(fs.readFileSync('js/musica.js','utf8'),{window,document,URL,location:{href:'http://localhost/pages/colecao.html'}});pronto();return{audio,botoes,eventos};
 }
 const a=pagina();a.botoes.pausar.acao();await Promise.resolve();a.audio.currentTime=42;a.botoes.silenciar.acao();const faixa=a.audio.src;a.eventos.pagehide();
 const b=pagina();b.eventos['audio:loadedmetadata']?.();await Promise.resolve();assert.equal(b.audio.src,faixa);assert.equal(b.audio.currentTime,42);assert.equal(b.audio.muted,true);assert.equal(b.audio.paused,false);
 b.botoes.pausar.acao();b.eventos.pagehide();const c=pagina();await Promise.resolve();assert.equal(c.audio.paused,true);
});
