import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../api/cliente';
import { useVitrine } from '../hooks/use-vitrine';
import { GradeDeProdutos } from '../produtos/grade-de-produtos';

interface PropsDaVitrine {
  cliente: ApiClient;
  titulo: string;
  ordenarPor?: 'preco';
}

// ---------------------------------------------
// Vitrine independente
// Rótulo e link refletem a consulta real. Uma seção sem dados ou com falha
// some inteira; as demais leituras e o acesso ao catálogo continuam úteis.
// ---------------------------------------------
export function Vitrine({ cliente, titulo, ordenarPor }: PropsDaVitrine) {
  const idDoTitulo = useId();
  const { produtos, carregando, erro } = useVitrine(cliente, {
    ordenarPor,
    direcao: 'asc',
    limite: 8,
  });
  if (erro || (!carregando && produtos.length === 0)) return null;
  const destino = ordenarPor
    ? `/produtos?${new URLSearchParams({ ordenarPor, direcao: 'asc' })}`
    : '/produtos';
  return (
    <section aria-labelledby={idDoTitulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id={idDoTitulo}
          className="text-xl font-bold tracking-tight text-tinta sm:text-2xl"
        >
          {titulo}
        </h2>
        <Link
          to={destino}
          className="inline-flex min-h-12 items-center rounded-pequeno px-2 text-base font-semibold underline decoration-borda-forte underline-offset-4 hover:decoration-acento focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
        >
          Ver todos
        </Link>
      </div>
      <div
        role={carregando ? 'status' : undefined}
        aria-label={carregando ? `Carregando ${titulo}` : undefined}
      >
        <GradeDeProdutos
          produtos={produtos}
          carregando={carregando}
          quantidadeDeEsqueletos={8}
          largura="total"
        />
      </div>
    </section>
  );
}
