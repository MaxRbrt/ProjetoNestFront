import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import { ApiError } from '../api/cliente';
import { listarEnderecos, type Endereco } from '../api/enderecos';

export interface ResultadoDosEnderecos {
  enderecos: Endereco[];
  carregando: boolean;
  erroDeCarga: string | null;
  recarregar: () => Promise<void>;
}

// ---------------------------------------------
// Lista de endereços do cliente
// Mesmo padrão de use-enderecos-do-checkout.ts e use-cotacao-de-frete.ts: a
// flag `cancelado` do fechamento do efeito é conferida nas três etapas
// (then/catch/finally) da leitura em voo, não só no catch. Sob StrictMode
// (montar/desmontar/montar) a primeira leitura é abortada, mas sua promessa
// ainda resolve ou rejeita depois — sem a checagem em cada etapa ela grava
// `carregando=false` e a lista vazia por cima do resultado da segunda leitura
// (ou após o componente já ter desmontado). `recarregar()` sem argumento —
// usada pelo chamador depois de criar/editar/remover/marcar principal — não
// tem `AbortController` próprio porque é uma ação pontual, não um efeito de
// leitura preso ao ciclo de vida do componente.
// ---------------------------------------------
export function useEnderecos(cliente: ApiClient): ResultadoDosEnderecos {
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);

  function carregar(
    signal?: AbortSignal,
    cancelado?: { valor: boolean },
  ): Promise<void> {
    setCarregando(true);
    setErroDeCarga(null);
    return listarEnderecos(cliente, signal)
      .then((lista) => {
        if (cancelado?.valor) return;
        setEnderecos(lista);
      })
      .catch((falha: unknown) => {
        if (cancelado?.valor) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') {
          return;
        }
        setErroDeCarga(
          falha instanceof ApiError
            ? falha.message
            : 'Não foi possível carregar seus endereços.',
        );
      })
      .finally(() => {
        if (cancelado?.valor) return;
        setCarregando(false);
      });
  }

  useEffect(() => {
    const controlador = new AbortController();
    const cancelado = { valor: false };
    void carregar(controlador.signal, cancelado);
    return () => {
      cancelado.valor = true;
      controlador.abort();
    };
  }, [cliente]);

  return {
    enderecos,
    carregando,
    erroDeCarga,
    recarregar: () => carregar(),
  };
}
