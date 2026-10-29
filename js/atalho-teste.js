// O atalho só aparece quando o servidor confirma o ambiente Preview.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const r = await fetch('/api/pagamento-teste', { cache: 'no-store' });
        if (!r.ok || !(await r.json()).habilitado) return;
        const aviso = document.createElement('p'), link = document.createElement('a');
        link.href = 'compra-teste.html';
        link.textContent = 'Abrir compra de teste com Mercado Pago (administrador)';
        link.className = 'botao botao-dourado'; aviso.append(link);
        document.getElementById('mensagemCompra').before(aviso);
    } catch { /* Live Server e produção continuam com o carrinho normal. */ }
});
