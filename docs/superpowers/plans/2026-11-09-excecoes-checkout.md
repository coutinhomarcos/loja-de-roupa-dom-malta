# Plano — concluir as exceções do checkout de teste

Objetivo: publicar a expiração e conciliar pagamentos tardios, estornos e contestações sem repetir baixa, venda ou receita, preservando a operação real bloqueada.

Arquitetura: manter JavaScript sem dependências e funções SQL transacionais. A API consulta o Mercado Pago, valida comprador/vendedor/referência/valor e envia o estado verificado a uma RPC restrita a service_role. A RPC bloqueia o pedido e o estoque simulado, registra snapshots de conciliação e reaproveita a confirmação atômica existente. Credenciais reais e frete foram adiados pelo responsável.

- [x] Criar testes direcionados para atendimento tardio com e sem estoque, estorno parcial/total, contestação, notificação repetida e atualização fora de ordem.
- [x] Adicionar migration 15 para conciliação atômica, valores financeiros simulados e histórico de eventos sem duplicidade. Validar com fixtures revertidas por rollback.
- [x] Usar a RPC na consulta e no webhook; preservar a preferência e o pagamento já vinculados. Não confiar no status de retorno do navegador.
- [x] Implementar estorno de teste com chave de idempotência persistida, valores conferidos pelo servidor e consulta após a solicitação. Nunca repor estoque consumido automaticamente.
- [x] Mostrar expiração, atendimento tardio, exceções e valores conciliados no resultado e no histórico.
- [ ] Preservar todos os arquivos da branch remota publicada ao criar o commit de atualização; publicar somente Preview.
- [ ] Verificar deployment Ready, páginas e API, sem executar pagamentos reais. Registrar as pendências reais e o endereço do Preview.

Revisão: concorrência entre expiração e aprovação; duas notificações simultâneas; preferência criada com resposta perdida; reversão recebida antes da aprovação local; arredondamento e valores de estorno acumulados; segredos ausentes dos logs; manutenção das vendas históricas; diferença entre lucro/receita da loja e valores simulados.
