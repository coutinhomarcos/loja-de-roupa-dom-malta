/* Mesmos destinos das páginas de contato; não envia mensagens automaticamente. */
(() => {
const base=new URL('../images/',document.currentScript.src);
document.addEventListener('DOMContentLoaded',()=>{
    if(document.querySelector('.redes-flutuantes'))return;
    const nav=document.createElement('nav');nav.className='redes-flutuantes';nav.setAttribute('aria-label','Atalhos de contato');
    for(const [rede,url] of [
        ['Instagram','https://www.instagram.com/dom_malta/'],
        ['WhatsApp','https://chat.whatsapp.com/HFbKQFnzVo51rlqutK48PI?mode=gi_t'],
    ]){
        const a=document.createElement('a');a.className='rede-flutuante rede-flutuante-'+rede.toLowerCase();a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Abrir '+rede+' da loja');
        const img=document.createElement('img');img.src=new URL(rede.toLowerCase()+'-icon.svg',base).href;img.alt='';img.width=24;img.height=24;a.append(img);nav.append(a);
    }
    document.body.append(nav);
});
})();
