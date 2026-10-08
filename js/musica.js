document.addEventListener("DOMContentLoaded", () => {
    const audio = document.querySelector(".musica-pagina");
    const painel = document.querySelector(".controle-musica");
    const faixas = window.DOM_MALTA_MUSICAS || [];
    if (!audio || !painel || !faixas.length) return;
    const pausar = painel.querySelector('[data-acao="pausar"]');
    const silenciar = painel.querySelector('[data-acao="silenciar"]');
    const proxima = painel.querySelector('[data-acao="proxima"]');
    const titulo = painel.querySelector(".faixa-atual");
    const base = new URL(audio.dataset.pasta, location.href);
    let fila = [], atual = -1, bloqueado = false, pausadoPeloCliente = false, falhas = 0;
    function embaralhar() {
        fila = faixas.map((_, i) => i);
        for (let i = fila.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fila[i], fila[j]] = [fila[j], fila[i]];
        }
        if (fila.length > 1 && fila[0] === atual) [fila[0], fila[1]] = [fila[1], fila[0]];
    }
    function atualizar() {
        pausar.textContent = audio.paused ? "\u25b6 Iniciar m\u00fasica" : "\u2161 Pausar m\u00fasica";
        pausar.setAttribute("aria-pressed", String(!audio.paused));
        silenciar.textContent = audio.muted ? "\ud83d\udd0a Ativar som" : "\ud83d\udd07 Silenciar";
        silenciar.setAttribute("aria-pressed", String(audio.muted));
    }
    async function tocar() {
        try { await audio.play(); bloqueado = false; }
        catch { bloqueado = true; }
        atualizar();
    }
    function avancar() {
        if (!fila.length) embaralhar();
        atual = fila.shift();
        audio.src = new URL(faixas[atual].arquivo, base).href;
        titulo.textContent = faixas[atual].titulo;
        tocar();
    }
    audio.volume = 0.35;
    pausar.addEventListener("click", () => {
        if (audio.paused) { pausadoPeloCliente = false; tocar(); }
        else { pausadoPeloCliente = true; audio.pause(); }
    });
    silenciar.addEventListener("click", () => { audio.muted = !audio.muted; atualizar(); });
    proxima.addEventListener("click", () => { pausadoPeloCliente = false; falhas = 0; avancar(); });
    audio.addEventListener("ended", avancar);
    audio.addEventListener("playing", () => { falhas = 0; atualizar(); });
    ["pause", "volumechange"].forEach(e => audio.addEventListener(e, atualizar));
    audio.addEventListener("error", () => {
        if (++falhas < faixas.length) avancar();
        else { titulo.textContent = "N\u00e3o foi poss\u00edvel carregar as m\u00fasicas. Tente abrir pelo Live Server."; atualizar(); }
    });
    document.addEventListener("click", e => {
        if (bloqueado && !pausadoPeloCliente && !painel.contains(e.target)) tocar();
    });
    // O v\u00eddeo permanece sem \u00e1udio para n\u00e3o misturar duas m\u00fasicas.
    const video = document.getElementById("videoCabecalho");
    if (video) { video.muted = true; const tentativa = video.play(); if (tentativa) tentativa.catch(() => {}); }
    avancar();
});
