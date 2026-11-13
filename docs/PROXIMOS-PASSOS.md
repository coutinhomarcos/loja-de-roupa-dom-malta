# Próximos passos — DOM MALTA — 13/11/2026

## Concluído sem os dados do proprietário
- Prévia para aprovação: https://dom-malta-previa-cliente.vercel.app/
- Visual, catálogo com busca e filtros, cabides com detalhes e navegação, carrinho e música ajustados.
- Painel com cadastro, fotos no Supabase, estoque, vendas e financeiro integrado; validações anteriores registradas em docs/REVISAO-FINAL.md.
- Código salvo no GitHub na branch codex/previa-dom-malta-2026-11-12. A main e a loja oficial permanecem preservadas.
- Montagem da prévia reproduzível: node scripts/preparar-previa-cliente.js. Manifesto contém somente runtime e fotos novas; reutiliza as imagens antigas e músicas publicadas. Não enviar o ZIP inteiro à Vercel.
- Pacote conferido em 13/11: 99 arquivos, 1.495.670 bytes. Teste isolado impede inclusão de documentos, arquivos .env, SQL e sobras antigas.

## Sequência para concluir
1. Proprietário aprova o visual pelo link da prévia.
2. Receber dados comerciais e catálogo na lista abaixo; cadastrar os produtos reais pelo painel, com fotos no Supabase. Substituir demonstrações sem inventar preços ou disponibilidade.
3. Conferir contatos, endereço de retirada e políticas aprovadas pelo responsável.
4. Configurar privadamente a conta Mercado Pago do proprietário e as variáveis de produção; validar acesso público ao webhook e assinatura.
5. Integrar frete quando houver peso/embalagem e acesso à cotação. CEP de origem: 32044-420; acréscimo definido: 5%. Não cobrar frete fictício.
6. Validar compra, confirmação, cancelamento/estorno e conciliação dos valores na conta correta. Somente então liberar pagamentos reais.

## Dados para pedir ao proprietário
### Loja
- Nome comercial e nome/razão social do responsável; CNPJ, se houver.
- WhatsApp de atendimento, e-mail de atendimento e confirmação do Instagram.
- Endereço completo e horários de retirada/atendimento.
- Aprovação dos textos de entrega, troca/devolução e privacidade (rascunhos em docs/POLITICAS-RASCUNHO.md).
### Cada produto
- Nome, categoria (camisa/calça/bermuda), descrição e fotos autorizadas.
- Cor, tamanho/numeração e quantidade real de cada combinação.
- Preço de venda e custo de aquisição para o painel financeiro.
### Pagamento — configurar diretamente na conta/Vercel
- Conta Mercado Pago do proprietário que receberá as vendas.
- Access Token de produção, identificação do recebedor e segredo de assinatura do webhook.
- Chave privada Supabase do servidor, se ainda não configurada em Production.
- Não enviar tokens, senhas ou chaves por chat, Git ou documentos.
### Envio (adiado pelo usuário)
- Peso e altura/largura/comprimento do pacote; regra para pedidos com várias peças.
- Contrato/acesso Correios ou intermediador que o proprietário autorize.

## Limites atuais
O link da prévia é demonstrativo, não aceita pedidos nem pagamentos reais. Aprovação visual não significa liberação financeira. Migração 18 e agendamento constam como instalados e validados anteriormente com rollback; não repetir instalação. As validações reais no gateway ainda dependem da conta correta. Não alterar SIGAP, Java 21 ou atualizar VS Code.
