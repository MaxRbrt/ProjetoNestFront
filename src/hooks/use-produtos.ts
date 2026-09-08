import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/cliente';
import type { ApiClient } from '../api/cliente';
import { listarProdutos } from '../api/produtos';
import type { FiltroDeProdutos, Paginado, Produto } from '../api/produtos';

interface ResultadoDeProdutos {
  produtos: Paginado<Produto> | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// ---------------------------------------------
// Listagem de produtos com cancelamento e debounce
// Cada mudança de filtro cancela a requisição anterior antes de disparar a
// nova: sem isso, uma resposta lenta do filtro antigo poderia chegar depois
// da resposta do filtro novo e sobrescrever o resultado com dado
// desatualizado — mesma corrida já resolvida para a sessão nesta aplicação.
// A busca por texto tem 300ms de debounce embutido no efeito, para não
// disparar uma requisição a cada tecla; os demais campos do filtro (página,
// categoria) disparam na hora.
// ---------------------------------------------
export function useProdutos(
  cliente: ApiClient,
  filtro: FiltroDeProdutos,
): ResultadoDeProdutos {
  const [produtos, setProdutos] = useState<Paginado<Produto> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const { categoria, busca, pagina } = filtro;
  const recarregar = useCallback(() => {
    setTentativa((atual) => atual + 1);
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;
    const filtroAtual = { categoria, busca, pagina };

    setCarregando(true);
    setErro(null);

    const temporizador = setTimeout(
      () => {
        listarProdutos(cliente, filtroAtual, controlador.signal)
          .then((resultado) => {
            if (cancelado) return;
            setProdutos(resultado);
            setCarregando(false);
          })
          .catch((falha: unknown) => {
            if (cancelado) return;
            if (falha instanceof DOMException && falha.name === 'AbortError') {
              return;
            }
            setErro(
              falha instanceof ApiError
                ? falha.message
                : 'Não foi possível carregar os produtos.',
            );
            setCarregando(false);
          });
      },
      busca ? 300 : 0,
    );

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [cliente, categoria, busca, pagina, tentativa]);

  return { produtos, carregando, erro, recarregar };
}
