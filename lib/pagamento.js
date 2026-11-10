'use strict';
const { createHash, timingSafeEqual } = require('node:crypto');
const { Falha, UUID, banco, mp, criar, consultar, estornar, administrador } = require('./pagamento-teste').interno;

const obrigatorias = ['SUPABASE_URL','SUPABASE_SECRET_KEY','MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_WEBHOOK_SECRET','MERCADO_PAGO_VENDEDOR_ID','LOJA_ADMIN_ID','CRON_SECRET'];
function pendencias(e = process.env) {
    const faltam = obrigatorias.filter(nome => !e[nome]?.trim());
    if (e.MERCADO_PAGO_MODO !== 'producao') faltam.push('MERCADO_PAGO_MODO=producao');
    if (e.PAGAMENTOS_REAIS_HABILITADOS !== 'true') faltam.push('PAGAMENTOS_REAIS_HABILITADOS=true');
    if (e.CHECKOUT_BANCO_INSTALADO !== 'true') faltam.push('CHECKOUT_BANCO_INSTALADO=true');
    if (e.CHECKOUT_EXPIRACAO_CONFIGURADA !== 'true') faltam.push('CHECKOUT_EXPIRACAO_CONFIGURADA=true');
    return faltam;
}
function configuracao(aceitarNovos = false) {
    const e = process.env;
    const faltam=pendencias().filter(nome=>aceitarNovos || (!nome.startsWith('PAGAMENTOS_REAIS_HABILITADOS')&&!nome.startsWith('CHECKOUT_EXPIRACAO_CONFIGURADA')&&nome!=='CRON_SECRET'));
    if (e.VERCEL_ENV !== 'production' || faltam.length) throw new Falha(503, 'Pagamento online ainda não está disponível. Você pode enviar o pedido para a loja.');
    let origem, urlBanco;
    try { origem = new URL(e.LOJA_URL || 'https://loja-de-roupa-dom-malta.vercel.app/'); urlBanco = new URL(e.SUPABASE_URL); } catch { throw new Falha(503, 'Configuração da loja indisponível.'); }
    if (origem.protocol !== 'https:' || origem.username || origem.password || origem.pathname !== '/' || origem.search || origem.hash
        || urlBanco.protocol !== 'https:' || !urlBanco.hostname.endsWith('.supabase.co') || urlBanco.pathname !== '/'
        || !e.SUPABASE_SECRET_KEY.startsWith('sb_secret_') || !UUID.test(e.LOJA_ADMIN_ID)
        || !/^\d{1,30}$/.test(e.MERCADO_PAGO_VENDEDOR_ID)) throw new Falha(503, 'Configuração da loja indisponível.');
    return { real: true, banco: urlBanco.origin, origem: origem.origin, chave:e.SUPABASE_SECRET_KEY,
        token:e.MERCADO_PAGO_ACCESS_TOKEN, admin:e.LOJA_ADMIN_ID, vendedor:e.MERCADO_PAGO_VENDEDOR_ID };
}
async function vendedor(c) {
    const conta = await mp(c,'/users/me');
    if (String(conta.id)!==c.vendedor || !Array.isArray(conta.tags) || conta.tags.includes('test_user')) throw new Falha(503,'Confira a conta recebedora da loja.');
    return c.vendedor;
}
function hash(valor) { return createHash('sha256').update(valor).digest('hex'); }
async function acesso(c, body) {
    if (!UUID.test(body.id) || typeof body.chave !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.chave)) throw new Falha(404,'Pedido não encontrado. Confira o protocolo e a chave de acompanhamento.');
    const rows=await banco(c,'pedidos_mp_teste?select=id&admin_id=eq.'+c.admin+'&id=eq.'+body.id+'&acesso_hash=eq.'+hash(body.chave));
    if (rows.length!==1) throw new Falha(404,'Pedido não encontrado. Confira o protocolo e a chave de acompanhamento.');
}
async function limitar(c, req, acao) {
    const ip=String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconhecido').split(',')[0].trim();
    await banco(c,'rpc/limitar_checkout','POST',{p_chave:hash(c.chave+'|'+ip+'|'+acao),p_limite:acao==='criar'?5:60});
}
function bodyJson(req) {
    if (!(req.headers['content-type']||'').startsWith('application/json')) throw new Falha(415,'Envie JSON.');
    let body;
    try { body=typeof req.body==='string'?JSON.parse(req.body):req.body; } catch { throw new Falha(400,'JSON inválido.'); }
    if (!body || typeof body!=='object' || Array.isArray(body) || JSON.stringify(body).length>24000) throw new Falha(400,'Requisição inválida.');
    return body;
}
function cronAutorizado(req) {
    const esperado=process.env.CRON_SECRET||'';
    const recebido=String(req.headers.authorization||'').replace(/^Bearer /,'');
    if (!esperado || Buffer.byteLength(recebido)!==Buffer.byteLength(esperado)
        || !timingSafeEqual(Buffer.from(recebido),Buffer.from(esperado))) throw new Falha(401,'Acesso não autorizado.');
}
async function handler(req,res) {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    try {
        if (req.method==='GET') {
            try { configuracao(true); return res.status(200).json({habilitado:true,recebimento:'retirada'}); }
            catch { return res.status(200).json({habilitado:false}); }
        }
        if (req.method!=='POST') { res.setHeader('Allow','GET, POST'); throw new Falha(405,'Método não permitido.'); }
        const c=configuracao();
        if (req.headers.origin && req.headers.origin!==c.origem) throw new Falha(403,'Abra pelo endereço da loja.');
        const body=bodyJson(req);
        if (!['criar','consultar','listar','estornar','atender','cancelar'].includes(body.acao)) throw new Falha(400,'Ação inválida.');
        const admin=['listar','estornar','atender'].includes(body.acao) || body.administrativo===true;
        if(admin) await administrador(c,req); else await limitar(c,req,body.acao);
        if(body.acao==='listar') {
            if(body.id&&!UUID.test(body.id))throw new Falha(400,'Informe um protocolo válido para pesquisar.');
            const pedidos=await banco(c,'pedidos_mp_teste?select=id,criado_em,status,total,cliente,conciliacao,atendimento,solicitacao_cancelamento,solicitacao_estorno,valor_estornado,taxa_mp,valor_liquido,estornos_checkout_teste(tentativa,valor,estado)&estornos_checkout_teste.estado=eq.iniciado&order=criado_em.desc&limit=100'+(body.id?'&id=eq.'+body.id:''));
            return res.status(200).json({pedidos:pedidos.map(p=>({...p,estorno_pendente:p.estornos_checkout?.[0]||null}))});
        }
        if(body.acao==='atender') {
            if(!UUID.test(body.id)) throw new Falha(400,'Protocolo inválido.');
            await banco(c,'rpc/atender_pedido_checkout','POST',{p_pedido:body.id,p_admin:c.admin,p_estado:body.estado});
            return res.status(200).json({atualizado:true});
        }
        if(body.acao==='criar') {
            configuracao(true);
            if(body.cliente?.recebimento!=='retirada') throw new Falha(409,'Envie pedidos com entrega para a loja combinar o frete antes de cobrar.');
            if(typeof body.chave!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(body.chave)) throw new Falha(400,'Chave do pedido inválida.');
            body.acesso_hash=hash(body.chave);
        } else if(!admin) await acesso(c,body);
        if(body.acao==='cancelar') {
            await banco(c,'rpc/solicitar_cancelamento_checkout','POST',{p_pedido:body.id,p_admin:c.admin});
            return res.status(200).json({solicitado:true,mensagem:'Solicitação registrada. A loja conferirá pagamentos e eventual estorno; a reserva só será liberada após confirmar o encerramento.'});
        }
        const conta=await vendedor(c);
        const resposta=body.acao==='criar'?await criar(c,c.admin,conta,body)
            :body.acao==='estornar'?await estornar(c,c.admin,conta,body):await consultar(c,c.admin,conta,body);
        return res.status(200).json(resposta);
    } catch(erro) {
        return res.status(erro instanceof Falha?erro.status:500).json({erro:erro instanceof Falha?erro.message:'Não foi possível concluir. Consulte novamente antes de repetir.'});
    }
}
module.exports={handler,configuracao,pendencias,vendedor,acesso,hash,cronAutorizado};
