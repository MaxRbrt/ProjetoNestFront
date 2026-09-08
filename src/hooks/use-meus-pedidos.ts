import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import type { Paginado } from '../api/produtos';
import { listarPedidos } from '../api/pedidos';
import type { Pedido } from '../api/pedidos';

interface ResultadoDeMeusPedidos {
  pedidos: Paginado<Pedido> | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// ---------------------------------------------
// Listagem paginada dos próprios pedidos
// O backend já filtra por dono; este hook só cuida de paginação e
// cancelamento, mesmo padrão dos demais hooks de listagem do projeto.
// ---------------------------------------------
export function useMeusPedidos(
  cliente: ApiClient,
  pagina: number,
): ResultadoDeMeusPedidos {
  const [pedidos, setPedidos] = useState<Paginado<Pedido> | null>(null);
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

    listarPedidos(cliente, pagina, controlador.signal)
      .then((resultado) => {
        if (cancelado) return;
        setPedidos(resultado);
        setErro(null);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') {
          return;
        }
        setErro('Não foi possível carregar seus pedidos.');
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, pagina, tentativa]);

  return { pedidos, carregando, erro, recarregar };
}
