# Entrega DOM MALTA — 10/11/2026

Publicada em https://loja-de-roupa-dom-malta.vercel.app/ com pagamentos desativados. Fonte: branch `codex/entrega-loja`, commit `ba286005`. Evidências de publicação: `docs/VALIDACAO-ENTREGA-LOJA.md`.

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

Após autorização do responsável, a migration 18 foi instalada e os cenários de estoque, venda e financeiro passaram no banco, com fixtures revertidas por rollback. A validação com pagamentos e estornos no gateway continua pendente da conta do proprietário.

## Pendências para ativar cobranças

| Pendência | O que falta |
|---|---|
| Conta Mercado Pago do proprietário | Access Token de produção, User ID do recebedor e segredo de assinatura do webhook. Configurar diretamente na Vercel, ambiente Production. |
| Chave privada Supabase em Production | `SUPABASE_SECRET_KEY` do mesmo projeto utilizado pelo site. A chave pública do navegador não substitui essa chave. |
| Integração real | Instalada e validada com rollback. `CHECKOUT_BANCO_INSTALADO=true`. Cobranças permanecem desativadas. |
| Expiração automática | Segredo privado salvo no Vault e na Vercel. Agendamento instalado a cada cinco minutos; sem reservas vencidas, não faz requisições à Vercel. `CHECKOUT_EXPIRACAO_CONFIGURADA=true`. |
| Aprovação final | Conferir com o proprietário catálogo, preços, custos, estoque, contatos, endereço de retirada e regras de devolução; testar pagamento/estorno e valores na conta correta. Só depois definir `PAGAMENTOS_REAIS_HABILITADOS=true`. |
| Frete automático | CEP de origem já definido: 32044-420. Faltam peso/dimensões, regra para várias peças e contrato/credenciais Correios ou intermediador autorizado. Regra de acréscimo de 5% implementada em centavos, mas não existe cotação fictícia. Até resolver, entrega permanece como pedido por contato. |
| E-mails automáticos de venda | Configurar provedor e remetente. Recuperação de senha usa o Supabase; conferir seu provedor e URLs de redirecionamento em produção. |
| Dados e políticas do negócio | Preencher contatos públicos, CNPJ quando aplicável e endereço; aprovar textos de entrega, troca, devolução e privacidade com o responsável. |

## Configuração já preparada na Vercel

- `LOJA_URL`, `SUPABASE_URL` e `LOJA_ADMIN_ID` configurados para o projeto existente.
- `MERCADO_PAGO_MODO=producao`.
- `CRON_SECRET` gerado e salvo como variável sensível, sem expor seu valor.
- `CHECKOUT_BANCO_INSTALADO=true`, `CHECKOUT_EXPIRACAO_CONFIGURADA=true` e `PAGAMENTOS_REAIS_HABILITADOS=false`.
- As variáveis de Preview e o fluxo de testes permanecem separados.

O modelo de nomes está em `.env.production.example`. Nunca copiar valores secretos para o Git, documentos ou capturas de tela. O webhook de produção será `https://loja-de-roupa-dom-malta.vercel.app/api/webhook`.

## Evidências e limites

- Testes Node: `node --test tests/*.test.js` — 36 aprovados, incluindo o envio do formulário com serviços simulados e o upload de fotos otimizado.
- Referências locais das 20 páginas: `node scripts/verificar-arquivos.js`.
- O fluxo simulado foi validado com fixtures e rollback no banco. Os novos testes de API usam serviços simulados.
- Migrations 18–21 instaladas após autorização. Os testes financeiros usaram rollback; nenhum pagamento real foi executado.
- Novas fotos são otimizadas para WebP, com lado máximo de 1280 pixels e limite de 350 KB, e enviadas ao bucket público `produtos` do Supabase Storage. Somente administradores podem enviar/remover arquivos. O produto guarda somente a URL; as imagens não são incluídas no GitHub.
- Cabeçalho da página inicial corrigido para acompanhar a rolagem. Cache das mídias estáticas ajustado para reduzir transferências em visitas repetidas.
- Nenhuma cobrança ou devolução real foi executada. A validação ponta a ponta da operação financeira permanece pendente dessas autorizações e da conta correta.
