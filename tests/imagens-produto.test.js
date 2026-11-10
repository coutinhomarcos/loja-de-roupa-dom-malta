'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs');
function imagemApi(){let upload=null;const canvas={getContext:()=>({drawImage(){}}),toBlob:fn=>fn({type:'image/webp',size:42000})};
    const contexto={window:{},document:{createElement:()=>canvas},createImageBitmap:async()=>({width:4000,height:3000,close(){}}),crypto:{randomUUID:()=> 'foto-id'},Banco:{client:{storage:{from:nome=>({upload:async(caminho,blob,opcoes)=>{upload={nome,caminho,blob,opcoes};return{error:null};},getPublicUrl:caminho=>({data:{publicUrl:'https://exemplo.supabase.co/storage/v1/object/public/produtos/'+caminho}})})}}}};
    vm.runInNewContext(fs.readFileSync('admin/js/imagens.js','utf8'),contexto);return{api:contexto.window.ImagensProduto,get upload(){return upload;}};
}
test('foto grande preserva proporção e não amplia foto pequena',()=>{const {api}=imagemApi();const d=api.dimensoes(4000,3000);assert.equal(d.largura,1280);assert.equal(d.altura,960);assert.equal(api.dimensoes(200,100).largura,200);});
test('foto é enviada ao Storage como WebP e produto recebe apenas URL',async()=>{const r=imagemApi();const url=await r.api.enviar({type:'image/jpeg',size:2000000});assert.match(url,/storage\/v1\/object\/public\/produtos/);assert.ok(!url.startsWith('data:'));assert.equal(r.upload.nome,'produtos');assert.equal(r.upload.blob.type,'image/webp');assert.equal(r.upload.opcoes.upsert,false);assert.equal(r.upload.opcoes.cacheControl,'31536000');});
test('não aceita arquivos fora dos formatos e limites permitidos',async()=>{const {api}=imagemApi();await assert.rejects(api.otimizar({type:'image/svg+xml',size:10}),/JPG/);await assert.rejects(api.otimizar({type:'image/png',size:9*1024*1024}),/8 MB/);});
