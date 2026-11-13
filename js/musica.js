document.addEventListener("DOMContentLoaded", () => {
    const audio = document.querySelector(".musica-pagina");
    const painel = document.querySelector(".controle-musica");
    const faixas = window.DOM_MALTA_MUSICAS || [];
    if (!audio || !painel || !faixas.length || audio.dataset.musicaInicializada) return;
    audio.dataset.musicaInicializada = "true";
    const menu = document.querySelector(".cabecalho .menu");
    if (menu) {
        const carrinho = menu.querySelector('[data-contador-carrinho]');
        const grupo = document.createElement('div');
        grupo.className = 'carrinho-e-musica';
        if (carrinho) { carrinho.before(grupo); grupo.append(carrinho); } else menu.append(grupo);
        const celular = window.matchMedia('(max-width:760px)');
        function posicionar() {
            painel.classList.toggle('musica-no-menu', celular.matches);
            if (celular.matches) grupo.append(painel); else document.body.append(painel);
        }
        celular.addEventListener('change', posicionar);
        posicionar();
    }
    const pausar = painel.querySelector('[data-acao="pausar"]');
    const silenciar = painel.querySelector('[data-acao="silenciar"]');
    const proxima = painel.querySelector('[data-acao="proxima"]');
    const titulo = painel.querySelector(".faixa-atual");
    const base = new URL(audio.dataset.pasta, location.href);
    let fila = [], atual = -1, solicitado = false, falhas = 0;
    const identidade = Math.random().toString(36).slice(2);
    const canal = window.BroadcastChannel ? new window.BroadcastChannel("dom-malta-musica") : null;
    const chaveSessao = 'domMaltaMusicaSessao';
    let saindo = false, tempoRestaurar = null;
    function salvar() {
        if (saindo || atual < 0) return;
        try { window.sessionStorage.setItem(chaveSessao, JSON.stringify({arquivo:faixas[atual].arquivo,tempo:audio.currentTime || 0,tocando:solicitado && !audio.paused,silenciado:audio.muted,fila})); } catch {}
    }
    function parar(){ solicitado = false; audio.pause(); atualizar(); salvar(); }
    canal?.addEventListener("message", e => { if(e.data !== identidade) parar(); });
    window.addEventListener?.("storage", e => { if(e.key === "domMaltaMusicaAtiva") parar(); });

    window.addEventListener?.("pagehide", () => { salvar(); saindo = true; audio.pause(); });
    window.addEventListener?.("pageshow", event => { saindo = false; if (event.persisted && solicitado) tocar(); });
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
        solicitado = true;
        try { await audio.play(); }
        catch { solicitado = false; }
        atualizar();
    }
    function avancar(tocarAgora=true) {
        if (!fila.length) embaralhar();
        atual = fila.shift();
        tempoRestaurar = null;
        audio.src = new URL(faixas[atual].arquivo, base).href;
        titulo.textContent = faixas[atual].titulo;
        if(tocarAgora)tocar();else atualizar();
    }
    audio.volume = 0.35;
    pausar.addEventListener("click", () => {
        if (audio.paused) { tocar(); }
        else { parar(); }
    });
    silenciar.addEventListener("click", () => { audio.muted = !audio.muted; atualizar(); salvar(); });
    proxima.addEventListener("click", () => { falhas = 0; avancar(); });
    audio.addEventListener("ended", () => avancar(solicitado));
    audio.addEventListener("playing", () => {
        falhas = 0; canal?.postMessage(identidade);
        try { window.localStorage.setItem("domMaltaMusicaAtiva", identidade + Date.now()); } catch {}
        atualizar();
    });
    ["pause", "volumechange"].forEach(e => audio.addEventListener(e, () => { atualizar(); salvar(); }));
    audio.addEventListener("timeupdate", salvar);
    audio.addEventListener("loadedmetadata", () => { if (tempoRestaurar !== null) { try { audio.currentTime = tempoRestaurar; } catch {} tempoRestaurar = null; } });
    audio.addEventListener("error", () => {
        if (++falhas < faixas.length) avancar(solicitado);
        else { titulo.textContent = "N\u00e3o foi poss\u00edvel carregar as m\u00fasicas. Tente abrir pelo Live Server."; atualizar(); }
    });
    let sessao;
    try { sessao = JSON.parse(window.sessionStorage.getItem(chaveSessao)); } catch {}
    const anterior = faixas.findIndex(f => f.arquivo === sessao?.arquivo);
    if (anterior >= 0) {
        atual = anterior;
        fila = Array.isArray(sessao.fila) ? sessao.fila.filter(i => Number.isInteger(i) && i >= 0 && i < faixas.length) : [];
        tempoRestaurar = Number.isFinite(sessao.tempo) && sessao.tempo >= 0 ? sessao.tempo : 0;
        audio.muted = sessao.silenciado === true;
        audio.src = new URL(faixas[atual].arquivo, base).href;
        titulo.textContent = faixas[atual].titulo;
        if (sessao.tocando === true) tocar(); else atualizar();
    } else avancar(false);
});



