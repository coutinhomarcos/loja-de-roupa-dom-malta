const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('tema alterna e mantém a escolha ao navegar para outra tela',()=>{
 const saved=new Map();function abrir(){const classes=new Set(),events={};const button={addEventListener:(name,fn)=>events[name]=fn};const context={document:{body:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}},getElementById:()=>button,addEventListener:(_,fn)=>fn()},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}};vm.runInNewContext(fs.readFileSync('admin/js/js/theme.js','utf8'),context);return {classes,button,click:()=>events.click()};}
 const a=abrir();assert.equal(a.classes.has('light-theme'),false);assert.match(a.button.textContent,/Modo Claro/);a.click();assert.equal(a.classes.has('light-theme'),true);const b=abrir();assert.equal(b.classes.has('light-theme'),true);assert.match(b.button.textContent,/Modo Escuro/);b.click();assert.equal(b.classes.has('light-theme'),false);
});
test('telas corrigidas usam a paleta compartilhada nos cartões e campos',()=>{
 for(const p of ['admin/css/vendas.css',...['financeiro','relatorios','configuracoes'].map(n=>`admin/pages/${n}.html`)]){const s=fs.readFileSync(p,'utf8');assert.match(s,/\.card\s*\{\s*background-color: var\(--panel\)/,p);assert.match(s,/background-color: var\(--input-bg\)|background-color: var\(--panel\)/,p);assert.doesNotMatch(s,/background-color: #(?:ffffff|f4f6f9|f8fafc|f1f5f9)\b/,p);}
});
