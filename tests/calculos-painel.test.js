const {test}=require('node:test');const assert=require('node:assert/strict');const c=require('../admin/js/calculos.js');
test('resumo separa saldo de caixa e margem de vendas sem duplicar receitas',()=>{
 const r=c.resumo([{total:100,itens:[{custoUnit:40,qtd:1}]}],[{tipo:'despesa',valor:80,origem:'estoque'},{tipo:'despesa',valor:5,origem:'checkout'},{tipo:'receita',valor:10,origem:'manual'}],[{ativo:true,preco:100,custo:40,disponivel:2},{ativo:false,preco:1000,custo:0,disponivel:5}]);
 assert.deepEqual(r,{receitas:110,despesas:85,saldo:25,lucro:55,previsto:120,faturamento:100});
});
test('valores monetários são somados em centavos',()=>{const r=c.resumo([{total:.1,itens:[]},{total:.2,itens:[]}],[],[]);assert.equal(r.receitas,.3);});
test('data comercial usa São Paulo na virada do dia',()=>{assert.equal(c.dia('2026-11-12T01:30:00Z'),'2026-11-11');});
