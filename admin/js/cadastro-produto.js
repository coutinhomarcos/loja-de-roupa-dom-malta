document.addEventListener('DOMContentLoaded', Banco.executar(async () => {
    if (!await adminPronto) return;
    const el = id => document.getElementById(id);
    const form = el('formProduto');
    const categoria = el('categoria'), outra = el('categoriaOutro');
    let grade = [], assinatura = '';
    categoria.addEventListener('change', () => {
        outra.style.display = categoria.value === 'Outro' ? 'block' : 'none';
        outra.required = categoria.value === 'Outro';
    });
    function atualizarResumo() {
        el('resumoGrade').textContent = `${grade.length} combinações · ${grade.reduce((s,v) => s + (Number.isFinite(v.estoque) ? v.estoque : 0), 0)} peças`;
    }
    function renderizar() {
        el('gradeVariacoes').replaceChildren();
        grade.forEach(v => {
            const tr = document.createElement('tr');
            [v.tamanho, v.cor].forEach(texto => { const td = document.createElement('td'); td.textContent = texto; tr.append(td); });
            const td = document.createElement('td'), input = document.createElement('input');
            input.type='number'; input.min='0'; input.max='1000000'; input.step='1'; input.required=true;
            input.value=v.estoque; input.setAttribute('aria-label', `Quantidade ${v.tamanho}, ${v.cor}`);
            input.addEventListener('input', () => { v.estoque=input.value === '' ? NaN : Number(input.value); atualizarResumo(); });
            td.append(input); tr.append(td); el('gradeVariacoes').append(tr);
        });
        atualizarResumo();
    }
    el('gerarGrade').addEventListener('click', Banco.executar(() => {
        const nova = Grade.gerar(el('tamanhos').value,el('cores').value);
        grade = nova.map(v => ({...v, estoque: grade.find(g => g.tamanho === v.tamanho && g.cor === v.cor)?.estoque || 0}));
        assinatura = JSON.stringify([el('tamanhos').value,el('cores').value]); renderizar();
    }));
    el('aplicarQuantidade').addEventListener('click', Banco.executar(() => {
        const valor = el('quantidadePadrao').value;
        const n = Number(valor);
        if (!valor || !Number.isInteger(n) || n < 0 || n > 1000000) throw new Error('Informe uma quantidade inteira válida.');
        grade.forEach(v => v.estoque=n); renderizar();
    }));
    async function imagem() {
        const file = el('imagem').files[0];
        if (!file) return null;
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 300 * 1024)
            throw new Error('Use imagem JPG, PNG ou WebP de até 300 KB.');
        return new Promise((resolve,reject) => {
            const reader=new FileReader(); reader.onload=()=>resolve(reader.result);
            reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file);
        });
    }
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const btn=form.querySelector('[type="submit"]'); btn.disabled=true;
        try {
            if (assinatura !== JSON.stringify([el('tamanhos').value,el('cores').value]))
                throw new Error('Você alterou os tamanhos ou cores. Clique em Gerar grade novamente.');
            Grade.validar(grade);
            const dados = {
                codigo: el('codigo').value.trim(),nome:el('nome').value.trim(),
                categoria:categoria.value === 'Outro' ? outra.value.trim() : categoria.value,
                custo:Number(el('custo').value),preco:Number(el('preco').value),
                marca:el('marca').value.trim(),descricao:el('descricao').value.trim(),imagem_url:await imagem()
            };
            await Banco.rpc('cadastrar_produto_grade',{dados,grade});
            alert('Produto e variações cadastrados no Supabase.'); location.href='produtos.html';
        } catch(erro) { Banco.mensagem(erro); }
        finally { btn.disabled=false; }
    });
}));
