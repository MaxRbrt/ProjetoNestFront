import type { ButtonHTMLAttributes } from 'react';

interface PropsDoBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'fantasma' | 'perigo';
  tamanho?: 'pequeno' | 'medio' | 'grande';
  bloco?: boolean;
  carregando?: boolean;
}

const VARIANTES = {
  primario:
    'bg-acento text-white hover:bg-acento-escuro focus-visible:outline-acento',
  secundario:
    'bg-superficie text-tinta border border-borda-forte hover:bg-superficie-sutil focus-visible:outline-marca',
  fantasma:
    'bg-transparent text-tinta-media hover:bg-superficie-sutil hover:text-tinta focus-visible:outline-marca',
  perigo:
    'bg-transparent text-erro hover:bg-erro-suave focus-visible:outline-erro',
} as const;

const TAMANHOS = {
  pequeno: 'min-h-12 px-3 py-2 text-base',
  medio: 'min-h-13 px-6 py-3 text-lg',
  grande: 'min-h-14 px-8 py-3 text-lg',
} as const;

export interface OpcoesDeClassesDeBotao {
  variante?: 'primario' | 'secundario' | 'fantasma' | 'perigo';
  tamanho?: 'pequeno' | 'medio' | 'grande';
  bloco?: boolean;
  className?: string;
}

// ---------------------------------------------
// Classes do Botão
// Função pura com as mesmas classes que o <button> do Botao usa, para telas
// que precisam do visual de botão em um elemento que não pode ser um
// <button> — por exemplo um <Link> de navegação, onde aninhar um <button>
// dentro do <a> gerado pelo React Router produz HTML inválido (interativo
// dentro de interativo). O Botao chama esta mesma função, então não existe
// uma segunda fonte de estilo para manter sincronizada.
// ---------------------------------------------
export function classesDeBotao({
  variante = 'primario',
  tamanho = 'medio',
  bloco = false,
  className = '',
}: OpcoesDeClassesDeBotao = {}): string {
  return `inline-flex items-center justify-center gap-2 rounded-card text-center font-semibold leading-normal transition-colors duration-150 ease-saida focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:bg-borda disabled:text-tinta-media active:brightness-90 ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${bloco ? 'w-full' : ''} ${className}`;
}

// ---------------------------------------------
// Botão
// Uma única fonte de estilo de ação na loja inteira. O rótulo continua
// visível enquanto carrega, e o disabled cobre também o estado de carga
// para impedir duplo envio.
// ---------------------------------------------
export function Botao({
  variante = 'primario',
  tamanho = 'medio',
  bloco = false,
  carregando = false,
  disabled,
  className = '',
  children,
  ...resto
}: PropsDoBotao) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando}
      className={classesDeBotao({ variante, tamanho, bloco, className })}
    >
      {children}
    </button>
  );
}
