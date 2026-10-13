const form = document.getElementById('loginForm');
const email = document.getElementById('email');
const senha = document.getElementById('senha');
document.getElementById('togglePassword').addEventListener('click', () => {
    senha.type = senha.type === 'password' ? 'text' : 'password';
});
form.addEventListener('submit', async event => {
    event.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    document.getElementById('mensagemBanco').textContent = 'Entrando…';
    try {
        await Banco.resultado(Banco.client.auth.signInWithPassword({ email: email.value.trim(), password: senha.value }));
        if (!await Banco.administrador()) {
            await Banco.client.auth.signOut();
            throw new Error('Este usuário não tem permissão de administrador.');
        }
        location.href = 'pages/dashboard.html';
    } catch (erro) { Banco.mensagem(erro); }
    finally { btn.disabled = false; }
});
