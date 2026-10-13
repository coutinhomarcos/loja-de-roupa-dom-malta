document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById("videoCabecalho");
    const pausar = document.getElementById("pausarVideo");
    const silenciar = document.getElementById("silenciarVideo");
    if (!video || !pausar || !silenciar) return;
    let bloqueado = false, pausaManual = false, somManual = false;
    function atualizar() {
        pausar.textContent = video.paused || bloqueado ? "Iniciar m\u00fasica" : "Pausar m\u00fasica";
        pausar.setAttribute("aria-pressed", String(!video.paused && !bloqueado));
        silenciar.textContent = video.muted ? "Ativar som" : "Silenciar";
        silenciar.setAttribute("aria-pressed", String(video.muted));
    }
    async function iniciar() {
        if (!somManual) video.muted = false;
        try { await video.play(); bloqueado = false; }
        catch {
            bloqueado = true;
            video.muted = true;
            try { await video.play(); } catch { /* Tentar novamente pelo botao. */ }
        }
        atualizar();
    }
    pausar.addEventListener("click", () => {
        if (video.paused || bloqueado) { pausaManual = false; iniciar(); }
        else { pausaManual = true; video.pause(); atualizar(); }
    });
    silenciar.addEventListener("click", () => {
        video.muted = !video.muted;
        somManual = video.muted;
        if (!video.muted) { pausaManual = false; iniciar(); }
        atualizar();
    });
    document.addEventListener("click", e => {
        if (bloqueado && !pausaManual && !somManual && !e.target.closest(".controle-musica")) iniciar();
    });
    ["play", "pause", "volumechange"].forEach(e => video.addEventListener(e, atualizar));
    video.volume = 1;
    iniciar();
});
