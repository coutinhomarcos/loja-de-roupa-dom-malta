const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('mostruário abre pelo botão e devolve foco ao fechar com Escape',()=>{
 let clique,tecla;const classes=new Set();let ativo;
 const img={src:'foto.jpg',alt:'Camisa preta'},botao={querySelector:()=>img,addEventListener(e,fn){clique=fn;},focus(){ativo=this;}};
 const fechar={addEventListener(){},focus(){ativo=this;}},ampliada={};
 const modal={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},setAttribute(){},addEventListener(){},querySelectorAll:()=>[fechar]};
 const document={get activeElement(){return ativo;},querySelectorAll:()=>[botao],getElementById:id=>({modalImagem:modal,imagemAmpliada:ampliada,fecharModal:fechar})[id],body:{classList:{add(){},remove(){}}},addEventListener(e,fn){if(e==='keydown')tecla=fn;}};
 vm.runInNewContext(fs.readFileSync('js/galeria.js','utf8'),{document});ativo=botao;clique();assert.equal(ativo,fechar);assert.equal(ampliada.alt,'Camisa preta');tecla({key:'Escape'});assert.equal(ativo,botao);assert.equal(classes.has('ativo'),false);
});
