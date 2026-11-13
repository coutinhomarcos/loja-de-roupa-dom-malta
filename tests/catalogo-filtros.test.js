const {test}=require('node:test'),assert=require('node:assert/strict');const f=require('../js/catalogo-filtros.js');
const produtos=[{id:'a',nome:'Calça clássica',categoria:'Calças'},{id:'b',nome:'Camisa básica',categoria:'Camisas'}];
const variacoes=[{produto_id:'a',tamanho:'G',cor:'Preto',estoque:2,reservado:2},{produto_id:'a',tamanho:'M',cor:'Azul',estoque:3,reservado:0},{produto_id:'b',tamanho:'G',cor:'Azul',estoque:1,reservado:0}];
test('busca desconsidera acentos e caixa',()=>assert.deepEqual(f.filtrar(produtos,variacoes,{busca:'CALCA classica'}).map(p=>p.id),['a']));
test('tamanho cor e disponibilidade devem coincidir na mesma variação',()=>{assert.equal(f.filtrar(produtos,variacoes,{tamanho:'G',cor:'Azul',disponibilidade:'disponivel'}).length,1);assert.equal(f.filtrar(produtos,variacoes,{tamanho:'G',cor:'Preto',disponibilidade:'disponivel'}).length,0);assert.equal(f.filtrar(produtos,variacoes,{tamanho:'G',cor:'Preto',disponibilidade:'esgotado'}).length,1);});
test('sem filtros preserva catálogo e aceita produtos sem grade',()=>assert.equal(f.filtrar([...produtos,{id:'c',nome:'Peça'}],variacoes,{}).length,3));
