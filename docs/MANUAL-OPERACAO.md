# Manual de operação — DOM MALTA

## Abrir o projeto
Abra `DOM-MALTA.code-workspace` no VS Code. Não precisa atualizar o editor nem alterar a configuração Java 21 do SIGAP.
Para abrir a prévia: no terminal da pasta, execute `node scripts/preview-local.js` e visite `http://127.0.0.1:5501/index.html`.
Painel: `http://127.0.0.1:5501/admin/index.html`. Use sua conta administrativa existente. Não compartilhe a senha.

## Produtos e fotos
1. Entre em Produtos > Novo Produto.
2. Preencha código único, nome, categoria, tamanhos separados por vírgula e cores.
3. Informe custo e preço reais. Gere a grade e confira a quantidade de cada tamanho/cor.
4. Selecione a foto correspondente. O navegador otimiza em WebP e envia ao Supabase Storage; a base guarda a URL.
5. Salve e confira o produto em Produtos, Estoque, Coleção e cabides.
Use a categoria correta: Camisas/Camisetas, Calças ou Bermudas. Sem foto, a peça não aparece no cabide. Estoque zero aparece esgotado. Imagens enviadas ao Supabase não entram nas publicações da Vercel.
Trocar a foto: botão de câmera em Produtos ou Foto em Estoque. A mesma imagem é usada na Coleção e na arara.

## Estoque
O lápis abre o formulário de edição. Nome, categoria, custo e preço pertencem ao produto; tamanho, cor e quantidade pertencem à variação escolhida. Confira os campos antes de salvar.
Quantidade física não pode ser menor que a reservada. Disponível = físico menos reservado.
Ocultar retira todo o produto e suas variações do site sem excluir o histórico. Exibir o publica novamente no catálogo.
O produto temporário TESTE-FLUXO-1111 permanece oculto, com estoque zero. Não usar como mercadoria real.

## Clientes
Novo Cliente abre formulário de nome, telefone e e-mail. Confira a autorização para guardar esses dados e cadastre apenas o necessário ao atendimento. Alterações e exclusões exigem acesso administrativo.

## Vendas de balcão
O PDV registra pagamentos já recebidos fora do sistema. Escolha produto, quantidade e pagamento; confira total e cliente. Finalizar pede confirmação antes de baixar estoque e registrar a venda.
Não confirme para simular pagamento: confirmação grava de verdade. Para testar a montagem do carrinho, cancele a confirmação e remova os itens. O sistema recusa quantidade superior ao saldo disponível.

## Pedidos do site
Solicitações por contato não são pagamentos recebidos, reservas ou vendas concluídas. Confira cliente, itens e entrega antes do atendimento.
Pedidos online dependem da configuração do servidor e do Mercado Pago. A prévia estática não executa esses endpoints e informa operação indisponível. Não considerar isso uma confirmação de pagamento.

## Financeiro
Faturamento soma vendas. Receitas somam vendas mais entradas manuais. Despesas incluem compras de estoque, saídas manuais e ajustes do checkout. Saldo = receitas menos despesas.
Margem das vendas / Lucro Realizado = vendas menos custo das peças vendidas e ajustes de checkout. Não é lucro líquido contábil: custos operacionais gerais estão nas despesas e no saldo.
Lucro previsto usa apenas estoque disponível de produtos ativos. Vendas simuladas do gateway ficam em uma seção separada e não entram nos totais reais.
Não cadastre uma receita manual para uma venda que o sistema já registrou. Não exclua lançamentos automáticos para corrigir o saldo; investigue a origem.

## Relatórios
Escolha período/status/categoria e clique em Gerar Relatório. A exportação é CSV em UTF-8, com ponto e vírgula; pode abrir no Excel. Confira o período em horário de São Paulo. Relatórios contêm dados privados: guarde com cuidado.

## Configurações
Preencha os dados comerciais apenas quando confirmados pelo dono. Preferências controlam alertas de estoque. E-mails automáticos dependem de provedor/remetente; não estão ativos. Exclusão geral permanece desativada.

## Publicação e pagamentos
A prévia para aprovação está em https://dom-malta-previa-cliente.vercel.app/ e usa um pacote demonstrativo isolado. No código normal da loja, os exemplos de `preview/arara/dados-exemplo.js` só aparecem em localhost. Antes de publicar com as roupas novas, cadastrar os produtos definitivos no painel.
Credenciais privadas são configuradas na Vercel, nunca no Git, ZIP, formulário público ou chat. Manter `PAGAMENTOS_REAIS_HABILITADOS=false` até conferir conta do proprietário, webhook, frete, catálogo e validação real de pagamento/estorno.

## Busca e filtros da Coleção
Na página Coleção, use Buscar peça (nome ou categoria), Tamanho, Cor e Disponibilidade. Os filtros combinados exigem que tamanho/cor/disponibilidade existam na mesma variação. A busca ignora acentos e diferenças entre maiúsculas e minúsculas. Limpar filtros restaura todos os produtos. O mostruário fotográfico separado fica oculto enquanto há filtros, para não confundir fotos de apresentação com resultados de estoque. Na prévia pública, os valores continuam demonstrativos e compras desativadas.

Guia resumido para treinamento: docs/GUIA-RAPIDO-PAINEL.md. Revisão de usabilidade: docs/REVISAO-USABILIDADE.md.

