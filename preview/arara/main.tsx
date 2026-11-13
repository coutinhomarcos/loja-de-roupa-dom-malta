import React from 'react';
import {createRoot} from 'react-dom/client';
import ClothingRailHero, {type RailGarment} from './product-rail-gallery';

function Vitrine(){
  const [pecas,setPecas]=React.useState<(RailGarment & {categoria:string})[]>([]);
  const [categoria,setCategoria]=React.useState('todas');
  const [inicio,setInicio]=React.useState(0);
  const [erro,setErro]=React.useState('');
  const [carregando,setCarregando]=React.useState(true);
  React.useEffect(()=>{
    let presente=true;
    const api=(window as any).CatalogoLoja;
    async function atualizar(force=false){
      try{const dados=await api.obter(force);if(presente){setPecas(api.pecasArara(dados));setInicio(0);setErro('');}}
      catch{if(presente)setErro('Não foi possível consultar as peças agora. Atualize a página para tentar novamente.');}
      finally{if(presente)setCarregando(false);}
    }
    const recarregar=()=>atualizar(true);
    const visivel=()=>{if(document.visibilityState==='visible')atualizar(true);};
    atualizar();window.addEventListener('catalogo:atualizado',recarregar);document.addEventListener('visibilitychange',visivel);
    return()=>{presente=false;window.removeEventListener('catalogo:atualizado',recarregar);document.removeEventListener('visibilitychange',visivel);};
  },[]);
  const navegacao=(window as any).AraraNavegacao;
  const pagina=navegacao.pagina(pecas,categoria,inicio);
  function navegar(sentido:number){setInicio(i=>navegacao.avancar(i,pagina.paginas,sentido));}
  return <div className="vitrine-arara">
    <div className="filtros-arara" role="group" aria-label="Filtrar cabides por categoria">
      {[['todas','Todas'],['camisas','Camisas'],['calcas','Calças'],['bermudas','Bermudas']].map(([valor,nome])=><button key={valor} type="button" aria-pressed={categoria===valor} onClick={()=>{setCategoria(valor);setInicio(0);}}>{nome}</button>)}
    </div>
    <div className="navegacao-arara" aria-label="Navegar pelos cabides">
      <button type="button" aria-label="Cabides anteriores" disabled={pagina.paginas<=1} onClick={()=>navegar(-1)}><svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-6-6 6 6 6"/></svg></button>
      <p role="status">{carregando?'Consultando a coleção…':pagina.total?`${pagina.de}–${pagina.ate} de ${pagina.total} fotos`:'Nenhum produto com foto nesta categoria.'}</p>
      <button type="button" aria-label="Próximos cabides" disabled={pagina.paginas<=1} onClick={()=>navegar(1)}><svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
    </div>
    {erro&&<p className="aviso-arara" role="alert">{erro}</p>}
    {!!pagina.itens.length&&<ClothingRailHero key={`${categoria}-${pagina.indice}`} items={pagina.itens} detailItems={categoria === 'todas' ? pecas : pecas.filter(p => p.categoria === categoria)} hanger="wood" autoplay={false}
      caption="Use as setas para explorar. Clique na peça para ver cor, numeração e disponibilidade."
      labels={{front:'Frente',back:'Costas',close:'Fechar',show:'Mostrar'}}/>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Vitrine/>);


