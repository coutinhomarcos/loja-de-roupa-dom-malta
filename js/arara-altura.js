/* O iframe acompanha o conteúdo; o diálogo usa apenas a área visível abaixo do cabeçalho. */
(() => {
  const frame = document.querySelector('.arara-vitrine');
  if (frame) {
    function informarViewport() {
      const rect = frame.getBoundingClientRect();
      const header = document.querySelector('.cabecalho')?.getBoundingClientRect();
      const topo = Math.max(0, (header?.bottom || 0) - rect.top);
      const fim = Math.min(rect.height, window.innerHeight - rect.top);
      frame.contentWindow?.postMessage({tipo:'arara:viewport',topo,altura:Math.max(1,fim-topo)}, location.origin);
    }
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.tipo === 'arara:altura') {
        const altura = Number(event.data.altura);
        if (Number.isFinite(altura) && altura > 0 && altura < 20000) frame.style.height = `${Math.ceil(altura)}px`;
        informarViewport();
      } else if (event.data?.tipo === 'arara:pronto') informarViewport();
    });
    window.addEventListener('scroll', informarViewport, {passive:true});
    window.addEventListener('resize', informarViewport);
    frame.addEventListener('load', informarViewport);
    informarViewport();
  } else if (window.parent !== window) {
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.tipo !== 'arara:viewport') return;
      const {topo,altura}=event.data;
      if (!Number.isFinite(topo) || !Number.isFinite(altura) || topo < 0 || altura <= 0) return;
      document.documentElement.style.setProperty('--arara-topo-visivel',`${topo}px`);
      document.documentElement.style.setProperty('--arara-altura-visivel',`${altura}px`);
    });
    parent.postMessage({tipo:'arara:pronto'}, location.origin);
    const root = document.getElementById('root');
    if (!root) return;
    let ultima = 0;
    const informar = () => {
      const altura = Math.ceil(root.getBoundingClientRect().height);
      if (altura > 0 && altura !== ultima) {
        ultima = altura;
        parent.postMessage({tipo:'arara:altura', altura}, location.origin);
      }
    };
    new ResizeObserver(informar).observe(root);
    window.addEventListener('load', informar);
    informar();
  }
})();
