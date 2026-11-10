# Entrega DOM MALTA — 10/11/2026

## Disponível para uso sem pagamentos online

- Catálogo, carrinho e envio de pedidos para a loja combinar pagamento/entrega.
- Painel com produtos, grade, estoque, clientes, vendas, financeiro e relatórios.
- Dados da loja e preferências de estoque agora persistem no Supabase. Contato público mostra somente os dados preenchidos; não foram inventados CNPJ, telefone ou endereço do proprietário.
- Recuperação e alteração de senha pelo Supabase. O formulário de configuração não informa sucesso antes de salvar.
- Fluxo de testes Mercado Pago com expiração, conciliação, recuperação de checkout e estorno idempotente.

## Código preparado para pagamentos reais

- Checkout público para retirada, sem exigir login administrativo do cliente.
- Acompanhamento privado por protocolo e chave; somente o hash da chave fica no banco.
- Solicitação de cancelamento/estorno pelo cliente, com conferência da loja.
- Reserva no estoque da loja, baixa e venda únicas, cliente e custo de cada peça na mesma transação.
- Taxas, estornos parciais/totais e contestações como ajustes únicos no financeiro; a venda não gera uma segunda receita duplicada.
- Painel de pedidos online com consulta ao Mercado Pago, retomada de estorno, separação, pronto para retirada e entrega.
- Webhook assinado, limite de requisições e expiração com rotação para não bloquear pedidos atrás de pagamentos pendentes.
- Desligar novas vendas preserva a gestão de pagamentos já existentes, desde que as credenciais e o banco continuem configurados.

Essa integração está preparada no código, mas não instalada nem validada nas tabelas reais: a revisão automática bloqueou a migration 18. Não é possível garantir a operação financeira completa antes dessa instalação e da validação com a conta do proprietário.

## Pendências para ativar cobranças

| Pendência | O que falta |
|---|---|
| Conta Mercado Pago do proprietário | Access Token de produção, User ID do recebedor e segredo de assinatura do webhook. Configurar diretamente na Vercel, ambiente Production. |
| Chave privada Supabase em Production | `SUPABASE_SECRET_KEY` do mesmo projeto utilizado pelo site. A chave pública do navegador não substitui essa chave. |
| Instalação da integração real | Autorizar a migration `supabase/18_integracao_checkout_loja.sql`, validar `tests/checkout-loja-banco.sql` com rollback e só então definir `CHECKOUT_BANCO_INSTALADO=true`. |
| Expiração automática | Autorizar guardar no Vault o segredo privado correspondente ao `CRON_SECRET` da Vercel e instalar `supabase/20_agendamento_checkout_loja.sql`. Depois definir `CHECKOUT_EXPIRACAO_CONFIGURADA=true`. O segredo foi gerado e salvo na Vercel; não há agendamento novo ativo. |
| Aprovação final | Conferir com o proprietário catálogo, preços, custos, estoque, contatos, endereço de retirada e regras de devolução; testar pagamento/estorno e valores na conta correta. Só depois definir `PAGAMENTOS_REAIS_HABILITADOS=true`. |
| Frete automático | CEP de origem já definido: 32044-420. Faltam peso/dimensões, regra para várias peças e contrato/credenciais Correios ou intermediador autorizado. Regra de acréscimo de 5% implementada em centavos, mas não existe cotação fictícia. Até resolver, entrega permanece como pedido por contato. |
| E-mails automáticos de venda | Configurar provedor e remetente. Recuperação de senha usa o Supabase; conferir seu provedor e URLs de redirecionamento em produção. |
| Dados e políticas do negócio | Preencher contatos públicos, CNPJ quando aplicável e endereço; aprovar textos de entrega, troca, devolução e privacidade com o responsável. |

## Configuração já preparada na Vercel

- `LOJA_URL`, `SUPABASE_URL` e `LOJA_ADMIN_ID` configurados para o projeto existente.
- `MERCADO_PAGO_MODO=producao`.
- `CRON_SECRET` gerado e salvo como variável sensível, sem expor seu valor.
- `CHECKOUT_BANCO_INSTALADO=false`, `CHECKOUT_EXPIRACAO_CONFIGURADA=false` e `PAGAMENTOS_REAIS_HABILITADOS=false`.
- As variáveis de Preview e o fluxo de testes permanecem separados.

O modelo de nomes está em `.env.production.example`. Nunca copiar valores secretos para o Git, documentos ou capturas de tela. O webhook de produção será `https://loja-de-roupa-dom-malta.vercel.app/api/webhook`.

## Evidências e limites

- Testes Node: `node --test tests/*.test.js` — 33 aprovados, incluindo o envio real do formulário com serviços simulados.
- Referências locais das 20 páginas: `node scripts/verificar-arquivos.js`.
- O fluxo simulado foi validado com fixtures e rollback no banco. Os novos testes de API usam serviços simulados.
- A migration 19 de configurações cadastrais foi aplicada; dados financeiros e estoque real não foram alterados.
- A migration 18 e a gravação do segredo no Vault foram recusadas pela revisão automática por exigirem autorização específica. Não foram contornadas, e os marcadores de ativação permanecem desligados.
- Nenhuma cobrança ou devolução real foi executada. A validação ponta a ponta da operação financeira permanece pendente dessas autorizações e da conta correta.
