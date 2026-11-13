# Entrega local — DOM MALTA — 11/11/2026

## Versão aprovada
- Início preto e dourado, cabides com filtros por categoria e navegação de seis em seis.
- Categorias com destaque dourado e botões arredondados.
- Menu fixo, atalhos Instagram/WhatsApp e playlist compartilhada sem vídeo no Início.
- Painel integrado, abas visíveis em telas estreitas, edição de estoque em formulário.
- Cadastro e troca de foto no Supabase validados com produto temporário.
- Alteração para duas unidades validada na Coleção; teste restaurado para estoque zero e oculto.
- Revisão em largura de celular concluída; navegação e categorias verificadas.

## Como abrir
Abra DOM-MALTA.code-workspace no VS Code. Não é necessário atualizar o editor nem alterar Java/SIGAP.
Prévia: execute node scripts/preview-local.js e abra http://127.0.0.1:5501/index.html.
Painel: http://127.0.0.1:5501/admin/index.html (login administrativo existente).

## Antes de publicar o visual
As roupas de exemplo de preview/arara/dados-exemplo.js só aparecem em localhost. As sete fotos novas de images/colecao-nova estão fora do Git. Para disponibilizá-las no domínio público, cadastrar produtos definitivos e enviar as fotos pelo painel ao Supabase. Não inventar preços ou quantidades reais. O ZIP inclui as fotos locais para preservação; não deve ser enviado inteiro à Vercel.

## Antes de receber pagamentos reais
- Credenciais Mercado Pago e assinatura do webhook da conta do proprietário.
- Configuração privada Supabase no servidor de produção e conferência das variáveis.
- Catálogo real, preços, custos e estoque aprovados pelo proprietário.
- Frete Correios +5%: faltam embalagem, peso, medidas e acesso à cotação.
- Dados públicos e políticas da loja aprovados.
- Compra, cancelamento, estorno e conciliação de valores no gateway da conta correta.
Manter PAGAMENTOS_REAIS_HABILITADOS=false. Esta etapa não publica nem ativa cobranças.

Detalhes e evidências: docs/CATALOGO-AUTOMATICO.md e ENTREGA-LOJA.md.
