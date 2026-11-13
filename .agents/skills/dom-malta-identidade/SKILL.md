---
name: dom-malta-identidade
description: Preservar o padrão visual da DOM MALTA ao criar ou editar páginas públicas, botões, redes sociais e a assinatura da marca neste repositório.
---

# Identidade visual DOM MALTA

- Todos os botões e links de ação públicos seguem o modelo de “Explorar coleção”: cápsula (`border-radius: 999px`), fundo dourado `#d6af60`, texto escuro `#101010` e borda dourada. Aplicar em todas as páginas públicas, cabeçalho (Início, Coleção, Sobre nós, Contato e Carrinho), categorias, filtros, compra, controles de música e diálogos. Atalhos de Instagram e WhatsApp são exceção: preservar cores e formato atuais, inclusive no cabeçalho e nos contatos. Ícones quadrados permanecem circulares. Estados desativados continuam sem ação, com aparência atenuada; seleção atual deve ser distinguível.
- Reutilize `css/botoes.css` e o token `--raio-botao-dom-malta`. Carregue esse arquivo após os demais estilos, inclusive no documento isolado da arara. Não reintroduza cantos retos em novos botões.
- Não arredonde os elementos estruturais que recebem clique para exibir fotos: `.produto-imagem` e `[data-garment]`. Eles preservam a proporção e o recorte da roupa. Os links do cabeçalho `.menu a` (Início, Coleção, Sobre nós, Contato e Carrinho) também usam cápsulas. Outros links editoriais podem continuar como texto.
- Preserve o fundo preto e os detalhes dourados. A assinatura é “ELEGÂNCIA QUE IMPÕE RESPEITO”, em maiúsculas, serifada, espaçada e dourada, acompanhando DOM MALTA. Nunca substituir por frase em caixa baixa de estilo diferente.
- A logo original contém a frase cortada no próprio JPG. No catálogo, reutilize a composição `.marca-catalogo`: imagem sem a linha incompleta e texto completo em `.marca-catalogo-frase`. Não sobrescreva a imagem original nem deixe a frase cortada em telas pequenas.
- Atalhos Instagram e WhatsApp ficam lado a lado no canto inferior direito, fixos durante a rolagem. Reutilize `js/redes.js` e `css/redes.css`, com os destinos já usados no site; não invente telefone.
- Ao revisar, confira no navegador Explorar coleção, Adicionar ao carrinho, botões sociais e assinatura inteira no computador e no celular. Fotos devem continuar sem recorte por causa do raio de botão.
- A skill não autoriza publicar: respeite o pedido vigente de prévia antes da publicação.
- Arara e Coleção leem a mesma fonte "js/catalogo-dados.js". Categoria, cor e numeração vêm do cadastro; não fixar etiquetas como Camisa para todos os produtos. Novas fotos cadastradas ficam no Supabase Storage. Exemplos locais não substituem estoque real.

