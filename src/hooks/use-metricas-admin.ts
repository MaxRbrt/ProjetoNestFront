import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import type { Paginado } from '../api/produtos';

export interface Metricas {
  totalDeProdutos: number;
  totalDeCategorias: number;
  totalDePedidos: number;
}

interface ResultadoDeMetricas {
  metricas: Metricas | null;
  carregando: boolean;
  erro: string | null;
}

// ---------------------------------------------
// Métricas do dashboard admin
// Os três totais vêm de graça do envelope de paginação que cada listagem já
// devolve: pedir limit=1 evita baixar os dados, só o campo total interessa
// aqui. Sem endpoint novo no backend — é o que dá para mostrar sem mexer
// no outro repositório.
// ---------------------------------------------
export function useMetricasAdmin(cliente: ApiClient): ResultadoDeMetricas {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    Promise.all([
      cliente.get<Paginado<unknown>>('/products?limite=1', {
        signal: controlador.signal,
      }),
      cliente.get<Paginado<unknown>>('/categories?limite=1', {
        signal: controlador.signal,
      }),
      cliente.get<Paginado<unknown>>('/orders?limite=1', {
        signal: controlador.signal,
      }),
    ])
      .then(([produtos, categorias, pedidos]) => {
        if (cancelado) return;
        setMetricas({
          totalDeProdutos: produtos.total,
          totalDeCategorias: categorias.total,
          totalDePedidos: pedidos.total,
        });
        setCarregando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErro('Não foi possível carregar as métricas do painel.');
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente]);

  return { metricas, carregando, erro };
}
