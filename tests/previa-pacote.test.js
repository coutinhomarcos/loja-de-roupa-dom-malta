const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('prévia publica somente runtime e fotos novas, ignora documentos e arquivos antigos do pacote',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dom-malta-pacote-'));
 function gravar(f,s){const p=path.join(root,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);}
 try{
  gravar('scripts/preparar-previa-cliente.js',fs.readFileSync('scripts/preparar-previa-cliente.js'));
  for(const f of ['index.html','css/global.css','pages/colecao.html','admin/index.html','admin/js/banco.js','preview/arara/index.html','preview/arara/rail.js','preview/arara/rail.css'])gravar(f,'publico');
  gravar('js/catalogo-dados.js','pendente=carregar(root.DOMMaltaConfig).then(dados=>{');
  gravar('preview/arara/dados-exemplo.js',"if(!['127.0.0.1','localhost'].includes(location.hostname))return; PRÉVIA COM DADOS DE TESTE");
  gravar('admin/README.md','NAO PUBLICAR');gravar('admin/migracao.sql','NAO PUBLICAR');gravar('admin/.env','NAO PUBLICAR');
  gravar('.preview-cliente/sobra-antiga.txt','NAO PUBLICAR');
  gravar('images/antiga.jpg',Buffer.alloc(2000000));gravar('images/colecao-nova/peca-01.jpeg','foto nova');
  execFileSync(process.execPath,[path.join(root,'scripts/preparar-previa-cliente.js')]);
  const m=JSON.parse(fs.readFileSync(path.join(root,'.preview-cliente-manifest.json'))),nomes=m.map(e=>e.file);
  assert.ok(!nomes.some(f=>/README|\.sql$|\.env|sobra-antiga|images\/antiga/.test(f)),nomes.join(','));
  assert.ok(nomes.includes('images/colecao-nova/peca-01.jpeg'));assert.ok(nomes.includes('admin/js/banco.js'));
  assert.ok(m.reduce((s,e)=>s+e.size,0)<1000000);
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'.preview-cliente/vercel.json')));
  assert.ok(cfg.rewrites.some(r=>r.source==='/images/antiga.jpg'&&r.destination.endsWith('/images/antiga.jpg')));
  assert.ok(cfg.rewrites.some(r=>r.source==='/api/:path*'));assert.match(fs.readFileSync(path.join(root,'.preview-cliente/js/catalogo-dados.js'),'utf8'),/Promise.resolve/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
