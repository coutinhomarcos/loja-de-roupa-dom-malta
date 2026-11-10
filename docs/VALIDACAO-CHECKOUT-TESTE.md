# Validação do checkout de teste

Atualização de 09/11/2026, horário de São Paulo.

- Branch: `codex/concluir-checkout-teste`.
- Implementação: commit `7609504f22539d7a438275c36b914916377eb63e`, baseado na versão publicada `a8131969dba302c2723050526cd480f55891a1a1`.
- Preview: https://loja-de-roupa-dom-malta-h8q6xcxcv-coutinho-servicos.vercel.app/pages/resultado-teste.html
- Deployment inicial `dpl_5bqFUhBFs2gWsmC4qzKMxSGHr5RY`: READY.
- Republicação após configurar o webhook: `dpl_EeV3tUaT4LPvnkgE9xbtSkCM18kb`, READY.
- Endereço estável: https://loja-de-roupa-dom-malta-git-codex-conc-ae8a4f-coutinho-servicos.vercel.app/pages/resultado-teste.html
- Proteção da Vercel preservada; o acesso pelo navegador pode exigir login na Vercel.

## Verificações executadas

`node --test tests/*.test.js`: 18 testes aprovados, sem falhas.

`tests/conciliacao-banco.sql`: executado no Supabase com fixtures simuladas e rollback. Verificou atendimento tardio com estoque, falta de estoque, repetição sem dupla baixa/venda/evento, estorno parcial, estorno total, contestação, eventos antigos, manutenção da decisão de estorno após mediação, tentativa de estorno repetida, bloqueio de estornos concorrentes e permissões da RPC.

Revisão independente apontou três condições de corrida e uma falha de recuperação no navegador. Todas foram corrigidas e verificadas com testes direcionados.

Verificações autenticadas do deployment:

| Rota | Resultado |
| --- | --- |
| `/api/pagamento-teste` | HTTP 200, habilitado e modo teste |
| `/pages/resultado-teste.html` | HTTP 200, formulário de estorno presente |
| `/js/resultado-teste.js` | HTTP 200, mensagens de expiração e valores conciliados presentes |
| `/admin/js/vendas-teste.js` | HTTP 200, snapshots financeiros presentes |
| `/api/webhook-teste` com GET | HTTP 405, método não permitido |

## Limites e pendências

As migrations 15–17 foram aplicadas somente ao fluxo simulado. Não houve pagamento real, estorno no gateway, alteração de estoque real ou promoção para Production.

A variável sensível `MERCADO_PAGO_WEBHOOK_URL` foi configurada especificamente para a branch `codex/concluir-checkout-teste`, no ambiente Preview, apontando para o endpoint do endereço estável. Novos checkouts desta branch enviam essa URL em `notification_url`. A variável geral das demais branches e a produção foram preservadas; preferências já criadas mantêm a URL anterior.

A criação da chave persistente foi inicialmente bloqueada pela revisão automática. Após autorização explícita do responsável, a chave foi criada e armazenada na Vercel, sem publicar seu valor. A proteção do projeto continua ativa.

Verificação HTTP direta com a chave autorizada: GET retornou 405 e POST de notificação sem assinatura retornou 401. Isso confirmou acesso pela proteção da Vercel e rejeição pela validação da aplicação. O script privado temporário da verificação foi removido automaticamente; nenhuma credencial foi adicionada ao repositório.

Ainda validar as exceções novas no sandbox com a sessão administrativa: estorno parcial/total no gateway, aprovação tardia com e sem estoque e atualização por notificação assinada. As verificações de código e banco já passaram. Os testes de compra que já passaram não precisam ser repetidos por rotina.

Credenciais reais da conta do proprietário, frete dos Correios + 5% e integração com estoque/financeiro reais permanecem pendentes conforme `PENDENCIAS-PRODUCAO.md`.
