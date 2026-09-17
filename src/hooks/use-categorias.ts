import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import { listarCategorias } from '../api/produtos';
import type { Categoria } from '../api/produtos';

interface ResultadoDeCategorias {
  categorias: Categoria[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// ---------------------------------------------
// Categorias disponíveis para o filtro
// Uma falha mantém a lista vazia sem bloquear a vitrine: a busca por nome
// continua utilizável mesmo quando o filtro secundário não carrega.
// ---------------------------------------------
export function useCategorias(cliente: ApiClient): ResultadoDeCategorias {
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<{
    cliente: ApiClient;
    tentativa: number;
    categorias: Categoria[];
    erro: string | null;
  } | null>(null);
  const recarregar = useCallback(() => setTentativa((atual) => atual + 1), []);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    listarCategorias(cliente, controlador.signal)
      .then((categorias) => {
        if (cancelado) return;
        setResultado({ cliente, tentativa, categorias, erro: null });
      })
      .catch(() => {
        if (cancelado) return;
        setResultado({
          cliente,
          tentativa,
          categorias: [],
          erro: 'Não foi possível carregar as categorias.',
        });
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, tentativa]);

  const atual =
    resultado?.cliente === cliente && resultado.tentativa === tentativa
      ? resultado
      : null;
  return {
    categorias: atual?.categorias ?? [],
    carregando: !atual,
    erro: atual?.erro ?? null,
    recarregar,
  };
}
