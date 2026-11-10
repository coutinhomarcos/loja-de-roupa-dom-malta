# Validação anterior (histórico)

Registro da publicação ba28600, anterior à instalação autorizada. Para o estado atual, consulte ENTREGA-LOJA.md e docs/FOTOS-E-CONSUMO.md. Em 10/11, migrations 18–21 foram instaladas; testes SQL passaram com rollback; 36 testes Node passaram. Pagamentos reais continuam desativados.

# Validação da entrega — 10/11/2026

Código: `ba286005d2e608aebd3e90e9e30de960c004d7fe`, branch `codex/entrega-loja`.

Produção: https://loja-de-roupa-dom-malta.vercel.app/

Deployment `dpl_HJvw3YPeFAq9wUNPC4x4XfSH6E67`: READY, reconstruído com variáveis de Production. O Preview não foi simplesmente promovido com credenciais de teste.

## Evidências

- 33 testes Node aprovados, sem falhas. Incluem formulário de compra habilitado/desabilitado, acesso privado por hash, retomada de estorno total e parcial, falha na criação de checkout, preservação de estoque pendente e bloqueios de configuração.
- Referências locais de arquivos nas 20 páginas conferidas.
- Sintaxe dos novos módulos JavaScript verificada.
- Revisão independente identificou erros de concorrência, retomada e ligação do formulário; foram corrigidos e cobertos pelos testes.

Verificação anônima no endereço oficial:

| Requisição | Resultado |
|---|---|
| Início | HTTP 200 |
| Carrinho | HTTP 200 |
| Acompanhamento privado | HTTP 200, formulário presente |
| Configurações administrativas | HTTP 200; dados e ações protegidos pela sessão Supabase |
| GET `/api/pagamento` | HTTP 200, `habilitado:false` |
| POST de criação em `/api/pagamento` | HTTP 503, bloqueado por configuração |
| Agendamento sem autorização | HTTP 401 |

## Banco e limites

- Migration 19 aplicada: configurações cadastrais e preferências.
- Verificado que o papel anônimo não pode consultar a tabela privada de configurações; a função pública retorna somente nome, CNPJ, telefone e endereço destinados ao contato público.
- A integração financeira real não está instalada: `pedidos_checkout` não existe no banco em uso. Os totais de registros de vendas e transações reais permanecem em 1 e 1, respectivamente, como antes da etapa.
- Migration 18, testes SQL correspondentes e agendamento 20 estão preparados. A execução da integração real e a gravação do segredo no Vault foram bloqueadas pela revisão automática, que exigiu autorização específica. Não houve contorno desse bloqueio.
- A validação financeira ponta a ponta continua pendente da instalação autorizada e das credenciais do proprietário. Nenhum pagamento real foi feito.

O ramo Git `main` não foi mesclado nesta etapa. A fonte desta entrega está na branch `codex/entrega-loja`; preservar essa branch ao fazer novas alterações para não republicar uma versão antiga.
