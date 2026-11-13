/* A sessão é gerenciada pelo Supabase. Produtos não são salvos no localStorage. */
(() => {
    const cfg = window.DOMMaltaConfig;
    const client = window.supabase?.createClient(cfg.url, cfg.chavePublica);
    function verificar() {
        if (!client) throw new Error('Não foi possível carregar a conexão. Verifique a internet e recarregue.');
        return client;
    }
    async function resultado(query) {
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }
    async function listar(tabela) {
        const rows = [];
        for (let inicio = 0; ; inicio += 1000) {
            const pagina = await resultado(verificar().from(tabela).select('*').order(tabela === 'clientes' ? 'codigo' : tabela === 'produto_custos' ? 'produto_id' : 'id').range(inicio, inicio + 999));
            rows.push(...pagina);
            if (pagina.length < 1000) return rows;
        }
    }
    async function produtos() {
        const [bases, variacoes, custos] = await Promise.all([
            listar('produtos'), listar('produto_variacoes'), listar('produto_custos')
        ]);
        return variacoes.map(v => {
            const p = bases.find(p => p.id === v.produto_id);
            return p && {
                ...p, ...v, produto_id: p.id, codigoBase: p.codigo,
                custo: Number(custos.find(c => c.produto_id === p.id)?.custo || 0),
                preco: Number(p.preco), estoque: Number(v.estoque),
                disponivel: Number(v.estoque) - Number(v.reservado)
            };
        }).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }
    function mensagem(erro) {
        console.error(erro);
        const el = document.getElementById('mensagemBanco');
        const texto = erro?.message || 'Não foi possível concluir. Verifique a conexão.';
        if (el) { el.textContent = texto; el.setAttribute('role', 'alert'); }
        else alert(texto);
    }
    function executar(fn) {
        return async (...args) => { try { return await fn(...args); } catch (erro) { mensagem(erro); } };
    }
    function esc(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function moeda(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    async function administrador() {
        const { data, error } = await verificar().auth.getUser();
        if (error || !data.user) return false;
        const rows = await resultado(client.from('administradores').select('usuario_id').eq('usuario_id', data.user.id));
        return rows.length === 1;
    }
    window.Banco = {
        client, resultado, listar, produtos, mensagem, executar, esc, moeda, administrador,
        rpc: (nome, args) => resultado(verificar().rpc(nome, args)),
        salvar: (tabela, dados) => resultado(verificar().from(tabela).upsert(dados).select()),
        excluir: (tabela, coluna, valor) => resultado(verificar().from(tabela).delete().eq(coluna, valor)),
        atualizar: (tabela, dados, coluna, valor) => resultado(verificar().from(tabela).update(dados).eq(coluna, valor).select())
    };
    // Formulários nativos da página: funcionam também no navegador de prévia.
    window.Banco.formulario = ({titulo,campos,confirmacao=false}) => new Promise(resolve=>{
        const dialog=document.createElement('dialog');dialog.className='inventario-dialog';
        const form=document.createElement('form'),h=document.createElement('h2');h.textContent=titulo;form.append(h);
        const inputs={};
        for(const campo of campos){
            const label=document.createElement('label'),input=document.createElement('input');label.textContent=campo.label;
            input.name=campo.nome;input.type=campo.tipo||'text';input.value=campo.valor??'';input.required=campo.obrigatorio!==false;
            for(const atributo of ['min','max','step','maxLength'])if(campo[atributo]!==undefined)input[atributo]=campo[atributo];
            inputs[campo.nome]=input;label.append(input);form.append(label);
        }
        const acoes=document.createElement('div'),cancelar=document.createElement('button'),salvar=document.createElement('button');
        cancelar.type='button';cancelar.textContent='Cancelar';salvar.type='submit';salvar.textContent=confirmacao?'Confirmar':'Continuar';acoes.append(cancelar,salvar);form.append(acoes);dialog.append(form);
        let resultado=null;cancelar.addEventListener('click',()=>dialog.close());
        form.addEventListener('submit',e=>{e.preventDefault();resultado=Object.fromEntries(Object.entries(inputs).map(([k,i])=>[k,i.value.trim()]));dialog.close();});
        dialog.addEventListener('close',()=>{dialog.remove();resolve(resultado);},{once:true});document.body.append(dialog);dialog.showModal();
    });
    window.Banco.confirmar = async texto => (await Banco.formulario({titulo:texto,campos:[],confirmacao:true}))!==null;
    const login = document.getElementById('loginForm');
    window.adminPronto = (async () => {
        if (login) return true;
        try {
            if (!await administrador()) {
                location.replace('../index.html');
                return false;
            }
            document.documentElement.classList.remove('aguardando-login');
            return true;
        } catch (erro) {
            document.documentElement.classList.remove('aguardando-login');
            document.querySelector('main')?.replaceChildren();
            mensagem(erro);
            return false;
        }
    })();
    document.addEventListener('DOMContentLoaded', () => {
        const verLoja = document.createElement('a');
        verLoja.textContent = '↗ Ver loja';
        verLoja.href = login ? '../index.html' : '../../index.html';
        verLoja.target = '_blank';
        verLoja.rel = 'noopener noreferrer';
        verLoja.className = 'banco-ver-loja';
        if (login) document.querySelector('.create-account')?.append(document.createElement('br'), verLoja);
        else document.querySelector('.sidebar nav')?.append(verLoja);
        if (login) return;
        const sair = document.createElement('button');
        sair.type = 'button'; sair.textContent = 'Sair'; sair.className = 'banco-sair';
        sair.addEventListener('click', executar(async () => {
            await resultado(client.auth.signOut()); location.replace('../index.html');
        }));
        document.body.append(sair);
        client?.auth.onAuthStateChange(event => {
            if (event === 'SIGNED_OUT') location.replace('../index.html');
        });
    });
})();
