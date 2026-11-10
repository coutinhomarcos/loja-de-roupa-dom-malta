'use strict';
const { configuracao,vendedor }=require('../lib/pagamento');
const { verificarAssinatura }=require('./webhook-teste');
const { Falha,UUID,mp,banco,consultar }=require('../lib/pagamento-teste').interno;
module.exports=async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try {
        const c=configuracao();
        if(req.method!=='POST'){res.setHeader('Allow','POST');throw new Falha(405,'Método não permitido.');}
        const id=verificarAssinatura(req);
        const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
        if(body?.type!=='payment'||String(body.data?.id)!==id)throw new Falha(400,'Evento inválido.');
        await vendedor(c);
        const pagamento=await mp(c,'/v1/payments/'+id);
        if(String(pagamento.collector_id)!==c.vendedor)throw new Falha(409,'Pagamento de outro vendedor.');
        if(!UUID.test(pagamento.external_reference))return res.status(200).json({resultado:'fora_deste_fluxo'});
        const pedidos=await banco(c,'pedidos_mp_teste?select=id&admin_id=eq.'+c.admin+'&id=eq.'+pagamento.external_reference);
        if(!pedidos.length)return res.status(200).json({resultado:'fora_deste_fluxo'});
        const r=await consultar(c,c.admin,c.vendedor,{id:pagamento.external_reference,pagamento_id:id});
        if(r.pagamento_id!==id||r.status!==pagamento.status)throw new Falha(503,'Aguarde a conciliação e tente novamente.');
        return res.status(200).json({resultado:'pagamento_verificado'});
    }catch(e){return res.status(e instanceof Falha?e.status:500).json({erro:e instanceof Falha?e.message:'Não foi possível conciliar a notificação.'});}
};
