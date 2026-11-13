# Cadastro, fotos e vitrine

Arara e Coleção consultam `js/catalogo-dados.js`, usando a chave pública e as políticas existentes do Supabase. Todas as páginas consultam produtos ativos e suas variações. A consulta é paginada, sem limitar a arara às quatro peças em destaque. Seis cabides aparecem por vez, com setas para percorrer as fotos.

## Cadastro definitivo

Em **Cadastro de produto**, informar nome, categoria, custo/preço, cores, tamanhos e quantidades. Selecionar a foto, gerar a grade e salvar. A foto é convertida para WebP, limitada a 1280 px e 350 KB, enviada ao bucket `produtos` do Supabase Storage. A tabela guarda somente a URL. O arquivo não entra nos deployments da Vercel.

Em **Produtos** e **Estoque**, o botão **📷 Foto** permite anexar ou substituir a foto de um produto existente. A alteração só é confirmada após o retorno do banco. As permissões continuam restritas a administradores, tanto no Storage quanto na tabela de produtos. Produtos sem foto continuam na Coleção; ficam fora da arara.

A categoria determina a aba e a etiqueta; as cores e numerações são as variações cadastradas. Camisas/Camisetas, Calças e Bermudas são encaminhadas às suas seções; demais categorias ficam em Outros. Produto inativo não é exibido. Variação sem saldo é indicada como esgotada.

Ao salvar no painel, as abas do mesmo endereço recebem um aviso local de atualização. Ao voltar a uma aba, a arara consulta o catálogo novamente. Nenhuma nova publicação é necessária para cadastrar produtos ou fotos.

## Dados de teste locais

`preview/arara/dados-exemplo.js` funciona somente em `localhost` e `127.0.0.1`. Reúne as referências do mostruário e as sete fotos novas; usa P, M, G, GG e XG, duas unidades por tamanho e preço ilustrativo de R$ 99,90. A compra dos exemplos fica desabilitada. Esses dados não são gravados no Supabase nem afetam vendas/financeiro. Não usar as referências locais como catálogo definitivo.

As sete fotos recebidas por ZIP ainda são referências locais da prévia; para o catálogo definitivo, cadastrá-las no painel com os dados reais ou autorizados do produto. O upload de catálogo usa exclusivamente o Supabase Storage.

## Música e navegação

Links do cabeçalho usam cápsulas. Os controles permitem Iniciar/Pausar, Silenciar/Ativar som e Próxima música. A reprodução começa por ação do visitante em todas as páginas. BroadcastChannel, com apoio do evento de armazenamento, pausa a música anterior ao iniciar em outra aba da mesma origem; abas ocultas também pausam.

A arara filtra Todas, Camisas, Calças e Bermudas pela categoria do catálogo. As setas trocam páginas de seis fotos, sem repetir itens para completar o último bloco. Trocar de categoria volta ao primeiro bloco. A animação automática de seleção foi desligada; o visitante explora com as setas e os cabides.

## Conferência antes de publicar

Validar um cadastro administrativo completo com foto, categoria e grade; conferir sua aparição na Coleção e na arara e testar a troca de foto. Sem credenciais/sessão administrativa, os testes automatizados simulam o upload e não equivalem a uma gravação administrativa ponta a ponta. Verificar os dados reais de catálogo e manter pagamentos desligados enquanto persistirem as pendências de produção.

## Validação administrativa realizada em 11/11/2026

Cadastro pelo formulário autenticado: TESTE-FLUXO-1111, categoria Camisas, cor Marrom, tamanhos P/M/G/GG/XG, custo zero, preço ilustrativo R$ 99,90 e estoque zero. Foto otimizada em WebP enviada ao Supabase Storage e carregada na Coleção. Substituição por segunda foto confirmada por novo endereço Storage. Cabide exibiu categoria, cor e as cinco variações esgotadas. Ao final, produto ocultado pelo Estoque: cinco ações Exibir confirmadas no painel, nenhuma ocorrência na Coleção ou nos cabides após recarregar. Registro preservado para auditoria; nenhum estoque real ou venda alterado. Edição de quantidade com estoque positivo e conferência financeira ainda não validadas nesta rodada.

Validação adicional de estoque em 11/11/2026: formulário administrativo salvou 2 unidades em G/Marrom; Coleção confirmou "2 disponíveis" e botão Adicionar ao carrinho. Encontrada incompatibilidade dos prompts/confirm nativos com a prévia: substituídos por dialog com formulário e confirmação acessíveis. Exibição temporária e limpeza controladas pelo conector Supabase após travamento da confirmação antiga. Estado final confirmado no banco: ativo=false, estoque total=0, reservado=0; Coleção e cabides sem ocorrência do teste. Formulário final mostrou zero; nova confirmação abriu e foi cancelada com sucesso. Não foi efetuada compra nem validação de pagamento.
