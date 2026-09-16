import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { Aviso, Esqueleto } from '../../ui/indice';
import { useMetricasAdmin } from '../../hooks/use-metricas-admin';

interface PropsDaTela {
  cliente: ApiClient;
}

const CARTOES = [
  { chave: 'totalDeProdutos', rotulo: 'Produtos', para: '/admin/produtos' },
  {
    chave: 'totalDeCategorias',
    rotulo: 'Categorias',
    para: '/admin/categorias',
  },
  { chave: 'totalDePedidos', rotulo: 'Pedidos', para: '/admin/pedidos' },
] as const;

// ---------------------------------------------
// Dashboard do painel admin
// Três indicadores reais, sem gráfico nem dado inventado: é o que dá para
// montar sem endpoint novo no backend. Cada cartão linka para a lista que o
// número resume.
// ---------------------------------------------
export function TelaDeDashboardAdmin({ cliente }: PropsDaTela) {
  const { metricas, carregando, erro } = useMetricasAdmin(cliente);

  return (
    <div>
      <h1 className="text-balance text-2xl font-bold text-tinta">Painel administrativo</h1>

      {erro ? (
        <div className="mt-4">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}

      {!erro && carregando ? (
        <div
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
          role="status"
        >
          <span className="sr-only">Carregando métricas…</span>
          <Esqueleto className="h-28" />
          <Esqueleto className="h-28" />
          <Esqueleto className="h-28" />
        </div>
      ) : null}

      {!erro && metricas ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CARTOES.map((cartao) => (
            <Link
              key={cartao.chave}
              to={cartao.para}
              className="flex flex-col gap-2 rounded-card border border-borda bg-superficie p-6 shadow-carta transition-shadow hover:shadow-carta-media focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
            >
              <span className="text-3xl font-bold tabular-nums text-tinta">
                {metricas[cartao.chave]}
              </span>
              <span className="text-sm font-medium text-tinta-media">
                {cartao.rotulo}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
