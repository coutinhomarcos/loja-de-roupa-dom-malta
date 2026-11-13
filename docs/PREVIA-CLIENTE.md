# Prévia para o cliente — DOM MALTA

Link público verificado: https://dom-malta-previa-cliente.vercel.app/

Projeto Vercel separado: dom-malta-previa-cliente (prj_jPP5wV9Yjvlp4Vxlw79UaitfavVf).
Deployment: dpl_HWx8QUx35Aj4jUmGcx8PCAZRvrKm — READY.
A publicação não alterou o projeto/endereço oficial loja-de-roupa-dom-malta.

Demonstração com fotos e dados ilustrativos; pagamentos e envio de pedidos desativados. Catálogo da prévia isolado do catálogo real. As imagens antigas e músicas reutilizam os endereços já publicados para reduzir armazenamento; as fotos novas foram incluídas no pacote de prévia. Somente as novas fotos cadastradas de verdade pelo painel vão para o Supabase.

Verificado: acesso anônimo HTTP 200; fotos novas e antigas HTTP 200; API de pagamento retorna habilitado=false; POST de pedido retorna 405; filtros e navegação de seis cabides funcionam; largura de celular sem transbordamento. Nenhuma credencial do dono foi necessária.

O pacote omite README/documentos administrativos e não inclui chaves privadas. SIGAP, Java e VS Code não foram alterados.

Atualização: busca por nome/categoria e filtros combinados por tamanho, cor e disponibilidade publicados. Teste público em celular: camisa marrom + G + Marrom + disponíveis retornou 2 produtos; limpar restaurou a lista. Três testes novos cobrem acentos, combinação na mesma variação e catálogo sem filtros.

## Ajustes de 12/11/2026
- Arara acompanha a altura do conteúdo e mantém apenas a rolagem da página.
- Controles de música ficam ao lado do carrinho em telas até 760px; no computador continuam no canto inferior direito.
- Projeto separado de prévia atualizado, deployment dpl_DWD8mDVjLSVaVkdLDfpZ6Ff4YVHG.
- Quatro testes direcionados de música/navegação passaram; referências das 21 páginas válidas.

## Padronização dos botões — 12/11/2026
- Todos os botões e links de ação públicos usam cápsula dourada (#d6af60), texto escuro e borda dourada, incluindo cabeçalho, categorias, filtros, carrinho, música e diálogos.
- Atalhos de Instagram/WhatsApp e áreas das fotos preservados.
- Skill local dom-malta-identidade atualizada para manter o padrão nas próximas alterações.
- Conferidos Início, Coleção, Sobre nós, Contato e Carrinho; celular de 390px sem transbordamento na Coleção.
- Deployment da prévia: dpl_9esMK6GKBYuVGbxawTYud41sUs3S.

## Carrinho e detalhes da arara — 12/11/2026
- Ações Continuar comprando/Atualizar disponibilidade separadas por 16px no celular.
- Player único de música também no Carrinho, com iniciar/pausar, silenciar e próxima faixa. Em celular fica junto ao carrinho no cabeçalho.
- Setas douradas à esquerda e à direita, abaixo de Fechar, percorrem todas as fotos da categoria dentro do diálogo, sem precisar fechá-lo; ao chegar ao fim retornam à primeira.
- Validada navegação 1 → 2 → 1 e 6 → 7; player com um único áudio, próxima faixa e pausa conferidos. Compilação React e quatro testes direcionados passaram; 21 páginas com referências válidas.
- Deployment: dpl_8zx8UiPDCMe6fuhSyrRgBte9hemZ.

## Foto inteira e setas acessíveis — 12/11/2026
- No desktop as setas ficam ao lado da foto, centralizadas verticalmente.
- No celular mantêm a posição abaixo de Fechar; agora usam SVG com traço preto de 3px.
- O pai informa ao iframe a área visível abaixo do cabeçalho fixo; o diálogo respeita essa área e reserva espaço acima da foto. Corrigido o rosto cortado ao abrir os detalhes em celular.
- Conferidos celular 532x608 e desktop 1280x900, navegação entre peças e foto completa.
- Build da arara, quatro testes direcionados e referências de 21 páginas passaram.
- Deployment da correção: dpl_EffoxPKdiT7QTn5CYfXrQjCXas9Z.

## Música entre páginas — 12/11/2026
- Removida a pausa automática por visibilitychange: deixar a aba em segundo plano não interrompe o player.
- A sessão da aba preserva arquivo da faixa, tempo, fila e silêncio ao navegar entre Início, Coleção, Sobre nós, Contato e Carrinho.
- A próxima página retoma a faixa; pausa manual continua respeitada. Uma nova reprodução em outra aba interrompe a anterior para evitar sobreposição.
- Navegação tradicional pode ter um breve intervalo de carregamento; a retomada automática depende das permissões de áudio do navegador.
- Três testes de áudio passaram, incluindo restauração de tempo/faixa e pausa manual. Navegação com reprodução conferida no navegador.
- Deployment: dpl_BAEL967QtGEeY4CiwSyEAG59qGfe.

## Revisão de 13/11/2026 — entrega
- Melhorias de carregamento, teclado/foco e recuperação do catálogo documentadas em docs/REVISAO-USABILIDADE.md.
- Guia de treinamento: docs/GUIA-RAPIDO-PAINEL.md.
- 55 testes Node passaram; 21 páginas com referências válidas.
- Pacote público: 99 arquivos, 1.498.888 bytes. Sem publicação de documentos privados ou APIs financeiras.
- Deployment: dpl_FbTtFkyJtHwRSxixBPz63i6Fc53d.

## Recuperação de acesso do painel — 13/11/2026
- Link Esqueci minha senha deixa de apontar para #; abre /admin/pages/recuperar-senha.html.
- Página própria solicita e-mail e chama resetPasswordForEmail; não revela se o endereço existe. Não cria contas e não altera senha sem sessão validada pelo Supabase.
- Destino solicitado ao provedor: /admin/pages/redefinir-senha.html no mesmo domínio. Esse endereço precisa estar autorizado em Authentication > URL Configuration do Supabase; a entrega na caixa de entrada e o redirecionamento completo dependem dessa configuração e do provedor de e-mail.
- Dois testes passaram com serviço simulado; navegação do link conferida no navegador. Nenhum e-mail real foi enviado, nenhuma senha foi alterada.

## Diagnóstico do envio — 13/11/2026
- Logs Auth do Supabase confirmaram respostas 429 às 16:33:38 e 16:33:42 UTC, com espera indicada de 56 e 51 segundos. Não é prova de falha permanente do serviço.
- A tela agora diferencia limite de envio e exibe contagem regressiva, impedindo repetição até terminar o prazo.
- Teste simulado do erro 429 e liberação após o prazo aprovado, além dos dois testes existentes.
- Nenhum novo e-mail foi disparado pelo agente; diagnóstico obtido por leitura dos logs. A revisão automática recusou a tentativa de envio com endereço específico, e não foi contornada.
- Deployment da correção: dpl_3HMZQkwW8x8HUXy4FuqKwbU4Zkid.

## Setas acima do varal — 13/11/2026
- Corrigidas também as setas da paginação acima do varal, além das setas dos detalhes corrigidas antes.
- SVG preto de 3,5px, botão circular de 48px e fundo amarelo/dourado #d6af60.
- Conferido em 532x608: troca de 1–6 para 7–12 peças. Dois testes de navegação passaram.
