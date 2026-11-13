/* Funções comuns às telas de Produtos e Estoque. */
window.Inventario = {
    async limiteEstoque(){
        const rows=await Banco.resultado(Banco.client.from('configuracoes_loja').select('limite_estoque').eq('id',1));
        return Number(rows[0]?.limite_estoque)||5;
    },
    notificar(){try{localStorage.setItem('domMaltaCatalogoAtualizado',String(Date.now()));}catch{/* O próximo carregamento sempre consulta o banco. */}},
    confirmar(texto){
        return new Promise(resolve=>{
            const dialog=document.createElement('dialog');dialog.className='inventario-dialog';
            const mensagem=document.createElement('p');mensagem.textContent=texto;
            const cancelar=document.createElement('button'),confirmar=document.createElement('button');cancelar.textContent='Cancelar';confirmar.textContent='Confirmar';
            let aceitou=false;cancelar.addEventListener('click',()=>dialog.close());confirmar.addEventListener('click',()=>{aceitou=true;dialog.close();});
            dialog.append(mensagem,cancelar,confirmar);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();resolve(aceitou);},{once:true});dialog.showModal();
        });
    },
    editar(p) {
        return new Promise(resolve=>{
            const dialog=document.createElement('dialog');dialog.className='inventario-dialog';
            const form=document.createElement('form'),titulo=document.createElement('h2');titulo.textContent='Editar produto e estoque';form.append(titulo);
            const campos={};
            for(const [campo,label] of [['nome','Nome do produto'],['categoria','Categoria'],['tamanho','Tamanho'],['cor','Cor'],['custo','Custo'],['preco','Preço'],['estoque','Quantidade física']]){
                const rotulo=document.createElement('label'),input=document.createElement('input');rotulo.textContent=label;
                input.value=p[campo];input.required=true;input.name=campo;
                if(['custo','preco','estoque'].includes(campo)){input.type='number';input.min=campo==='estoque'?Number(p.reservado||0):0;input.step=campo==='estoque'?'1':'0.01';}
                campos[campo]=input;rotulo.append(input);form.append(rotulo);
            }
            const aviso=document.createElement('p');aviso.setAttribute('role','status');form.append(aviso);
            const acoes=document.createElement('div'),cancelar=document.createElement('button'),salvar=document.createElement('button');
            cancelar.type='button';cancelar.textContent='Cancelar';salvar.type='submit';salvar.textContent='Salvar alterações';acoes.append(cancelar,salvar);form.append(acoes);dialog.append(form);document.body.append(dialog);
            let gravou=false;dialog.addEventListener('cancel',e=>{if(salvar.disabled)e.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();resolve(gravou);},{once:true});cancelar.addEventListener('click',()=>dialog.close());
            form.addEventListener('submit',async e=>{
                e.preventDefault();const dados={};
                for(const [campo,input] of Object.entries(campos))dados[campo]=input.type==='number'?Number(input.value):input.value.trim();
                if(!dados.nome||!dados.categoria||!dados.tamanho||!dados.cor||!Number.isFinite(dados.custo)||dados.custo<0||!Number.isFinite(dados.preco)||dados.preco<0||!Number.isInteger(dados.estoque)||dados.estoque<Number(p.reservado||0)){aviso.textContent='Verifique os dados. A quantidade deve cobrir as peças reservadas.';return;}
                salvar.disabled=true;cancelar.disabled=true;
                try{await Banco.rpc('editar_variacao',{variacao:p.id,dados});Inventario.notificar();gravou=true;dialog.close();}
                catch(erro){aviso.textContent=erro.message||'Não foi possível salvar.';}
                finally{salvar.disabled=false;cancelar.disabled=false;}
            });
            dialog.showModal();
        });
    },
    visualizar(p) {
        alert(`${p.nome}\n${p.tamanho} / ${p.cor}\nEstoque físico: ${p.estoque}\nDisponível: ${p.disponivel}\nReservado: ${p.reservado}\nPreço: ${Banco.moeda(p.preco)}`);
    }
};
