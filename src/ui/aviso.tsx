import type { ReactNode } from 'react';

export interface PropsDoAviso {
  tipo?: 'erro' | 'sucesso';
  children: ReactNode;
}

const TONS = {
  erro: 'border-erro/30 bg-erro-suave text-erro',
  sucesso: 'border-sucesso/30 bg-sucesso-suave text-sucesso',
} as const;

// ---------------------------------------------
// Aviso
// role={tipo === 'erro' ? 'alert' : 'status'} faz o leitor de tela anunciar a mensagem assim que ela aparece,
// sem esperar o usuário navegar até ela.
// ---------------------------------------------
export function Aviso({ tipo = 'erro', children }: PropsDoAviso) {
  return (
    <p
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={`rounded-card border px-4 py-4 text-base leading-relaxed ${TONS[tipo]}`}
    >
      {children}
    </p>
  );
}
