import type { ApiClient } from '../../api/cliente';
import { Aviso } from '../../components/primitivos';
import { useMetricasAdmin } from '../../hooks/use-metricas-admin';
import './tela-de-dashboard-admin.css';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Dashboard do painel admin
// Três indicadores simples, sem gráfico: é o que dá para montar sem
// endpoint novo no backend. Pedidos pendentes e outras métricas mais ricas
// dependem de um filtro de status que ainda não existe na API.
// ---------------------------------------------
export function TelaDeDashboardAdmin({ cliente }: PropsDaTela) {
  const { metricas, carregando, erro } = useMetricasAdmin(cliente);

  return (
    <div>
      <h1>Painel administrativo</h1>

      {erro ? <Aviso>{erro}</Aviso> : null}

      {!erro && carregando ? (
        <p role="status">Carregando métricas…</p>
      ) : null}

      {!erro && metricas ? (
        <div className="painel-metricas">
          <div className="painel-metricas__cartao">
            <span className="painel-metricas__numero">
              {metricas.totalDeProdutos}
            </span>
            <span className="painel-metricas__rotulo">Produtos</span>
          </div>
          <div className="painel-metricas__cartao">
            <span className="painel-metricas__numero">
              {metricas.totalDeCategorias}
            </span>
            <span className="painel-metricas__rotulo">Categorias</span>
          </div>
          <div className="painel-metricas__cartao">
            <span className="painel-metricas__numero">
              {metricas.totalDePedidos}
            </span>
            <span className="painel-metricas__rotulo">Pedidos</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
