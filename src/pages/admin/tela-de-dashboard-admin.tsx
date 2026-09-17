import { Link, useSearchParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import {
  ehPeriodoDoPainel,
  PERIODOS_DO_PAINEL,
  type MetricasDoPainel,
  type PeriodoDoPainel,
} from '../../api/metricas';
import { useMetricasAdmin } from '../../hooks/use-metricas-admin';
import { Aviso, Botao, Cartao, Esqueleto } from '../../ui/indice';
import { formatarCentavos } from '../../utils/dinheiro';
import { calcularVariacao } from '../../utils/variacao';
import { CartaoDeIndicador } from './dashboard/cartao-de-indicador';
import { GraficoDeVendas } from './dashboard/grafico-de-vendas';
import { SeletorDePeriodo } from './dashboard/seletor-de-periodo';

interface PropsDaTela {
  cliente: ApiClient;
}

const PERIODO_PADRAO: PeriodoDoPainel = '7d';

const ATALHOS = [
  {
    para: '/admin/pedidos',
    rotulo: 'Pedidos',
    descricao: 'Acompanhar e atualizar situações',
  },
  {
    para: '/admin/produtos',
    rotulo: 'Produtos',
    descricao: 'Cadastrar, editar e ajustar estoque',
  },
  {
    para: '/admin/categorias',
    rotulo: 'Categorias',
    descricao: 'Organizar o catálogo',
  },
] as const;

const PORCENTAGEM = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

// ---------------------------------------------
// Dashboard do painel admin
// Indicadores de vendas de um único endpoint (GET /admin/metricas). O
// período vive na URL (?periodo=), então recarregar ou compartilhar o link
// mantém a mesma visão; valor desconhecido cai no padrão de 7 dias. Durante
// a troca, números de outro período não são exibidos — mostrar os de 7 dias
// sob o rótulo de 30 enganaria. Os atalhos para as áreas de gestão ficam abaixo, sem números próprios.
// ---------------------------------------------
export function TelaDeDashboardAdmin({ cliente }: PropsDaTela) {
  const [parametros, setParametros] = useSearchParams();
  const bruto = parametros.get('periodo');
  const periodo = ehPeriodoDoPainel(bruto) ? bruto : PERIODO_PADRAO;
  const { metricas, carregando, erro, recarregar } = useMetricasAdmin(
    cliente,
    periodo,
  );
  const rotuloDoPeriodo =
    PERIODOS_DO_PAINEL.find((p) => p.valor === periodo)?.rotulo ?? '';
  const exibidas = metricas?.periodo === periodo ? metricas : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-tinta">
            Painel administrativo
          </h1>
          <p className="text-lg text-tinta-media">
            Vendas da loja —{' '}
            {periodo === 'hoje'
              ? 'hoje, comparadas a ontem no mesmo horário'
              : `últimos ${rotuloDoPeriodo}, comparados ao período anterior`}
            .
          </p>
        </div>
        <SeletorDePeriodo
          periodo={periodo}
          aoMudar={(novo) => {
            const proximos = new URLSearchParams(parametros);
            proximos.set('periodo', novo);
            setParametros(proximos, { replace: true });
          }}
        />
      </div>

      {erro ? (
        <div className="flex flex-col items-start gap-4">
          <Aviso tipo="erro">{erro}</Aviso>
          <Botao variante="secundario" onClick={recarregar}>
            Tentar novamente
          </Botao>
        </div>
      ) : exibidas ? (
        <ConteudoDoPainel metricas={exibidas} atualizando={carregando} />
      ) : (
        <EsqueletoDoPainel />
      )}

      <nav aria-labelledby="atalhos-do-painel" className="flex flex-col gap-3">
        <h2 id="atalhos-do-painel" className="text-xl font-bold text-tinta">
          Gestão da loja
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ATALHOS.map((atalho) => (
            <li key={atalho.para}>
              <Link
                to={atalho.para}
                className="flex h-full min-h-12 flex-col gap-1 rounded-card border border-borda bg-superficie p-5 shadow-carta transition-[border-color,box-shadow] hover:border-borda-forte hover:shadow-carta-media focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                <span className="text-lg font-semibold text-tinta underline decoration-borda-forte underline-offset-4">
                  {atalho.rotulo}
                </span>
                <span className="text-base text-tinta-media">
                  {atalho.descricao}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

interface PropsDoConteudo {
  metricas: MetricasDoPainel;
  atualizando: boolean;
}

function ConteudoDoPainel({ metricas, atualizando }: PropsDoConteudo) {
  const { resumo, vendasPorDia } = metricas;
  const semVendas = vendasPorDia.every((dia) => dia.faturamentoEmCentavos === 0);
  const taxa = resumo.taxaDeRecusa.atual;

  return (
    <div
      aria-busy={atualizando}
      className={`flex flex-col gap-6 transition-opacity ${atualizando ? 'opacity-60' : ''}`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoDeIndicador
          titulo="Faturamento"
          valor={formatarCentavos(resumo.faturamentoEmCentavos.atual)}
          variacao={calcularVariacao(
            resumo.faturamentoEmCentavos.atual,
            resumo.faturamentoEmCentavos.anterior,
          )}
        />
        <CartaoDeIndicador
          titulo="Pedidos"
          valor={String(resumo.pedidos.atual)}
          variacao={calcularVariacao(
            resumo.pedidos.atual,
            resumo.pedidos.anterior,
          )}
        />
        <CartaoDeIndicador
          titulo="Ticket médio"
          valor={formatarCentavos(resumo.ticketMedioEmCentavos.atual)}
          variacao={calcularVariacao(
            resumo.ticketMedioEmCentavos.atual,
            resumo.ticketMedioEmCentavos.anterior,
          )}
        />
        <CartaoDeIndicador
          titulo="Pagamentos recusados"
          valor={taxa === null ? '—' : PORCENTAGEM.format(taxa)}
          variacao={calcularVariacao(
            taxa,
            resumo.taxaDeRecusa.anterior,
            'pontos',
          )}
          altaEhBoa={false}
        />
      </div>

      <Cartao como="section" aria-labelledby="titulo-vendas">
        <div className="mb-4 flex flex-col gap-1">
          <h2 id="titulo-vendas" className="text-xl font-bold text-tinta">
            Vendas por dia
          </h2>
          <p className="text-base text-tinta-media">
            Faturamento de pedidos pagos, enviados e entregues, pela data da
            compra.
          </p>
        </div>
        {semVendas ? (
          <p className="rounded-pequeno bg-superficie-sutil px-4 py-6 text-center text-lg text-tinta-media">
            Nenhuma venda neste período.
          </p>
        ) : (
          <GraficoDeVendas vendas={vendasPorDia} />
        )}
      </Cartao>
    </div>
  );
}

function EsqueletoDoPainel() {
  return (
    <div role="status" aria-label="Carregando indicadores" className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((indice) => (
          <Esqueleto key={indice} className="h-36" />
        ))}
      </div>
      <Esqueleto className="h-96" />
    </div>
  );
}
