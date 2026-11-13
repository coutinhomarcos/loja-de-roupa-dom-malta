'use strict';
const fs=require('node:fs'),path=require('node:path');
const raiz=path.resolve(__dirname,'..');let html=0;const faltam=[];
function verificar(pasta){for(const item of fs.readdirSync(pasta,{withFileTypes:true})){
    if(['.git','node_modules','.worktrees','.preview-cliente'].includes(item.name))continue;
    const arquivo=path.join(pasta,item.name);if(item.isDirectory()){verificar(arquivo);continue;}
    if(!arquivo.endsWith('.html'))continue;html++;
    const texto=fs.readFileSync(arquivo,'utf8');
    for(const m of texto.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
        let ref=m[1];if(/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref))continue;
        ref=decodeURIComponent(ref.split(/[?#]/)[0]);if(!ref||ref.startsWith('/api/'))continue;
        let destino=ref.startsWith('/')?path.join(raiz,ref):path.resolve(path.dirname(arquivo),ref);
        if(fs.existsSync(destino)&&fs.statSync(destino).isDirectory())destino=path.join(destino,'index.html');
        if(!fs.existsSync(destino))faltam.push(path.relative(raiz,arquivo)+' -> '+ref);
    }
}}
verificar(raiz);
console.log(html+' páginas verificadas.');
if(faltam.length){console.error(faltam.join('\n'));process.exitCode=1;}else console.log('Referências locais encontradas.');
