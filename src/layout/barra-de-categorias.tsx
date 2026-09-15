import { Link } from 'react-router-dom';
import type { ApiClient } from '../api/cliente';
import { useCategorias } from '../hooks/use-categorias';

interface PropsDaBarra {
  cliente: ApiClient;
}

// ---------------------------------------------
// Barra de categorias
// Só aparece em telas largas (a versão mobile entra pelo menu lateral) e só
// lista categorias reais do backend — nenhuma categoria fixa ou de exemplo:
// enquanto useCategorias ainda carrega ou falha, a barra fica vazia em vez
// de inventar uma lista.
// ---------------------------------------------
export function BarraDeCategorias({ cliente }: PropsDaBarra) {
  const { categorias } = useCategorias(cliente);

  if (categorias.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Categorias" className="hidden bg-marca-clara lg:block">
      <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8">
        {categorias.map((categoria) => (
          <Link
            key={categoria.id}
            to={`/produtos?categoria=${categoria.id}`}
            className="whitespace-nowrap text-sm font-medium text-white/85 hover:text-white"
          >
            {categoria.nome}
          </Link>
        ))}
      </div>
    </nav>
  );
}
