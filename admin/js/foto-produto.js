/* Troca de foto de um produto existente, sem alterar suas variações. */
window.editarFotoProduto=produto=>new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='foto-produto-dialog';
    dialog.innerHTML='<form><h2>Foto do produto</h2><p class="foto-produto-nome"></p><label>Escolha uma foto JPG, PNG ou WebP, até 8 MB<input type="file" accept="image/jpeg,image/png,image/webp" required></label><img class="foto-produto-previa" alt="Prévia da nova foto" hidden><p>A foto será otimizada e salva no Supabase Storage. Arara e Coleção usam automaticamente o mesmo endereço.</p><p role="status" class="foto-produto-status"></p><div><button type="button" class="cancelar-foto">Cancelar</button><button type="submit">Salvar foto</button></div></form>';
    dialog.querySelector('.foto-produto-nome').textContent=produto.nome;
    const form=dialog.querySelector('form'),input=form.querySelector('input'),previa=form.querySelector('img'),status=form.querySelector('[role="status"]'),salvar=form.querySelector('[type="submit"]'),cancelar=form.querySelector('.cancelar-foto');
    let blobUrl=null,arquivoEnviado=null,urlEnviada=null,salvo=false,ocupado=false;
    input.addEventListener('change',()=>{if(blobUrl)URL.revokeObjectURL(blobUrl);const file=input.files[0];previa.hidden=!file;if(file){blobUrl=URL.createObjectURL(file);previa.src=blobUrl;}});
    cancelar.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();});
    dialog.addEventListener('close',()=>{if(blobUrl)URL.revokeObjectURL(blobUrl);dialog.remove();resolve(salvo);},{once:true});
    form.addEventListener('submit',async e=>{
        e.preventDefault();const file=input.files[0];if(!file||ocupado)return;
        ocupado=true;salvar.disabled=true;cancelar.disabled=true;input.disabled=true;status.textContent='Otimizando e salvando a foto…';
        try{
            if(file!==arquivoEnviado){urlEnviada=await ImagensProduto.enviar(file);arquivoEnviado=file;}
            const linhas=await Banco.atualizar('produtos',{imagem_url:urlEnviada},'id',produto.produto_id);
            if(!linhas?.some(p=>p.id===produto.produto_id&&p.imagem_url===urlEnviada))throw new Error('A foto foi enviada, mas a atualização do produto não foi confirmada. Confira seu acesso e tente novamente.');
            Inventario.notificar();salvo=true;dialog.close();
        }catch(erro){status.textContent=erro.message||'Não foi possível atualizar a foto.';}
        finally{ocupado=false;salvar.disabled=false;cancelar.disabled=false;input.disabled=false;}
    });
    document.body.append(dialog);dialog.showModal();
});
