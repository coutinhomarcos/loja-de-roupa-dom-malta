'use strict';
// Aplicar somente à cotação obtida no servidor; nunca ao valor enviado pelo navegador.
function comAdicionalCorreios(valorCentavos){
    if(!Number.isSafeInteger(valorCentavos)||valorCentavos<0||valorCentavos>100000000)throw new Error('Cotação de frete inválida.');
    return Math.round(valorCentavos*105/100);
}
module.exports={comAdicionalCorreios};
