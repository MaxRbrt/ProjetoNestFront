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
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={idDoCampo} className="text-lg font-semibold text-tinta">
        {rotulo}
      </label>
      <input
        {...resto}
        id={idDoCampo}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={erro ? idDoErro : ajuda ? idDaAjuda : undefined}
        className={`min-h-13 w-full min-w-0 rounded-card border bg-superficie px-3.5 text-lg text-tinta placeholder:text-tinta-media focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca disabled:cursor-not-allowed disabled:bg-superficie-sutil disabled:text-tinta-suave ${erro ? 'border-erro' : 'border-borda-forte'} ${className}`}
      />
      {erro ? (
        <span id={idDoErro} className="text-base text-erro">
          {erro}
        </span>
      ) : ajuda ? (
        <span id={idDaAjuda} className="text-base text-tinta-media">
          {ajuda}
        </span>
      ) : null}
    </div>
  );
}
