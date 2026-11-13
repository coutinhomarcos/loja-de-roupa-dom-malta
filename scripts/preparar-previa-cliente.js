/* Prévia estática isolada: manifesto explícito, sem documentos, APIs ou credenciais. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.preview-cliente'),arquivos=[];
function publicar(file,conteudo){
 const b=Buffer.isBuffer(conteudo)?conteudo:Buffer.from(conteudo),destino=path.join(out,file);
 fs.mkdirSync(path.dirname(destino),{recursive:true});fs.writeFileSync(destino,b);
 arquivos.push({file,sha:crypto.createHash('sha1').update(b).digest('hex'),size:b.length});
}
function copiar(file){publicar(file,fs.readFileSync(path.join(root,file)));}
function percorrer(pasta,visitar){
 if(!fs.existsSync(path.join(root,pasta)))return;
 for(const e of fs.readdirSync(path.join(root,pasta),{withFileTypes:true})){
  if(e.name.startsWith('.')||e.name==='node_modules')continue;
  const file=pasta+'/'+e.name;if(e.isDirectory())percorrer(file,visitar);else visitar(file);
 }
}
copiar('index.html');
for(const pasta of ['css','js','pages','admin'])percorrer(pasta,file=>{
 if(!/\.(html|css|js)$/i.test(file))return;
 if(file==='js/catalogo-dados.js'){
  const original=fs.readFileSync(path.join(root,file),'utf8'),busca='pendente=carregar(root.DOMMaltaConfig).then(dados=>{';
  if(!original.includes(busca))throw new Error('Catálogo mudou: conferir isolamento antes de publicar.');
  publicar(file,original.replace(busca,'pendente=Promise.resolve({produtos:[],variacoes:[]}).then(dados=>{'));
 }else copiar(file);
});
for(const nome of ['index.html','rail.js','rail.css'])copiar('preview/arara/'+nome);
const fixture=fs.readFileSync(path.join(root,'preview/arara/dados-exemplo.js'),'utf8'),guarda="if(!['127.0.0.1','localhost'].includes(location.hostname))return;";
if(!fixture.includes(guarda))throw new Error('Dados demonstrativos mudaram: conferir isolamento.');
publicar('preview/arara/dados-exemplo.js',fixture.replace(guarda,'// Demonstração isolada; não copiar para produção.').replace('PRÉVIA COM DADOS DE TESTE','DEMONSTRAÇÃO PARA APROVAÇÃO · PEDIDOS E PAGAMENTOS DESATIVADOS'));
const rewrites=[{source:'/api/:path*',destination:'/preview/pagamentos-desativados.json'},{source:'/audio/:path*',destination:'https://loja-de-roupa-dom-malta.vercel.app/audio/:path*'}];
percorrer('images',file=>{
 if(!/\.(svg|png|jpe?g|webp|gif|ico)$/i.test(file))return;
 if(file.startsWith('images/colecao-nova/'))copiar(file);
 else rewrites.push({source:'/'+file,destination:'https://loja-de-roupa-dom-malta.vercel.app/'+file});
});
publicar('preview/pagamentos-desativados.json',JSON.stringify({habilitado:false,erro:'Pedidos e pagamentos desativados nesta demonstração.'}));
publicar('vercel.json',JSON.stringify({headers:[{source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}]}],rewrites},null,2));
fs.writeFileSync(path.join(root,'.preview-cliente-manifest.json'),JSON.stringify(arquivos));
console.log(JSON.stringify({arquivos:arquivos.length,bytes:arquivos.reduce((s,a)=>s+a.size,0),maior:Math.max(...arquivos.map(a=>a.size))}));
