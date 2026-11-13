# Revisão final local — 11/11/2026

## Correções desta revisão
- Dashboard e Financeiro compartilham cálculos em centavos; data comercial de São Paulo. Dashboard identifica margem das vendas, separada de saldo de caixa.
- Gráfico ilustrativo substituído por tabela dos últimos sete dias; títulos e links de Dashboard corrigidos.
- Formulários de Clientes e confirmações de Vendas, Financeiro e Pedidos usam dialog acessível, sem prompt/confirm incompatível com a prévia.
- Produtos informa a quantidade efetiva de variações filtradas, sem paginação decorativa.
- Grade fixa do PDV corrigida para celular. Telas de Dashboard, Produtos, Clientes, Vendas, Financeiro, Pedidos e Configurações conferidas em 390px sem transbordamento da página; tabelas podem rolar dentro de seus contêineres.
- Lançamento financeiro manual preserva identificador para repetição após falha; servidor permanece responsável pelas permissões.

## Evidências
- 47 testes Node passaram na revisão (3 novos para cálculos). Após as correções finais, repetir o comando listado abaixo.
- 21 páginas com referências locais verificadas.
- CSV de estoque exportado pelo navegador e arquivo conferido.
- PDV recusou quantidade maior que a disponível; carrinho calculou preço e abriu confirmação; operação cancelada, sem registrar venda.
- Inspeção Supabase: RLS ativo nas 21 tabelas públicas; políticas de gestão exigem administrador. View de estoque checkout não concede SELECT a anon/authenticated. Upload de fotos exige administrador.
- Teste via API anônima: administradores, clientes, transações, vendas, custos e pedidos não retornaram registros privados; produtos ocultos não foram expostos.
- Produto temporário TESTE-FLUXO-1111 foi preservado oculto, estoque total zero e nenhuma reserva.

## Limites e pendências
Não foram executadas exclusões reais, lançamentos financeiros novos, vendas ou estornos para testar telas. Operações financeiras do gateway continuam pendentes da conta correta e do servidor configurado. A prévia local bloqueia endpoints de pagamento e webhook.
Não é auditoria de segurança exaustiva. Testes anônimos e inspeção de políticas não equivalem a teste com uma segunda conta autenticada sem privilégios.
Não publicar rascunhos de políticas nem inserir informações comerciais inventadas. Dados do dono, catálogo real e frete continuam pendentes.
Nenhuma atualização de VS Code/Java/SIGAP e nenhuma publicação nesta rodada.

## Comandos de conferência
- node --test tests/*.test.js
- node scripts/verificar-arquivos.js
- node scripts/verificar-acesso-publico.js (somente consultas públicas, precisa de internet)

## Arquivos de entrega
- DOM-MALTA.code-workspace: abre a pasta no VS Code.
- docs/MANUAL-OPERACAO.md: operação diária e limites financeiros.
- docs/POLITICAS-RASCUNHO.md: textos para o responsável revisar.
- ENTREGA-ATUAL.md: pendências comerciais.
- DOM-MALTA-atualizado.zip: cópia local; não enviar esse ZIP inteiro à Vercel.
