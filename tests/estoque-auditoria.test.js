const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('grade elimina duplicatas e rejeita quantidade negativa, fracionada ou excessiva',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync('admin/js/grade.js','utf8'),c);const g=c.window.Grade;
 assert.equal(g.gerar('P, M, p','Preto, preto, Azul').length,4);
 assert.throws(()=>g.gerar('','Preto'));assert.throws(()=>g.gerar(Array.from({length:201},(_,i)=>i).join(','),'Preto'));
 for(const estoque of [-1,1.5,NaN,1000001])assert.throws(()=>g.validar([{estoque}]));assert.equal(g.validar([{estoque:0}]).length,1);
});
test('estoque usa limite configurado e separa baixo de esgotado',async()=>{
 let pronto;const els={},rows=[];const el=id=>els[id]||(els[id]={value:'',replaceChildren(){},append(tr){rows.push(tr)},addEventListener(){}});
 const document={getElementById:el,addEventListener:(_,fn)=>pronto=fn,createElement:()=>({lastElementChild:{append(){}},addEventListener(){}})};
 const produtos=[{produto_id:'a',id:'v1',nome:'A',codigo:'A',categoria:'Camisas',tamanho:'P',cor:'Preto',estoque:4,reservado:0,disponivel:4},{produto_id:'a',id:'v2',nome:'A',codigo:'B',categoria:'Camisas',tamanho:'M',cor:'Preto',estoque:7,reservado:0,disponivel:7},{produto_id:'a',id:'v3',nome:'A',codigo:'C',categoria:'Camisas',tamanho:'G',cor:'Preto',estoque:0,reservado:0,disponivel:0}];
 const Banco={executar:f=>f,produtos:async()=>produtos,esc:String};
 vm.runInNewContext(fs.readFileSync('admin/js/estoque.js','utf8'),{window:{},document,Banco,adminPronto:Promise.resolve(true),Inventario:{limiteEstoque:async()=>8}});await pronto();
 assert.equal(els.estoqueBaixo.textContent,2);assert.equal(els.produtosEsgotados.textContent,1);assert.equal(els.estoqueDisponivel.textContent,11);assert.match(rows[1].innerHTML,/<td>8<\/td><td>Atenção/);
});
