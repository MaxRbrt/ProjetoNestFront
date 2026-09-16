import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

export interface PropsDaSelecao extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  erro?: string;
  children: ReactNode;
}

// ---------------------------------------------
// Seleção
// Mesmo contrato de acessibilidade do Campo: rótulo e select ligados por id,
// aria-invalid e aria-describedby quando há erro. O <select> nativo já
// resolve teclado e leitor de tela sozinho — o componente só cuida da
// ligação entre rótulo, erro e o elemento.
// ---------------------------------------------
export function Selecao({
  rotulo,
  erro,
  id,
  className = '',
  children,
  ...resto
}: PropsDaSelecao) {
  const idGerado = useId();
  const idDaSelecao = id ?? idGerado;
  const idDoErro = `${idDaSelecao}-erro`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={idDaSelecao} className="text-lg font-semibold text-tinta">
        {rotulo}
      </label>
      <select
        {...resto}
        id={idDaSelecao}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={erro ? idDoErro : undefined}
        className={`min-h-13 w-full min-w-0 rounded-card border bg-superficie px-3.5 text-lg text-tinta focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca disabled:cursor-not-allowed disabled:bg-superficie-sutil disabled:text-tinta-suave ${erro ? 'border-erro' : 'border-borda-forte'} ${className}`}
      >
        {children}
      </select>
      {erro ? (
        <span id={idDoErro} className="text-base text-erro">
          {erro}
        </span>
      ) : null}
    </div>
  );
}
