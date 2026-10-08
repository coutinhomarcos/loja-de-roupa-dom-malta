document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById("videoCabecalho");
    const botao = document.getElementById("silenciarVideo");
    if (!video || !botao) return;
    let silenciadoPeloCliente = false, bloqueado = false;
    function atualizar() {
        botao.textContent = silenciadoPeloCliente ? "Reativar som" : "Silenciar m\u00fasica";
        botao.setAttribute("aria-pressed", String(silenciadoPeloCliente));
    }
    async function reproduzir() {
        video.muted = silenciadoPeloCliente;
        try { await video.play(); bloqueado = false; }
        catch {
            bloqueado = !silenciadoPeloCliente;
            video.muted = true;
            try { await video.play(); } catch { /* Aguarda interacao do visitante. */ }
        }
        atualizar();
    }
    botao.addEventListener("click", () => {
        silenciadoPeloCliente = !silenciadoPeloCliente;
        video.muted = silenciadoPeloCliente;
        reproduzir();
    });
    document.addEventListener("click", e => {
        if (e.target.closest(".controle-musica")) return;
        if (bloqueado && !silenciadoPeloCliente) reproduzir();
    });
    video.volume = 1;
    atualizar();
    reproduzir();
});
