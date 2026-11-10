-- Instalar somente após aprovar e validar a migration 18.
-- O segredo no Vault deve ser igual ao CRON_SECRET privado da Vercel Production.
begin;
do $$ begin
    if not exists(select 1 from vault.decrypted_secrets where name='loja_checkout_cron_secret') then
        raise exception 'Configure loja_checkout_cron_secret no Vault antes de agendar.';
    end if;
end $$;
create or replace function public.disparar_expiracao_checkout_loja()
returns void language plpgsql security definer set search_path='' as $$
declare v_segredo text;
begin
    select decrypted_secret into strict v_segredo from vault.decrypted_secrets where name='loja_checkout_cron_secret';
    perform net.http_post(
        url:='https://loja-de-roupa-dom-malta.vercel.app/api/expirar-checkouts',
        headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_segredo),
        body:='{}'::jsonb,timeout_milliseconds:=10000
    );
end;
$$;
revoke all on function public.disparar_expiracao_checkout_loja() from public,anon,authenticated;
select cron.schedule('checkout-loja-expiracao','*/5 * * * *','select public.disparar_expiracao_checkout_loja()');
commit;
