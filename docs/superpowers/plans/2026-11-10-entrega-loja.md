# Entrega da loja com pagamentos desativados

Requisito: concluir o projeto e deixar apenas dados/acessos externos pendentes. Frete permanece adiado; retirada pode operar após ativação explícita. Nenhuma cobrança real será feita durante a implementação.

- [x] Reutilizar o motor transacional de checkout validado, separando tabelas, permissões e credenciais de produção.
- [x] Criar pedidos privados por chave de acesso, reserva no estoque real, venda única com cliente/custos e ajustes financeiros idempotentes.
- [x] Criar API pública, webhook assinado, expiração autenticada e ações administrativas de estorno/atendimento; bloquear ativação sem configuração completa.
- [x] Integrar carrinho público, página de acompanhamento e painel administrativo. Preservar pedido por contato quando pagamentos estiverem desativados.
- [x] Testar estoque, financeiro, devoluções, privacidade e configuração ausente com fixtures revertidas por rollback; revisar o código.
- [x] Publicar a entrega, verificar rotas e bloqueios, documentar variáveis e dados externos faltantes.

Decisões: os envios continuam como pedidos por contato, sem frete inventado; produção começa desabilitada. O dinheiro recebido por pedido sem atendimento é mostrado separadamente como valor a devolver; taxas e reversões entram como ajustes únicos, sem segunda receita sobre a venda. Reposição física de devolução exige conferência do lojista. Novos dados do dono e credenciais ficam privados na Vercel.

Validação: 36 testes locais aprovados e referências das 20 páginas conferidas. Migrations 18–21 instaladas após autorização explícita; testes SQL de estoque e financeiro passaram com fixtures revertidas por rollback. Segredo do agendamento salvo no Vault. Nenhuma cobrança real habilitada.
