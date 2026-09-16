import type { HTMLAttributes } from 'react';

export interface PropsDoCartao extends HTMLAttributes<HTMLElement> {
  como?: 'section' | 'article' | 'aside' | 'nav' | 'div' | 'li';
  espaco?: 'normal' | 'compacto' | 'nenhum';
}

const ESPACOS = {
  normal: 'p-5 sm:p-7',
  compacto: 'p-4 sm:p-5',
  nenhum: '',
} as const;

// ---------------------------------------------
// Cartão
// Superfície branca única da loja: mesma borda, mesma sombra leve e o mesmo
// respiro interno em todas as telas. O elemento é escolhido pelo consumidor
// (section, article, li...) para que a troca de visual nunca custe a
// semântica que a tela já tinha. Espaçamento e layout interno continuam
// livres via className.
// ---------------------------------------------
export function Cartao({
  como: Elemento = 'div',
  espaco = 'normal',
  className = '',
  ...resto
}: PropsDoCartao) {
  return (
    <Elemento
      {...resto}
      className={`rounded-card border border-borda bg-superficie shadow-carta ${ESPACOS[espaco]} ${className}`}
    />
  );
}
