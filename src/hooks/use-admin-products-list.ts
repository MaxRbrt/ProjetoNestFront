import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../api/client';
import { listarProdutos } from '../api/products';
import type { Paginado, Produto } from '../api/products';

interface ResultadoDaListaAdmin {
  produtos: Paginado<Produto> | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// ---------------------------------------------
// Listagem de produtos para o painel admin
// Sem busca nem filtro de categoria — o painel só precisa navegar pelas
// páginas para editar ou remover; a busca fica na vitrine pública, que já
// resolve isso em useProducts. categoria/busca ficam sempre vazios aqui.
// ---------------------------------------------
export function useAdminProductsList(
  cliente: ApiClient,
  pagina: number,
): ResultadoDaListaAdmin {
  const [produtos, setProdutos] = useState<Paginado<Produto> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const recarregar = useCallback(() => {
    setTentativa((atual) => atual + 1);
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;
    setCarregando(true);

    listarProdutos(
      cliente,
      { categoria: null, busca: '', pagina },
      controlador.signal,
    )
      .then((resultado) => {
        if (cancelado) return;
        setProdutos(resultado);
        setErro(null);
        setCarregando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErro('Não foi possível carregar os produtos.');
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, pagina, tentativa]);

  return { produtos, carregando, erro, recarregar };
}
