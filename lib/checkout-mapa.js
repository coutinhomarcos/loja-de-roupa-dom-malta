'use strict';
// Os dois ambientes usam as mesmas regras, em tabelas e RPCs distintas.
module.exports = Object.freeze({
    pedidos_mp_teste: 'pedidos_checkout',
    estoque_checkout_teste: 'estoque_checkout',
    reservas_checkout_teste: 'reservas_checkout',
    vendas_checkout_teste: 'vendas_checkout',
    eventos_checkout_teste: 'eventos_checkout',
    estornos_checkout_teste: 'estornos_checkout',
    criar_pedido_mp_teste: 'criar_pedido_checkout',
    iniciar_checkout_mp_teste: 'iniciar_checkout',
    reservar_estoque_teste: 'reservar_estoque_checkout',
    confirmar_venda_teste: 'consumir_reserva_checkout',
    liberar_reserva_teste: 'liberar_reserva_checkout',
    confirmar_pagamento_teste: 'confirmar_pagamento_checkout',
    conciliar_pagamento_teste: 'conciliar_pagamento_checkout',
    iniciar_estorno_teste: 'iniciar_estorno_checkout',
    concluir_estorno_teste: 'concluir_estorno_checkout'
});
