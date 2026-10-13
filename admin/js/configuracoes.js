document.addEventListener('DOMContentLoaded', Banco.executar(async () => {
    if (!await adminPronto) return;
    // Formulário Dados da Loja
    const formLoja = document.getElementById('form-config-loja');
    if (formLoja) {
        formLoja.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('A edição dos dados da loja será configurada em uma próxima etapa.');
        });
    }

    // Formulário Preferências
    const formPref = document.getElementById('form-config-preferencias');
    if (formPref) {
        formPref.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Use o botão de tema para alternar claro e escuro neste navegador.');
        });
    }

    // Formulário Segurança / Senha
    const formSeguranca = document.getElementById('form-config-seguranca');
    if (formSeguranca) {
        formSeguranca.addEventListener('submit', Banco.executar(async (e) => {
            e.preventDefault();
            const novaSenha = document.getElementById('nova-senha').value;
            const confirmaSenha = document.getElementById('confirma-senha').value;

            if (novaSenha !== confirmaSenha) {
                alert('Erro: A confirmação de senha não confere!');
                return;
            }

            if (novaSenha.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
            await Banco.resultado(Banco.client.auth.updateUser({password: novaSenha}));
            alert('Senha alterada no Supabase.');
            formSeguranca.reset();
        }));
    }
}));


function resetarDadosSistema() { alert("O reset foi desativado para proteger o banco compartilhado. Nenhum dado foi apagado."); }
