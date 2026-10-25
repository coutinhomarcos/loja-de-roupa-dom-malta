/* Consulta pública de endereço; não calcula frete ou prazo dos Correios. */
(() => {
    window.DOMMaltaEntrega = Object.freeze({cepOrigem:'32044420', frete:'a_combinar'});
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('formPedido');
        if (!form) return;
        const cep = form.elements.cep;
        const aviso = document.getElementById('mensagemCep');
        const buscar = document.getElementById('buscarCep');
        const campos = ['logradouro', 'bairro', 'cidade', 'uf'];
        let controller, sequencia = 0, cepPreenchido = '';
        function cancelar() {sequencia++;controller?.abort();buscar.disabled=false;}
        function limpar() {campos.forEach(nome => form.elements[nome].value='');}
        cep.addEventListener('input', () => {
            cancelar();
            if (cepPreenchido && cep.value.replace(/\D/g,'')!==cepPreenchido) {limpar();cepPreenchido='';}
            aviso.textContent='';
        });
        form.elements.recebimento.addEventListener('change',()=>{cancelar();aviso.textContent='';});
        async function consultar() {
            const valor = cep.value.trim().replace(/\D/g,'');
            cancelar();
            if (!/^\d{8}$/.test(valor)) {aviso.textContent='Informe um CEP com 8 dígitos.';return;}
            if (valor===cepPreenchido) return;
            const atual = sequencia;
            controller = new AbortController();
            const requisicao = controller;
            const timer = setTimeout(()=>requisicao.abort(),10000);
            buscar.disabled=true;aviso.textContent='Consultando CEP…';
            try {
                const resposta=await fetch(`https://viacep.com.br/ws/${valor}/json/`,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
                if (!resposta.ok) throw new Error('Serviço indisponível');
                const endereco=await resposta.json();
                if (atual!==sequencia || form.elements.recebimento.value!=='entrega') return;
                if (endereco.erro===true || endereco.erro==='true') {limpar();cepPreenchido='';aviso.textContent='CEP não encontrado. Confira os números ou preencha o endereço manualmente.';return;}
                if (typeof endereco.localidade!=='string'||!/^[A-Z]{2}$/.test(endereco.uf)) throw new Error('Resposta inválida');
                form.elements.logradouro.value=String(endereco.logradouro||'').slice(0,120);
                form.elements.bairro.value=String(endereco.bairro||'').slice(0,80);
                form.elements.cidade.value=endereco.localidade.slice(0,80);
                form.elements.uf.value=endereco.uf;
                cep.value=valor.slice(0,5)+'-'+valor.slice(5);
                cepPreenchido=valor;
                aviso.textContent='Endereço preenchido. Confira os dados e informe o número e o complemento, se houver. Frete a combinar.';
            } catch (erro) {
                if (atual===sequencia) aviso.textContent='Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.';
            } finally {
                clearTimeout(timer);
                if (atual===sequencia) buscar.disabled=false;
            }
        }
        buscar.addEventListener('click',consultar);
        cep.addEventListener('blur',()=>{if (/^\d{8}$/.test(cep.value.replace(/\D/g,''))) consultar();});
    });
})();
