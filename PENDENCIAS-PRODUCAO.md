# Pagamentos e frete — situação em 09/11/2026

Atualização de entrega em 10/11/2026: consulte `ENTREGA-LOJA.md` para o estado final. Checkout público e integração real estão preparados no código; a instalação da migration 18 e do agendamento permanece bloqueada pela revisão automática. Pagamentos continuam desativados.

## Implementado localmente nesta etapa

- Resultado e histórico identificam “Checkout expirado” a partir das reservas verificadas no servidor. Ausência de reserva não é tratada como prova de expiração.
- Consulta atualiza o histórico e oculta o retorno ao checkout vencido.
- Aprovação após expiração tenta atender com estoque simulado disponível, em transação. Sem saldo, preserva o encaminhamento para estorno, inclusive após mediação e nova aprovação.
- Cancelamento, estorno e contestação liberam reservas ainda ativas. Não repõem peças já consumidas automaticamente.
- Falha ao abrir checkout preserva e exibe o protocolo para consulta. Resultado incerto não provoca repetição automática da criação externa.
- Recuperação de preferência criada com resposta perdida confere vendedor, referência, itens, preços e prazo; não cria outra cobrança automaticamente. Resposta atrasada da criação não regride pagamento já conciliado.
- Conciliação transacional registra estorno parcial/total, contestação, taxas e líquido informados pelo gateway, com eventos únicos e bloqueio de atualizações antigas.
- Estorno de teste total ou parcial usa tentativa persistida e a mesma chave de idempotência ao retomar uma falha. Tentativa incerta impede novo estorno concorrente; tentativa confirmada é reconhecida mesmo após perda de resposta no navegador.
- Resultado e painel de vendas simuladas mostram valores conciliados sem incluí-los nas receitas reais.
- Dezoito testes locais direcionados e cenários SQL executados com rollback. Não representam validação de compra real ou estorno executado no gateway.

## Regras informadas pelo responsável

- Frete dos Correios acrescido de 5%, com arredondamento para centavos.
- Cliente pode optar por estorno; contestações devem ser tratadas.
- Endereço público confirmado: https://loja-de-roupa-dom-malta.vercel.app/
- CEP de origem dos envios: 32044-420.
- Aprovação após vencimento: tentar atender com estoque disponível e oferecer estorno ao cliente; se faltar estoque, encaminhar para estorno. Implementado no estoque simulado; pendente no estoque real.
- Cotação de frete adiada a pedido do responsável até obter peso e dimensões das embalagens. O acréscimo de 5% permanece definido para essa integração futura; não calcular nem cobrar frete fictício.

## Dados e acessos pendentes

1. Acesso Vercel autorizado e verificado na equipe `coutinho-servicos`, projeto `loja-de-roupa-dom-malta`. Há proteção SSO `all_except_custom_domains`; conferir o acesso público ao preparar checkout e webhook de produção.
2. URL pública já informada acima; verificar domínio, HTTPS e acesso ao webhook após liberar a Vercel.
3. Credenciais de produção Mercado Pago e segredo de assinatura do webhook da conta do proprietário, adiados pelo responsável. Inspeção na Vercel confirmou oito variáveis somente em Preview e nenhuma variável em Production; valores secretos não foram expostos.
4. Peso e dimensões das embalagens e regra de embalagem para múltiplas peças. CEP de origem já informado. Esta parte foi explicitamente adiada.
5. Contrato/cartão de postagem e acesso CWS dos Correios com APIs Preço e Prazo habilitadas, ou definição de uma integração intermediária autorizada caso não haja contrato.
6. Reposição de peças já consumidas depende de conferência física; nenhum estorno ou contestação repõe peças automaticamente.
7. Webhook do novo Preview configurado após autorização explícita para criar chave persistente. Variável sensível restrita à branch `codex/concluir-checkout-teste`, ambiente Preview. Republicação READY; acesso direto verificado com GET 405 e POST sem assinatura 401. Proteção do projeto preservada. Falta validar as exceções no gateway com notificações assinadas reais do sandbox.

## Trabalho ainda necessário antes de vender

- Implementar cotação autenticada no servidor, validar CEP/embalagem e persistir frete, serviço, prazo e total. A criação atual cobra apenas as peças.
- Instalar e validar o checkout público preparado no código, com chave privada de acompanhamento e gestão administrativa separada.
- Autorizar a migration 18 preparada para reserva, baixa, cliente, venda e ajustes financeiros sem duplicidade; validar no banco com rollback antes da ativação.
- Conferir no gateway da conta correta os estornos parciais/totais, taxas e valores líquidos. O painel já considera vendas como receita; os ajustes preparados não geram uma segunda receita para a mesma venda.
- Em falhas sem preferência encontrada ou com mais de uma preferência, manter conciliação operacional. A busca do Mercado Pago cobre os últimos 90 dias; não criar cobrança substituta automaticamente.
- Configurar domínio HTTPS, webhook público com assinatura e credenciais de produção.
- Validar apenas as etapas novas e depois uma compra completa com confirmação, cancelamento/estorno e conferência de peças, frete, taxas e valores líquidos.

No Supabase `dom-malta`, foram aplicadas as migrations de teste 15–17, restritas às tabelas simuladas. Os cenários SQL usam fixtures e rollback. Nenhum pagamento real, estorno no gateway ou alteração de estoque/financeiro real foi executado. O bloqueio de pagamentos reais permanece ativo.

A versão publicada de testes aponta para `a8131969dba302c2723050526cd480f55891a1a1`, diferente do HEAD local inicial `6464d76`. O código local de pagamento foi integrado com a confirmação atômica e a configuração de webhook dessa versão publicada. Os demais arquivos divergentes precisam ser preservados ao preparar a publicação; não substituir a branch remota pela árvore local antiga.

A atualização foi publicada em Preview separado na branch `codex/concluir-checkout-teste`, commit `7609504`, preservando a base remota. Deployment READY e verificações HTTP aprovadas. Detalhes e pendência de configuração do novo webhook: `docs/VALIDACAO-CHECKOUT-TESTE.md`.

Referência oficial para a cotação: https://www.correios.com.br/atendimento/developers/manuais/manual-api-preco-1
