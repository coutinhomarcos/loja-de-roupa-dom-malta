document.addEventListener('DOMContentLoaded', Banco.executar(async () => {
    if (!await adminPronto) return;
    const campo=id=>document.getElementById(id);
    const [cfg]=await Banco.resultado(Banco.client.from('configuracoes_loja').select('*').eq('id',1));
    for(const [id,nome]of Object.entries({'nome-loja':'nome',cnpj:'cnpj',telefone:'telefone',endereco:'endereco','limite-estoque':'limite_estoque'}))campo(id).value=cfg[nome];
    campo('notif-estoque').checked=cfg.aviso_estoque;
    async function salvar(dados){await Banco.resultado(Banco.client.from('configuracoes_loja').update({...dados,atualizado_em:new Date().toISOString()}).eq('id',1).select().single());alert('Configurações salvas no banco.');}
    // Formulário Dados da Loja
    const formLoja = document.getElementById('form-config-loja');
    if (formLoja) {
        formLoja.addEventListener('submit', Banco.executar(async (e) => {
            e.preventDefault();
            const nome=campo('nome-loja').value.trim(),cnpj=campo('cnpj').value.replace(/\D/g,''),telefone=campo('telefone').value.replace(/\D/g,''),endereco=campo('endereco').value.trim();
            if(!nome||nome.length>120||(cnpj&&!/^\d{14}$/.test(cnpj))||(telefone&&!/^\d{10,13}$/.test(telefone))||endereco.length>500)throw new Error('Confira nome, CNPJ, telefone e endereço. Deixe os dados desconhecidos em branco.');
            await salvar({nome,cnpj,telefone,endereco});
        }));
    }

    // Formulário Preferências
    const formPref = document.getElementById('form-config-preferencias');
    if (formPref) {
        formPref.addEventListener('submit', Banco.executar(async (e) => {
            e.preventDefault();
            const limite=Number(campo('limite-estoque').value);if(!Number.isInteger(limite)||limite<1||limite>9999)throw new Error('Informe um limite de estoque entre 1 e 9999.');
            await salvar({limite_estoque:limite,aviso_estoque:campo('notif-estoque').checked});
        }));
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
            const {data:{user},error}=await Banco.client.auth.getUser();if(error||!user)throw new Error('Entre novamente no painel.');
            await Banco.resultado(Banco.client.auth.signInWithPassword({email:user.email,password:campo('senha-atual').value}));
            await Banco.resultado(Banco.client.auth.updateUser({password: novaSenha}));
            alert('Senha alterada no Supabase.');
            formSeguranca.reset();
        }));
    }
}));


function resetarDadosSistema() { alert("O reset foi desativado para proteger o banco compartilhado. Nenhum dado foi apagado."); }
