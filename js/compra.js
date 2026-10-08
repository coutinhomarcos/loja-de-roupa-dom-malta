document.addEventListener("DOMContentLoaded", () => {
    const produto = new URLSearchParams(location.search).get("produto");
    if (!produto) return;
    document.getElementById("pedidoCompra").hidden = false;
    document.getElementById("produtoPedido").textContent = produto;
    const mensagem = document.getElementById("mensagemPedido");
    mensagem.value = `Ol\u00e1, DOM MALTA! Tenho interesse em ${produto}. Quais s\u00e3o o pre\u00e7o, tamanhos, cores e op\u00e7\u00f5es de entrega?`;
    document.getElementById("copiarPedido").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(mensagem.value);
            document.getElementById("statusPedido").textContent = "Mensagem copiada. Envie \u00e0 loja pelo Instagram ou WhatsApp abaixo.";
        } catch {
            mensagem.select();
            document.getElementById("statusPedido").textContent = "Selecione e copie a mensagem para enviar \u00e0 loja.";
        }
    });
});
