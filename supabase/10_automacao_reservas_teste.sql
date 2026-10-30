begin;

create extension if not exists pg_net;

create or replace function public.solicitar_expiracao_testes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_chave text;
    v_bypass text;
    v_pedido record;
    v_enviadas integer := 0;
begin
    select decrypted_secret
    into strict v_chave
    from vault.decrypted_secrets
    where name = 'cron_teste_secret';

    select decrypted_secret
    into strict v_bypass
    from vault.decrypted_secrets
    where name = 'vercel_bypass_teste';

    if v_chave is null
       or v_chave !~ '^[a-f0-9]{64}$'
       or v_bypass is null
       or length(v_bypass) = 0 then
        raise exception 'Segredos da automação não configurados.';
    end if;

    for v_pedido in
        select p.id
        from public.pedidos_mp_teste p
        join public.reservas_checkout_teste r
            on r.pedido_id = p.id
        where p.status = 'aguardando_pagamento'
          and p.pagamento_id is null
          and p.preferencia_id is not null
          and r.estado = 'reservada'
        group by p.id
        having max(r.expira_em) <= now() - interval '1 minute'
        order by random()
        limit 10
    loop
        perform net.http_post(
            url := 'https://loja-de-roupa-dom-malta-6zpcueg95-coutinho-servicos.vercel.app/api/pagamento-teste',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_chave,
                'x-vercel-protection-bypass', v_bypass
            ),
            body := jsonb_build_object(
                'acao', 'expirar_automaticamente',
                'id', v_pedido.id
            ),
            timeout_milliseconds := 60000
        );

        v_enviadas := v_enviadas + 1;
    end loop;

    return v_enviadas;
end;
$$;

revoke all on function public.solicitar_expiracao_testes()
from public, anon, authenticated, service_role;

commit;