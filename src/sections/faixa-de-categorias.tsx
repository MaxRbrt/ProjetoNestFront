import { Link } from 'react-router-dom';
import type { ApiClient } from '../api/cliente';
import { useCategorias } from '../hooks/use-categorias';

// ---------------------------------------------
// Categorias reais da loja
// Mantém o destino da âncora mesmo sem dados; a lista não inventa opções
// quando a API falha ou ainda não há categorias cadastradas.
// ---------------------------------------------
export function FaixaDeCategorias({ cliente }: { cliente: ApiClient }) {
  const { categorias, carregando } = useCategorias(cliente);
  return (
    <section
      id="categorias"
      aria-labelledby="titulo-categorias"
      className="flex min-w-0 scroll-mt-6 flex-col gap-5"
    >
      <h2
        id="titulo-categorias"
        className="text-xl font-bold tracking-tight text-tinta sm:text-2xl"
      >
        Explore por categoria
      </h2>
      {carregando ? (
        <p role="status" className="text-sm text-tinta-media">
          Carregando categorias
        </p>
      ) : categorias.length === 0 ? (
        <p className="text-sm text-tinta-media">
          Nenhuma categoria disponível no momento. Explore o catálogo completo.
        </p>
      ) : (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-1 pb-3">
          {categorias.map((categoria) => (
            <Link
              key={categoria.id}
              to={`/produtos?${new URLSearchParams({ categoria: String(categoria.id) })}`}
              className="flex min-h-20 w-48 shrink-0 snap-start items-center gap-3 rounded-card border border-borda bg-superficie px-4 py-3 text-tinta shadow-carta hover:border-marca focus-visible:outline-2 focus-visible:outline-acento"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pequeno bg-fundo font-bold text-marca"
              >
                {categoria.nome.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 text-sm font-semibold break-words">
                {categoria.nome}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
