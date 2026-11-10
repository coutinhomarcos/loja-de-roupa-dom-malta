-- Executa apenas fixtures simuladas, sempre revertidas no fim.
begin;
do $$
declare
    v_admin uuid;
    v_variacao uuid;
    v_pedido uuid := gen_random_uuid();
    v_sem_estoque uuid := gen_random_uuid();
    v_resposta jsonb;
    v_pagamento jsonb;
    v_estoque integer;
    v_tentativa uuid := gen_random_uuid();
begin
    select usuario_id into strict v_admin from public.administradores limit 1;
    select variacao_id into strict v_variacao from public.estoque_checkout_teste order by variacao_id limit 1;
    update public.estoque_checkout_teste set estoque=5, reservado=0 where variacao_id=v_variacao;
    insert into public.pedidos_mp_teste(id,admin_id,vendedor_id,cliente,solicitacao,itens,total,status,criacao_iniciada,preferencia_id)
    values(v_pedido,v_admin,'123','{}','[]',jsonb_build_array(jsonb_build_object('variacao_id',v_variacao,'quantidade',2,'preco',10)),20,'aguardando_pagamento',true,v_pedido::text);
    insert into public.reservas_checkout_teste(pedido_id,variacao_id,quantidade,estado,expira_em)
    values(v_pedido,v_variacao,2,'expirada',now()-interval '1 hour');
    v_pagamento := jsonb_build_object('id','900000000000000000001','status','approved','total',20,'estornado',0,'taxa',1,'liquido',19,'atualizado_em',now(),'aprovado_em',now());
    v_resposta := public.conciliar_pagamento_teste(v_pedido,v_admin,'123',v_pagamento);
    if v_resposta->>'status'<>'approved' or not (v_resposta->>'aprovacao_tardia')::boolean
       or not (v_resposta->>'venda_registrada')::boolean then raise exception 'Não atendeu aprovação tardia com estoque: %',v_resposta; end if;
    select estoque into v_estoque from public.estoque_checkout_teste where variacao_id=v_variacao;
    if v_estoque<>3 then raise exception 'Baixa tardia incorreta'; end if;
    perform public.conciliar_pagamento_teste(v_pedido,v_admin,'123',v_pagamento);
    if (select estoque from public.estoque_checkout_teste where variacao_id=v_variacao)<>3
       or (select count(*) from public.vendas_checkout_teste where pedido_id=v_pedido)<>1
       or (select count(*) from public.eventos_checkout_teste where pedido_id=v_pedido)<>1 then raise exception 'Repetição duplicou efeito'; end if;

    v_resposta := public.iniciar_estorno_teste(v_pedido,v_admin,v_tentativa,5);
    v_resposta := public.iniciar_estorno_teste(v_pedido,v_admin,v_tentativa,5);
    if (select count(*) from public.estornos_checkout_teste where pedido_id=v_pedido)<>1 then raise exception 'Duplicou tentativa de estorno'; end if;
    begin
        perform public.iniciar_estorno_teste(v_pedido,v_admin,gen_random_uuid(),5);
        raise exception 'TESTE: aceitou segundo estorno enquanto primeiro é incerto';
    exception when raise_exception then
        if SQLERRM='TESTE: aceitou segundo estorno enquanto primeiro é incerto' then raise; end if;
    end;
    perform public.concluir_estorno_teste(v_tentativa,v_admin,jsonb_build_object('id','900000000000000000003','payment_id','900000000000000000001','amount',5,'status','approved'));
    if (select estado from public.estornos_checkout_teste where tentativa=v_tentativa)<>'confirmado' then raise exception 'Estorno não confirmado'; end if;
    v_pagamento := v_pagamento || jsonb_build_object('estornado',5,'atualizado_em',now()+interval '1 second');
    v_resposta := public.conciliar_pagamento_teste(v_pedido,v_admin,'123',v_pagamento);
    if v_resposta->>'conciliacao'<>'estorno_parcial' then raise exception 'Estorno parcial não identificado'; end if;
    v_pagamento := v_pagamento || jsonb_build_object('status','in_mediation','atualizado_em',now()+interval '2 seconds');
    v_resposta := public.conciliar_pagamento_teste(v_pedido,v_admin,'123',v_pagamento);
    if v_resposta->>'conciliacao'<>'contestacao_em_analise' then raise exception 'Mediação não identificada'; end if;
    v_pagamento := v_pagamento || jsonb_build_object('status','charged_back','atualizado_em',now()+interval '3 seconds');
    v_resposta := public.conciliar_pagamento_teste(v_pedido,v_admin,'123',v_pagamento);
    if v_resposta->>'conciliacao'<>'contestacao' then raise exception 'Contestação não identificada'; end if;
    if (select estoque from public.estoque_checkout_teste where variacao_id=v_variacao)<>3 then raise exception 'Contestação repôs peça sem conferência'; end if;
    v_resposta := public.conciliar_pagamento_teste(v_pedido,v_admin,'123',v_pagamento || jsonb_build_object('status','approved','atualizado_em',now()));
    if not (v_resposta->>'ignorado')::boolean or v_resposta->>'status'<>'charged_back' then raise exception 'Evento antigo alterou pedido'; end if;

    insert into public.pedidos_mp_teste(id,admin_id,vendedor_id,cliente,solicitacao,itens,total,status,criacao_iniciada,preferencia_id)
    values(v_sem_estoque,v_admin,'123','{}','[]',jsonb_build_array(jsonb_build_object('variacao_id',v_variacao,'quantidade',4,'preco',10)),40,'aguardando_pagamento',true,v_sem_estoque::text);
    insert into public.reservas_checkout_teste(pedido_id,variacao_id,quantidade,estado,expira_em)
    values(v_sem_estoque,v_variacao,4,'expirada',now()-interval '1 hour');
    v_pagamento := jsonb_build_object('id','900000000000000000002','status','approved','total',40,'estornado',0,'taxa',2,'liquido',38,'atualizado_em',now(),'aprovado_em',now());
    v_resposta := public.conciliar_pagamento_teste(v_sem_estoque,v_admin,'123',v_pagamento);
    if v_resposta->>'conciliacao'<>'estorno_necessario' or (v_resposta->>'venda_registrada')::boolean then raise exception 'Não encaminhou falta de estoque para estorno'; end if;
    -- Estoque de outra venda pode reaparecer: a decisão de estorno é preservada.
    update public.estoque_checkout_teste set estoque=10 where variacao_id=v_variacao;
    v_resposta := public.conciliar_pagamento_teste(v_sem_estoque,v_admin,'123',v_pagamento);
    if (v_resposta->>'venda_registrada')::boolean then raise exception 'Reconsulta mudou decisão de estorno'; end if;
    perform public.conciliar_pagamento_teste(v_sem_estoque,v_admin,'123',v_pagamento || jsonb_build_object('status','in_mediation','atualizado_em',now()+interval '1 second'));
    v_resposta := public.conciliar_pagamento_teste(v_sem_estoque,v_admin,'123',v_pagamento || jsonb_build_object('atualizado_em',now()+interval '2 seconds'));
    if (v_resposta->>'venda_registrada')::boolean or v_resposta->>'conciliacao'<>'estorno_necessario' then raise exception 'Mediação apagou decisão de estorno'; end if;
    v_pagamento := v_pagamento || jsonb_build_object('status','refunded','estornado',40,'atualizado_em',now()+interval '3 seconds');
    v_resposta := public.conciliar_pagamento_teste(v_sem_estoque,v_admin,'123',v_pagamento);
    if v_resposta->>'conciliacao'<>'reversao_pagamento' then raise exception 'Estorno total não conciliado'; end if;
    if (select estoque from public.estoque_checkout_teste where variacao_id=v_variacao)<>10 then raise exception 'Estorno alterou peças não consumidas'; end if;

    begin
        perform public.conciliar_pagamento_teste(v_sem_estoque,v_admin,'999',v_pagamento);
        raise exception 'TESTE: aceitou vendedor divergente';
    exception when raise_exception then
        if SQLERRM='TESTE: aceitou vendedor divergente' then raise; end if;
    end;
    if has_function_privilege('anon','public.conciliar_pagamento_teste(uuid,uuid,text,jsonb)','execute')
       or has_function_privilege('authenticated','public.conciliar_pagamento_teste(uuid,uuid,text,jsonb)','execute') then raise exception 'RPC exposta a cliente'; end if;
end $$;
select 'Cenários de conciliação aprovados; fixtures revertidas' as resultado;
rollback;
