# Fotos e consumo de hospedagem

Novas fotos do cadastro são redimensionadas no navegador (lado máximo 1280 pixels), convertidas em WebP e limitadas a 350 KB antes de enviar. O arquivo fica no Supabase Storage, bucket público `produtos`, com caminho único e cache longo. A tabela de produtos guarda somente a URL. Não é necessário publicar novamente o site ao cadastrar produtos ou fotos.

Fotos públicas do catálogo podem ser vistas por qualquer visitante; upload e remoção exigem administrador. Credenciais privadas não são usadas no navegador. O bucket aceita somente imagens JPG, PNG e WebP, com limite de 1 MB como proteção adicional no servidor.

Armazenar no Supabase não torna a foto sem peso: o navegador ainda baixa os arquivos e o tráfego conta no serviço que os entrega. Redimensionamento, compressão, carregamento sob demanda e cache reduzem esse volume. Imagens do Storage são entregues diretamente pelo Supabase, não como texto Base64 dentro da resposta do catálogo.

O alerta de 75% foi informado pelo responsável, mas ainda falta o nome do recurso no aviso. As consultas do conector Vercel não disponibilizaram a métrica de consumo. Não é possível concluir, apenas pelo percentual, se é transferência de dados, requisições, builds ou outro limite. O painel de uso exigiu login no navegador de verificação.

Medidas adotadas: cache de um dia para imagens, áudios e vídeos estáticos; cache longo para novas fotos com nomes únicos; carregamento lazy/async das fotos do catálogo; agendamento de expiração sem requisição ociosa à Vercel. Manter atenção às mídias de áudio e vídeo, que podem transferir mais dados que uma foto otimizada.

Referências oficiais:
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://vercel.com/docs/pricing/manage-and-optimize-usage
- https://vercel.com/docs/manage-cdn-usage
