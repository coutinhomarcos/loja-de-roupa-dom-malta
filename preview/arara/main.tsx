import React from 'react';
import { createRoot } from 'react-dom/client';
import ClothingRailHero from './product-rail-gallery';
const items = [
  ['camisas','Camisa',1], ['camisas','Camisa',2],
  ['calcas','Calça',1], ['calcas','Calça',2],
  ['bermudas','Bermuda',1], ['bermudas','Bermuda',2],
].map(([categoria, nome, numero]) => ({
  id: `${categoria}-${numero}`,
  name: `${nome} · ${numero}`,
  image: `../../images/produtos/${categoria}/${categoria}-${String(numero).padStart(2,'0')}.jpg`,
  description: `${nome} do mostruário da loja. Consulte os tamanhos, as cores e a disponibilidade.`,
  tag: String(nome),
  details: [`Categoria: ${nome}`, 'Foto de frente', 'Disponibilidade a consultar'],
}));
createRoot(document.getElementById('root')!).render(
  <ClothingRailHero items={items} hanger="wood" autoplay
    eyebrow="DOM MALTA · NOSSA COLEÇÃO"
    heading="Sua próxima peça está aqui."
    caption="Explore camisas, calças e bermudas da nossa coleção. Clique na peça para ampliar a foto de frente."
    labels={{front:'Frente',back:'Costas',close:'Fechar',show:'Mostrar'}}
    action={<p className="text-xs text-muted-foreground">Mostruário da coleção · consulte os tamanhos e a disponibilidade com a loja.</p>}
  />
);
