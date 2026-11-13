const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../js/catalogo-dados.js');
test('dados demonstrativos não são ativados no domínio público',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),window={};
  vm.runInNewContext(fs.readFileSync('preview/arara/dados-exemplo.js','utf8'),{location:{hostname:'loja-de-roupa-dom-malta.vercel.app'},window});
  assert.equal(window.DOMMaltaExemplos,undefined);
});
test('categoria do cadastro define aba e etiqueta, inclusive calça preta',()=>{
  assert.equal(api.categoria('Calças','Calça preta').aba,'calcas');
  assert.equal(api.categoria('Calças').etiqueta,'Calça');
  assert.equal(api.categoria('Bermudas').etiqueta,'Bermuda');
  assert.equal(api.categoria('Camisetas').etiqueta,'Camiseta');
  assert.equal(api.categoria('Jaquetas').aba,'outros');
});
test('arara usa todas as fotos cadastradas e mostra cor e numeração reais',()=>{
  const produtos=Array.from({length:9},(_,i)=>({id:String(i),nome:'Calça preta',categoria:'Calças',imagem_url:'https://loja.supabase.co/storage/v1/object/public/produtos/'+i+'.webp',preco:99}));
  const variacoes=produtos.flatMap(p=>[{produto_id:p.id,tamanho:'40',cor:'Preto',estoque:3,reservado:1},{produto_id:p.id,tamanho:'42',cor:'Preto',estoque:0,reservado:0}]);
  const pecas=api.pecasArara({produtos,variacoes});
  assert.equal(pecas.length,9);assert.equal(pecas[0].tag,'Calça');
  assert.ok(pecas[0].details.includes('40 / Preto — 2 disponíveis'));
  assert.ok(pecas[0].details.includes('42 / Preto — esgotado'));
  assert.equal(api.pecasArara({produtos:[{id:'x',ativo:false,imagem_url:'javascript:alert(1)'}],variacoes:[]}).length,0);
});
test('consulta paginada carrega todos os produtos sem aceitar resposta de erro como lista vazia',async()=>{
  const requisicoes=[];
  const fetcher=async url=>{requisicoes.push(url);const u=new URL(url);const offset=Number(u.searchParams.get('offset'));return{ok:true,json:async()=>u.pathname.endsWith('/produtos')?(offset===0?Array.from({length:500},(_,i)=>({id:i})): [{id:500}]):[]};};
  const resultado=await api.carregar({url:'https://loja.supabase.co',chavePublica:'publica'},fetcher);
  assert.equal(resultado.produtos.length,501);assert.equal(requisicoes.length,3);
  await assert.rejects(api.carregar({url:'https://loja.supabase.co',chavePublica:'publica'},async()=>({ok:false})),/catálogo/);
});
