/* Mensagens do provedor nunca são exibidas diretamente ao usuário. */
function mensagemErroSenha(erro) {
    const mensagens = {
        same_password: 'A nova senha deve ser diferente da senha anterior.',
        weak_password: 'Escolha uma senha mais forte que atenda aos critérios de segurança.',
        otp_expired: 'O link de recuperação expirou ou é inválido. Solicite outro.',
        session_not_found: 'Sua sessão expirou. Solicite um novo link de recuperação.',
        refresh_token_not_found: 'Sua sessão expirou. Solicite um novo link de recuperação.',
        reauthentication_needed: 'Confirme novamente seu acesso antes de alterar a senha.',
        over_request_rate_limit: 'Muitas tentativas. Aguarde um minuto e tente novamente.'
    };
    if (mensagens[erro?.code]) return mensagens[erro.code];
    if (/different from the old password/i.test(erro?.message || '')) return mensagens.same_password;
    if (erro?.status === 429) return mensagens.over_request_rate_limit;
    const locais = [
        'Não foi possível carregar a conexão. Verifique a internet.',
        'O link de recuperação expirou ou é inválido. Solicite outro.',
        'Abra esta página pelo link de recuperação recebido no e-mail.'
    ];
    if (locais.includes(erro?.message)) return erro.message;
    return 'Não foi possível concluir a alteração da senha. Verifique sua conexão e tente novamente. Se o link expirou, solicite outro.';
}
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
                    mensagemErroSenha(erro);
            } finally {
                botao.disabled = false;
            }
        });
    } catch (erro) {
        mensagem.textContent =
            mensagemErroSenha(erro);
        formulario.hidden = true;
    }
});
