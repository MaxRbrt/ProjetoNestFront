import type { ApiClient } from './cliente';

export const PERIODOS_DO_PAINEL = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
  { valor: '90d', rotulo: '90 dias' },
] as const;

export type PeriodoDoPainel = (typeof PERIODOS_DO_PAINEL)[number]['valor'];

export interface Comparacao<T> {
  atual: T;
  anterior: T;
}

export interface VendasDoDia {
  dia: string;
  faturamentoEmCentavos: number;
  pedidos: number;
}

export interface MetricasDoPainel {
  periodo: PeriodoDoPainel;
  fuso: string;
  janela: { inicio: string; fim: string };
  resumo: {
    faturamentoEmCentavos: Comparacao<number>;
    pedidos: Comparacao<number>;
    ticketMedioEmCentavos: Comparacao<number>;
    taxaDeRecusa: Comparacao<number | null>;
  };
  vendasPorDia: VendasDoDia[];
}

export function ehPeriodoDoPainel(valor: string | null): valor is PeriodoDoPainel {
  return PERIODOS_DO_PAINEL.some((periodo) => periodo.valor === valor);
}

// ---------------------------------------------
// Indicadores do painel administrativo
// Endpoint só leitura e só ADMIN (GET /admin/metricas). "anterior" é o mesmo
// trecho do ciclo deslocado para trás; a variação é calculada na tela.
// ---------------------------------------------
export function buscarMetricas(
  cliente: ApiClient,
  periodo: PeriodoDoPainel,
  signal: AbortSignal,
): Promise<MetricasDoPainel> {
  return cliente.get<MetricasDoPainel>(
    `/admin/metricas?${new URLSearchParams({ periodo })}`,
    { signal },
  );
}
