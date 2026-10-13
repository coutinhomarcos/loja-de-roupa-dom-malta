document.addEventListener("DOMContentLoaded", async () => {
    const mensagem = document.getElementById("mensagem");
    const formulario = document.getElementById("formRedefinir");
    const botao = document.getElementById("salvarSenha");
    const novaSenha = document.getElementById("novaSenha");
    const confirmarSenha = document.getElementById("confirmarSenha");

    try {
        if (!window.supabase || !window.DOMMaltaConfig) {
            throw new Error(
                "Não foi possível carregar a conexão. Verifique a internet."
            );
        }

        const config = window.DOMMaltaConfig;

        const banco = window.supabase.createClient(
            config.url,
            config.chavePublica
        );

        const parametros = new URLSearchParams(
            window.location.hash.substring(1)
        );

        if (parametros.has("error")) {
            throw new Error(
                "O link de recuperação expirou ou é inválido. Solicite outro."
            );
        }

        // Aguarda a leitura da sessão enviada pelo link de recuperação.
        const { error: erroSessao } = await banco.auth.getSession();

        if (erroSessao) {
            throw erroSessao;
        }

        // Confirma a sessão com o Supabase antes de mostrar o formulário.
        const { data, error: erroUsuario } = await banco.auth.getUser();

        if (erroUsuario || !data.user) {
            throw new Error(
                "Abra esta página pelo link de recuperação recebido no e-mail."
            );
        }

        // Retira os dados do link da barra de endereço.
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

        mensagem.textContent = "Digite e confirme sua nova senha.";
        formulario.hidden = false;

        formulario.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            if (novaSenha.value.length < 8) {
                mensagem.textContent =
                    "Use uma senha com pelo menos 8 caracteres.";
                return;
            }

            if (novaSenha.value !== confirmarSenha.value) {
                mensagem.textContent = "As senhas não conferem.";
                return;
            }

            botao.disabled = true;
            mensagem.textContent = "Salvando nova senha…";

            try {
                const { error } = await banco.auth.updateUser({
                    password: novaSenha.value
                });

                if (error) {
                    throw error;
                }

                formulario.reset();
                formulario.hidden = true;
                mensagem.textContent =
                    "Senha atualizada! Clique em Voltar ao login e entre com a nova senha.";

                await banco.auth.signOut();
            } catch (erro) {
                mensagem.textContent =
                    erro.message || "Não foi possível alterar a senha.";
            } finally {
                botao.disabled = false;
            }
        });
    } catch (erro) {
        mensagem.textContent =
            erro.message || "Não foi possível validar o link.";
        formulario.hidden = true;
    }
});