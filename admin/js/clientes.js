document.addEventListener('DOMContentLoaded',Banco.executar(async()=>{
    if(!await adminPronto)return;
    let clientes=await Banco.listar('clientes');
    const tbody=document.querySelector('table tbody'),busca=document.getElementById('search-cliente');
    function renderizar(){
        tbody.replaceChildren();const termo=(busca?.value||'').toLocaleLowerCase('pt-BR');
        clientes.filter(c=>`${c.nome} ${c.telefone} ${c.email}`.toLocaleLowerCase('pt-BR').includes(termo)).forEach(c=>{
            const tr=document.createElement('tr');
            tr.innerHTML=`<td>${Banco.esc(c.codigo.slice(0,8))}</td><td>${Banco.esc(c.nome)}</td><td>${Banco.esc(c.telefone)}</td><td>${Banco.esc(c.email)}</td><td>${c.compras}</td><td>${Banco.esc(c.ultimaCompra)}</td><td><span class="badge badge-active">Ativo</span></td><td class="actions"></td>`;
            [['✏️',()=>editar(c)],['🗑️',async()=>{if(confirm(`Excluir ${c.nome}?`)){await Banco.excluir('clientes','codigo',c.codigo);await recarregar();}}]].forEach(([txt,fn])=>{
                const b=document.createElement('button');b.className='btn-action';b.textContent=txt;b.addEventListener('click',Banco.executar(fn));tr.lastElementChild.append(b);
            });tbody.append(tr);
        });
        const valores={'total-clientes':clientes.length,'novos-clientes':clientes.length,'clientes-ativos':clientes.length,'compras-realizadas':clientes.reduce((s,c)=>s+c.compras,0),'clientes-count':`${clientes.length} clientes`};
        for(const[id,v]of Object.entries(valores)){const e=document.getElementById(id);if(e)e.textContent=v;}
    }
    async function recarregar(){clientes=await Banco.listar('clientes');renderizar();}
    async function editar(c={}){
        const dados={};
        for(const[campo,label]of [['nome','Nome'],['telefone','Telefone (10 ou 11 números)'],['email','E-mail']]){
            const v=prompt(label,c[campo]||'');if(v===null)return;dados[campo]=v.trim();
        }
        dados.telefone=dados.telefone.replace(/\D/g,'');
        if(!dados.nome||!/^\d{10,11}$/.test(dados.telefone)||!/^\S+@\S+\.\S+$/.test(dados.email))throw new Error('Verifique nome, telefone e e-mail.');
        if(c.codigo)await Banco.atualizar('clientes',dados,'codigo',c.codigo);
        else await Banco.salvar('clientes',{codigo:crypto.randomUUID(),...dados});
        await recarregar();
    }
    document.getElementById('btn-novo-cliente')?.addEventListener('click',Banco.executar(()=>editar()));
    busca?.addEventListener('input',renderizar);renderizar();
}));
