// =========================
// GALERIA - IMAGEM AMPLIADA
// =========================

const imagensProdutos = document.querySelectorAll(".produto-imagem img");
const modalImagem = document.getElementById("modalImagem");
const imagemAmpliada = document.getElementById("imagemAmpliada");
const fecharModal = document.getElementById("fecharModal");

function abrirImagem(imagem) {
    imagemAmpliada.src = imagem.src;
    imagemAmpliada.alt = imagem.alt;
    modalImagem.classList.add("ativo");
    modalImagem.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-aberto");
}

function fecharImagem() {
    modalImagem.classList.remove("ativo");
    modalImagem.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-aberto");
    imagemAmpliada.src = "";
}

imagensProdutos.forEach((imagem) => {
    imagem.addEventListener("click", () => {
        abrirImagem(imagem);
    });
});

fecharModal.addEventListener("click", fecharImagem);

modalImagem.addEventListener("click", (evento) => {
    if (evento.target === modalImagem) {
        fecharImagem();
    }
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && modalImagem.classList.contains("ativo")) {
        fecharImagem();
    }
});
