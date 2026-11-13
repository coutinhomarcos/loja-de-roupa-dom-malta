# Retomada — DOM MALTA

Salvo em 11/11/2026, a pedido do usuário, para continuar amanhã.

## Última entrega
- Busca e filtros da Coleção publicados na prévia do cliente: https://dom-malta-previa-cliente.vercel.app/pages/colecao.html
- Busca por texto, tamanho, cor e disponibilidade; contagem e limpar filtros.
- Tamanho, cor e disponibilidade correspondem à mesma variação do produto.
- Conferidos resultados, combinação sem resultados, limpeza e visualização no celular.
- Sete testes direcionados passaram; verificação de 21 páginas e sintaxe de catalogo.js passaram.
- Deployment: dpl_HWx8QUx35Aj4jUmGcx8PCAZRvrKm (projeto separado dom-malta-previa-cliente).
- ZIP DOM-MALTA-atualizado.zip atualizado: 250 arquivos, aproximadamente 84,1 MB.

## Limites e pendências
- Loja oficial preservada: https://loja-de-roupa-dom-malta.vercel.app/
- Pagamentos reais permanecem desativados.
- A prévia usa dados demonstrativos e não permite compras reais.
- Ainda faltam dados reais do proprietário, credenciais de produção do Mercado Pago, configuração final do webhook e informações de embalagem/Correios para frete + 5%.
- Não alterar SIGAP, Java 21 nem atualizar VS Code.
- Alterações recentes estão salvas localmente; não afirmar que foram enviadas ao GitHub sem verificar commit/push.

## Retomada
- Consultar docs/PREVIA-CLIENTE.md e docs/MANUAL-OPERACAO.md.
- Perguntar ao usuário qual ajuste deseja após avaliar a prévia; não ativar pagamentos nem publicar na loja oficial automaticamente.
- Projeto local: C:\Users\Coutinho\Desktop\Projetos GitHub\loja-de-roupa-dom-malta
- Workspace do VS Code: DOM-MALTA.code-workspace.

## Encerramento de 12/11/2026 — retomada amanhã
- Prévia atual: https://dom-malta-previa-cliente.vercel.app/
- Último deployment READY: dpl_BAEL967QtGEeY4CiwSyEAG59qGfe.
- Botões públicos padronizados em cápsula dourada; skill dom-malta-identidade atualizada; atalhos sociais preservados.
- Arara sem rolagem interna no estado de vitrine; detalhes ajustados à área visível abaixo do cabeçalho para não cortar o rosto.
- Setas grossas nos detalhes: junto da foto no desktop e abaixo de Fechar no celular; percorrem toda a categoria sem fechar.
- Carrinho com espaçamento entre ações e player de música.
- Música preserva sessão de reprodução entre páginas e não pausa por segundo plano; pausa manual respeitada. Três testes de áudio passaram e reprodução automática conferida na prévia publicada.
- Arquivos e ZIP salvos localmente. Não afirmar envio ao GitHub sem verificar commit/push.
- Loja oficial não alterada; pagamentos reais continuam desativados. Dados do proprietário, Mercado Pago e frete continuam pendentes.
- Não alterar SIGAP, Java 21 nem atualizar VS Code.
- Ao retomar, consultar docs/PREVIA-CLIENTE.md para o histórico e aguardar o próximo ajuste do usuário.

## Retomada de 13/11/2026
- Usuário confirmou: dados reais do proprietário ainda pendentes.
- Próximos passos e lista exata de dados organizados em docs/PROXIMOS-PASSOS.md; pendências antigas identificadas como histórico.
- Corrigido scripts/preparar-previa-cliente.js: manifesto explícito, somente runtime e fotos novas; documentos/env/SQL e sobras não são publicados. Imagens antigas/música reutilizam URLs publicadas.
- Teste tests/previa-pacote.test.js passou; pacote real 99 arquivos / 1.495.670 bytes, 21 páginas válidas. Não foi necessária nova publicação do visual nem mudança no banco.
