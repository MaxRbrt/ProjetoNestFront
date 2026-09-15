import type { ReactNode } from 'react';

export interface PropsDaEtiqueta {
  tom?: 'neutro' | 'acento' | 'sucesso' | 'erro' | 'aviso';
  children: ReactNode;
}

const TONS = {
  neutro: 'bg-superficie-sutil text-tinta-media border border-borda',
  acento: 'bg-acento-suave text-acento-escuro',
  sucesso: 'bg-sucesso-suave text-sucesso',
  erro: 'bg-erro-suave text-erro',
  aviso: 'bg-aviso/10 text-aviso',
} as const;

// ---------------------------------------------
// Etiqueta
// Rótulo curto e não interativo (situação de pedido, categoria): por isso não
// carrega foco nem semântica de botão. A cor nunca é a única pista — o texto
// em children já diz o que a etiqueta significa. Não existe token
// "aviso-suave" no tema, por isso o tom aviso usa a cor sólida com opacidade
// reduzida (bg-aviso/10) em vez de inventar um novo token de cor.
// ---------------------------------------------
export function Etiqueta({ tom = 'neutro', children }: PropsDaEtiqueta) {
  return (
    <span
      className={`inline-flex items-center rounded-pilula px-2.5 py-1 text-xs font-semibold ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}
