/* Ampliação acessível das fotos, inclusive por teclado. */
const imagensProdutos = document.querySelectorAll('.produto-imagem');
const modalImagem = document.getElementById('modalImagem');
const imagemAmpliada = document.getElementById('imagemAmpliada');
const fecharModal = document.getElementById('fecharModal');
let focoAnterior;
function abrirImagem(imagem) {
    focoAnterior = document.activeElement;
    imagemAmpliada.src = imagem.src;
    imagemAmpliada.alt = imagem.alt;
    modalImagem.classList.add('ativo');
    modalImagem.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-aberto');
    fecharModal.focus();
}
function fecharImagem() {
    modalImagem.classList.remove('ativo');
    modalImagem.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-aberto');
    imagemAmpliada.src = '';
    focoAnterior?.focus();
}
imagensProdutos.forEach(botao => botao.addEventListener('click',()=>abrirImagem(botao.querySelector('img'))));
fecharModal.addEventListener('click',fecharImagem);
modalImagem.addEventListener('click',e=>{if(e.target===modalImagem)fecharImagem();});
document.addEventListener('keydown',e=>{
    if(!modalImagem.classList.contains('ativo'))return;
    if(e.key==='Escape'){fecharImagem();return;}
    if(e.key==='Tab'){
        const controles=[...modalImagem.querySelectorAll('button:not(:disabled),a[href]')],primeiro=controles[0],ultimo=controles.at(-1);
        if(e.shiftKey&&document.activeElement===primeiro){e.preventDefault();ultimo.focus();}
        else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primeiro.focus();}
    }
});
