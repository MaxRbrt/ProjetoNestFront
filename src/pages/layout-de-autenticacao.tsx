import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PropsDoLayout {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}

// Uma coluna mantém a sequência de leitura dos formulários em todas as telas.
export function LayoutDeAutenticacao({
  titulo,
  subtitulo,
  children,
}: PropsDoLayout) {
  return (
    <div className="min-h-dvh bg-fundo">
      <header className="bg-marca px-4 py-5 text-white sm:px-6">
        <Link
          to="/"
          className="mx-auto flex min-h-12 max-w-5xl items-center gap-3 rounded-pequeno font-bold hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="rounded-pequeno bg-acento px-3 py-2 text-xl">
            NX
          </span>
          <span className="text-xl">Catálogo</span>
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/produtos"
          className="inline-flex min-h-12 items-center self-start rounded-pequeno text-lg font-semibold text-acento underline underline-offset-4 hover:text-acento-escuro focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento"
        >
          Voltar ao catálogo
        </Link>
        <div className="flex min-w-0 flex-col gap-7 rounded-card border border-borda bg-superficie p-5 sm:p-8">
          <div>
            <h1 className="text-balance text-3xl font-bold text-tinta">
              {titulo}
            </h1>
            {subtitulo ? (
              <p className="mt-3 text-lg leading-relaxed text-tinta-media">
                {subtitulo}
              </p>
            ) : null}
          </div>
          {children}
        </div>
        <p className="text-center text-base text-tinta-media">
          Loja de demonstração — compras simuladas.
        </p>
      </main>
    </div>
  );
}
