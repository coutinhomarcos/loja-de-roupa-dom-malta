const {test}=require('node:test');const assert=require('node:assert/strict');
const {comAdicionalCorreios}=require('../lib/frete');
test('frete soma 5% e arredonda uma única vez em centavos',()=>{assert.equal(comAdicionalCorreios(1000),1050);assert.equal(comAdicionalCorreios(1001),1051);assert.equal(comAdicionalCorreios(1010),1061);});
test('frete não aceita valores inválidos',()=>{for(const v of [-1,NaN,Infinity,1.1,'10'])assert.throws(()=>comAdicionalCorreios(v));});
