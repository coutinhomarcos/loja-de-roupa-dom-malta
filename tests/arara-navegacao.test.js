const {test}=require('node:test');const assert=require('node:assert/strict');
const arara=require('../js/arara-navegacao.js');
const pecas=Array.from({length:15},(_,i)=>({id:i,categoria:i<9?'camisas':i<12?'calcas':'bermudas'}));
test('seta troca o bloco inteiro de seis sem repetir peças entre páginas',()=>{
  const a=arara.pagina(pecas,'todas',0),b=arara.pagina(pecas,'todas',1),c=arara.pagina(pecas,'todas',2);
  assert.deepEqual(a.itens.map(p=>p.id),[0,1,2,3,4,5]);assert.deepEqual(b.itens.map(p=>p.id),[6,7,8,9,10,11]);
  assert.deepEqual(c.itens.map(p=>p.id),[12,13,14]);assert.equal(arara.avancar(2,3,1),0);
});
test('filtros mostram apenas a categoria escolhida e tratam lista vazia',()=>{
  assert.deepEqual(arara.pagina(pecas,'calcas',0).itens.map(p=>p.id),[9,10,11]);
  assert.equal(arara.pagina(pecas,'bermudas',0).total,3);assert.equal(arara.pagina([],'camisas',0).itens.length,0);
  assert.equal(arara.pagina(pecas,'calcas',9).indice,0);
});
