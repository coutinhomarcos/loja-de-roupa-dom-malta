document.addEventListener("DOMContentLoaded", function () {

    const video = document.getElementById("videoCabecalho");
    const botaoSom = document.getElementById("botaoSomVideo");

    if (!video || !botaoSom) {
        return;
    }

    function atualizarBotaoSom() {
        if (video.muted) {
            botaoSom.textContent = "🔊 Ativar som";
            botaoSom.setAttribute("aria-label", "Ativar som do vídeo");
            botaoSom.classList.remove("som-ativo");
        } else {
            botaoSom.textContent = "🔇 Silenciar";
            botaoSom.setAttribute("aria-label", "Silenciar o vídeo");
            botaoSom.classList.add("som-ativo");
        }
    }

    botaoSom.addEventListener("click", function () {

        if (video.muted) {
            // Ativa o áudio.
            video.muted = false;
            video.volume = 1;

            video.play().then(function () {
                atualizarBotaoSom();
            }).catch(function () {
                // Se o navegador bloquear a reprodução, mantemos o vídeo sem som.
                video.muted = true;
                atualizarBotaoSom();
            });

        } else {
            // Desativa o áudio.
            video.muted = true;
            atualizarBotaoSom();
        }
    });

    // Mantém o texto correto caso o estado do vídeo seja alterado pelo navegador.
    video.addEventListener("volumechange", atualizarBotaoSom);

    atualizarBotaoSom();

});
