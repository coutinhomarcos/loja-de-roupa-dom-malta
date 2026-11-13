# Verificação de estoque — 13/11/2026

## Resultado
63 testes automatizados passaram; 9 cenários transacionais no Supabase passaram. Nenhuma venda, despesa ou produto de teste permaneceu no banco após o ROLLBACK. Baseline antes/depois: 2 produtos, 11 variações, 1 venda, 1 transação de R$ 50,00; estoque físico total 1 e reservado 0.

## Verificado
- Cadastro atômico com duas variações; despesa inicial de 5 peças × R$ 20 = R$ 100.
- Código duplicado recusado e cadastro parcialmente inválido desfeito.
- Entrada por edição de 3 para 5 unidades.
- Redução abaixo de reservas e quantidade negativa bloqueadas.
- Venda acima da disponibilidade e produto oculto bloqueados.
- Venda usa preço do banco (ignora preço enviado pelo cliente).
- Reenvio da mesma venda não duplica venda nem baixa.
- Acesso anônimo a clientes negado; produtos e variações ocultos invisíveis; funções de cadastro/edição/venda sem permissão anônima. Usuário autenticado sem administração também bloqueado.
- RLS habilitada nas 21 tabelas públicas.
- Storage produtos permite formatos JPG/PNG/WebP, limite de 1 MB; envio restrito a administradores. Testes unitários confirmam otimização WebP, até 1280 px e 350 KB.
- No Chrome autenticado: abriu Novo Produto, gerou P/M/G/GG/XG × Preto/Azul e aplicou 2 unidades a todas: 10 combinações, 20 peças. Cadastro não submetido.

## Corrigido
- Produtos e Estoque ignoravam o limite configurável e usavam sempre 5. Agora leem Configurações.
- Contador de estoque baixo em Produtos incluía esgotados, divergindo de Estoque. Agora baixo conta disponíveis positivos até o limite, e Estoque mantém esgotados separados.
- Adicionados testes de regressão para grade e limite configurável.

## Limites e pendências — não considerar validação total de operação real
- Não foi realizado novo upload de arquivo real nesta rodada; a otimização/envio está coberta por testes com serviço simulado e inspeção das políticas, não por envio físico novo.
- A prévia pública substitui a consulta real pelo catálogo de demonstração. Testar publicação ponta a ponta de um novo produto exige uma versão de homologação que consulte o catálogo real; não habilitar pagamentos para isso.
- Edição de quantidade ajusta saldo, mas não gera despesa adicional nem histórico específico de movimentações. Não usar essa edição como registro financeiro automático de uma reposição comprada. Cadastro inicial gera despesa corretamente.
- Concorrência simultânea entre dois operadores não foi exercitada nesta rodada. A função de venda usa bloqueio de linhas; a edição de saldo físico absoluto ainda merece teste específico para evitar sobrescrever alterações concorrentes.
- Teste HTTP anônimo pelo script local não concluiu por resposta de rede HTML. As permissões foram verificadas diretamente no PostgreSQL usando os papéis anon/authenticated.
- Interação no Chrome interrompida quando foi detectado uso do usuário; nenhum cadastro foi submetido.
- Pagamentos reais permanecem fora do escopo e desativados.

## Reprodução
- node --test tests/*.test.js
- scripts/testar-estoque-transacao.sql: executar inteiro em sessão única; termina em ROLLBACK. Usa somente fixture TESTE-AUDITORIA-1311. Não executar trechos isolados nem trocar ROLLBACK por COMMIT.
