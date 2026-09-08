import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import { listarCategorias } from '../api/produtos';
import type { Categoria } from '../api/produtos';

interface ResultadoDeCategorias {
  categorias: Categoria[];
  carregando: boolean;
}

// ---------------------------------------------
// Categorias disponíveis para o filtro
// Uma falha mantém a lista vazia sem bloquear a vitrine: a busca por nome
// continua utilizável mesmo quando o filtro secundário não carrega.
// ---------------------------------------------
export function useCategorias(
  cliente: ApiClient,
): ResultadoDeCategorias {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    listarCategorias(cliente, controlador.signal)
      .then((resultado) => {
        if (cancelado) return;
        setCategorias(resultado);
        setCarregando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente]);

  return { categorias, carregando };
}
