import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import {
  buscarMetricas,
  type MetricasDoPainel,
  type PeriodoDoPainel,
} from '../api/metricas';

interface ResultadoDeMetricas {
  metricas: MetricasDoPainel | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

interface Resposta {
  chave: string;
  metricas: MetricasDoPainel | null;
  erro: string | null;
}

// ---------------------------------------------
// Métricas do dashboard admin
// Uma leitura por período. Trocar de período aborta a leitura anterior e a
// flag "cancelado" descarta qualquer resposta que chegue depois disso — a
// tela nunca recebe números de um período que não é o selecionado.
// "carregando" e "erro" são derivados da chave (período + tentativa) da
// última resposta, sem setState síncrono dentro do efeito; os últimos
// números recebidos continuam disponíveis durante uma nova leitura.
// ---------------------------------------------
export function useMetricasAdmin(
  cliente: ApiClient,
  periodo: PeriodoDoPainel,
): ResultadoDeMetricas {
  const [tentativa, setTentativa] = useState(0);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const chave = `${periodo}:${tentativa}`;

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    buscarMetricas(cliente, periodo, controlador.signal)
      .then((metricas) => {
        if (!cancelado) setResposta({ chave, metricas, erro: null });
      })
      .catch(() => {
        if (!cancelado) {
          setResposta({
            chave,
            metricas: null,
            erro: 'Não foi possível carregar os indicadores.',
          });
        }
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, periodo, chave]);

  const atual = resposta?.chave === chave;

  return {
    metricas: resposta?.metricas ?? null,
    carregando: !atual,
    erro: atual ? (resposta?.erro ?? null) : null,
    recarregar: () => setTentativa((valor) => valor + 1),
  };
}
