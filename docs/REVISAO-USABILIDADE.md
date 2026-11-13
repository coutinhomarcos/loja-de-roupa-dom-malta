# Revisão de usabilidade — 13/11/2026

## Melhorias entregues
- Início e Coleção deixam de carregar o SDK Supabase que não utilizavam; o catálogo continua com leitura pública por fetch. Não foi alterado o painel, que depende do SDK.
- Músicas com preload=none: sem baixar áudio antes da escolha do visitante; retomada de sessão permanece disponível.
- Fotos de mostruário com decodificação assíncrona e carregamento sob demanda.
- Atalho Pular para o conteúdo nas páginas públicas; foco visível nos campos e botões; redução de movimentos respeitada.
- Fotos do mostruário abrem com Enter, concentram o foco no diálogo, fecham com Escape e devolvem o foco ao botão original.
- Alvos dos controles de música no celular com mínimo de 44px; padrão preto/dourado preservado.
- Contraste calculado entre fundo dourado #d6af60 e texto #101010: 9,21:1. Não equivale a certificação completa de acessibilidade.
- Consulta do catálogo limitada a 12 segundos por requisição. Falha de rede permite Tentar novamente; ofertas antigas ficam sem ação de compra até recuperar a consulta. Consulta vazia é diferenciada de falha da rede.

## Conferências
- Testes automatizados para limite de espera, recuperação de rede e foco do modal.
- Navegação pelo teclado e restauração de foco conferidas no navegador.
- Coleção em 390px: sem transbordamento horizontal, busca sem resultado com orientação clara.
- Sem medição de Lighthouse/Core Web Vitals em campo; não se afirma uma pontuação de desempenho ou percentual de ganho.

## Treinamento
Guia rápido: docs/GUIA-RAPIDO-PAINEL.md. Manual completo: docs/MANUAL-OPERACAO.md.
Exercícios não exigem confirmar vendas, estornos ou exclusões reais.

## Limites
Dados do proprietário, frete real e conta de pagamentos continuam pendentes. A prévia permanece demonstrativa. A loja oficial, SIGAP e Java/VS Code não foram alterados.
