import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import { buscarProduto } from '../api/produtos';
import type { Produto } from '../api/produtos';
import type { ItemDoCarrinho } from '../auth/contexto-do-carrinho';

export interface LinhaDoCarrinho {
  produto: Produto;
  quantidade: number;
}

interface ResultadoDasLinhas {
  linhas: LinhaDoCarrinho[];
  carregando: boolean;
  erroDeCarga: string | null;
}

// ---------------------------------------------
// Linhas do carrinho a partir dos itens persistidos
// O contexto guarda só produtoId e quantidade; nome e preço são buscados de
// novo aqui para nunca exibir dado desatualizado. Promise.allSettled (não
// Promise.all) faz um produto removido do catálogo sumir da lista em vez de
// quebrar a tela inteira — o carrinho persistido não tem como saber que o
// produto sumiu até perguntar à API.
// ---------------------------------------------
export function useLinhasDoCarrinho(
  cliente: ApiClient,
  itens: ItemDoCarrinho[],
): ResultadoDasLinhas {
  const [linhas, setLinhas] = useState<LinhaDoCarrinho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);

  useEffect(() => {
    if (itens.length === 0) {
      setLinhas([]);
      setCarregando(false);
      setErroDeCarga(null);
      return;
    }

    const controlador = new AbortController();
    let cancelado = false;
    setCarregando(true);
    setErroDeCarga(null);

    Promise.allSettled(
      itens.map((item) =>
        buscarProduto(cliente, item.produtoId, controlador.signal).then(
          (produto) => ({ produto, quantidade: item.quantidade }),
        ),
      ),
    ).then((resultados) => {
      if (cancelado) return;
      const linhasCarregadas = resultados
        .filter(
          (resultado): resultado is PromiseFulfilledResult<LinhaDoCarrinho> =>
            resultado.status === 'fulfilled',
        )
        .map((resultado) => resultado.value);
      setLinhas(linhasCarregadas);
      setCarregando(false);
    });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, itens]);

  return { linhas, carregando, erroDeCarga };
}
