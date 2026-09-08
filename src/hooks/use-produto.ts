import { useEffect, useState } from 'react';
import { ApiError } from '../api/cliente';
import type { ApiClient } from '../api/cliente';
import { buscarProduto } from '../api/produtos';
import type { Produto } from '../api/produtos';

interface ResultadoDeProduto {
  produto: Produto | null;
  carregando: boolean;
  erro: string | null;
}

// ---------------------------------------------
// Consulta de um produto por identificador
// Cada troca de id cancela a chamada anterior e impede que uma resposta
// obsoleta substitua o produto da rota atual.
// ---------------------------------------------
export function useProduto(cliente: ApiClient, id: number): ResultadoDeProduto {
  const [produto, setProduto] = useState<Produto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) {
      setProduto(null);
      setErro('Produto inválido.');
      setCarregando(false);
      return;
    }

    const controlador = new AbortController();
    let cancelado = false;

    setCarregando(true);
    setErro(null);

    buscarProduto(cliente, id, controlador.signal)
      .then((resultado) => {
        if (cancelado) return;
        setProduto(resultado);
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
            : 'Não foi possível carregar o produto.',
        );
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, id]);

  return { produto, carregando, erro };
}
