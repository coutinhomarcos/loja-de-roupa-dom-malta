'use strict';
const {configuracao,cronAutorizado,vendedor}=require('../lib/pagamento');
const {banco,consultar,Falha}=require('../lib/pagamento-teste').interno;
module.exports=async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try {
        cronAutorizado(req);
        if(!['GET','POST'].includes(req.method))throw new Falha(405,'Método não permitido.');
        const c=configuracao();await vendedor(c);
        const pedidos=await banco(c,'pedidos_mp_teste?select=id,reservas_checkout_teste!inner(estado)&reservas_checkout_teste.estado=eq.reservada&status=in.(aguardando_checkout,aguardando_pagamento,pending,in_process,authorized,rejected)&checkout_expira_em=lte.'+encodeURIComponent(new Date().toISOString())+'&order=reserva_verificada_em.asc.nullsfirst,criado_em.asc&limit=10');
        let verificados=0,falhas=0;
        for(const {id} of pedidos){
            await banco(c,'pedidos_mp_teste?id=eq.'+id,'PATCH',{reserva_verificada_em:new Date().toISOString()});
            try{await consultar(c,c.admin,c.vendedor,{id});verificados++;}catch{falhas++;}
        }
        return res.status(200).json({verificados,falhas});
    }catch(e){return res.status(e instanceof Falha?e.status:500).json({erro:e instanceof Falha?e.message:'Não foi possível verificar os prazos.'});}
};
