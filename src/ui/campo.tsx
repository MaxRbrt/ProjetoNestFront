import { useId, type InputHTMLAttributes } from 'react';

export interface PropsDoCampo extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
  ajuda?: string;
}

// ---------------------------------------------
// Campo
// Rótulo e input são ligados por um id gerado com useId (a não ser que o
// consumidor informe o seu), e o erro marca aria-invalid além de ficar preso
// ao campo por aria-describedby — assim o leitor de tela anuncia o problema
// junto com o campo, não só a cor muda. Quando há erro, ele substitui a ajuda
// na descrição em vez de anunciar as duas.
// ---------------------------------------------
export function Campo({
  rotulo,
  erro,
  ajuda,
  id,
  className = '',
  ...resto
}: PropsDoCampo) {
  const idGerado = useId();
  const idDoCampo = id ?? idGerado;
  const idDoErro = `${idDoCampo}-erro`;
  const idDaAjuda = `${idDoCampo}-ajuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idDoCampo} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <input
        {...resto}
        id={idDoCampo}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={erro ? idDoErro : ajuda ? idDaAjuda : undefined}
        className={`h-11 rounded-card border bg-superficie px-3.5 text-[0.95rem] text-tinta placeholder:text-tinta-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:bg-superficie-sutil disabled:text-tinta-suave ${erro ? 'border-erro' : 'border-borda-forte'} ${className}`}
      />
      {erro ? (
        <span id={idDoErro} className="text-sm text-erro">
          {erro}
        </span>
      ) : ajuda ? (
        <span id={idDaAjuda} className="text-sm text-tinta-suave">
          {ajuda}
        </span>
      ) : null}
    </div>
  );
}
