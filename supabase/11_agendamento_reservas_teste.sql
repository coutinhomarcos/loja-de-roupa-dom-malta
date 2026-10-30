-- Executa a verificação das reservas de teste a cada 5 minutos.
select cron.schedule(
    'dom_malta_expirar_reservas_teste',
    '*/5 * * * *',
    $$select public.solicitar_expiracao_testes();$$
);