'use strict';
(() => {
    function dimensoes(largura,altura,limite=1280){
        if(!Number.isFinite(largura)||!Number.isFinite(altura)||largura<=0||altura<=0)throw new Error('Dimensões da foto inválidas.');
        const escala=Math.min(1,limite/Math.max(largura,altura));
        return {largura:Math.max(1,Math.round(largura*escala)),altura:Math.max(1,Math.round(altura*escala))};
    }
    async function otimizar(file){
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Use foto JPG, PNG ou WebP de até 8 MB.');
        let imagem;
        try{imagem=await createImageBitmap(file);}catch{throw new Error('Não foi possível abrir a foto. Exporte como JPG, PNG ou WebP.');}
        try{
            const tamanho=dimensoes(imagem.width,imagem.height),canvas=document.createElement('canvas');
            canvas.width=tamanho.largura;canvas.height=tamanho.altura;
            canvas.getContext('2d').drawImage(imagem,0,0,canvas.width,canvas.height);
            for(const qualidade of [.82,.72,.62,.5]){
                const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',qualidade));
                if(!blob||blob.type!=='image/webp')throw new Error('Use um navegador atualizado para otimizar a foto.');
                if(blob.size<=350*1024)return blob;
            }
            throw new Error('A foto ainda ficou grande após otimizar. Recorte ou escolha uma versão menor.');
        }finally{imagem.close();}
    }
    async function enviar(file){
        const blob=await otimizar(file),caminho='catalogo/'+crypto.randomUUID()+'.webp';
        const storage=Banco.client.storage.from('produtos');
        const {error}=await storage.upload(caminho,blob,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
        if(error)throw new Error('Não foi possível salvar a foto no Supabase Storage. Confira a conexão e o acesso administrativo.');
        const {data}=storage.getPublicUrl(caminho);
        if(!data?.publicUrl)throw new Error('A foto foi enviada, mas o endereço não foi confirmado.');
        return data.publicUrl;
    }
    window.ImagensProduto={dimensoes,otimizar,enviar};
})();
