import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import { ApiError } from '../api/cliente';
import { consultarFrete, type OpcaoDeFrete } from '../api/frete';
import type { ItemDoCarrinho } from '../auth/contexto-do-carrinho';

interface ResultadoDaCotacao {
  opcoesDeFrete: OpcaoDeFrete[];
  carregandoFrete: boolean;
  erroDeFrete: string | null;
  modalidadeSelecionada: string | null;
  selecionarModalidade: (modalidade: string) => void;
}

// ---------------------------------------------
// Cotação de frete
// Depende do endereço (região) e da quantidade total de itens do carrinho —
// não dispara antes de haver as duas coisas. Ao trocar de endereço, a
// modalidade escolhida é resetada: o custo daquela modalidade era para o
// endereço anterior, e mantê-la selecionada mostraria um preço que não é
// mais o real até a nova cotação chegar.
// ---------------------------------------------
export function useCotacaoDeFrete(
  cliente: ApiClient,
  enderecoSelecionadoId: number | null,
  itens: ItemDoCarrinho[],
): ResultadoDaCotacao {
  const [opcoesDeFrete, setOpcoesDeFrete] = useState<OpcaoDeFrete[]>([]);
  const [carregandoFrete, setCarregandoFrete] = useState(false);
  const [erroDeFrete, setErroDeFrete] = useState<string | null>(null);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!enderecoSelecionadoId || itens.length === 0) {
      setOpcoesDeFrete([]);
      setModalidadeSelecionada(null);
      return;
    }

    const controlador = new AbortController();
    let cancelado = false;
    setCarregandoFrete(true);
    setErroDeFrete(null);
    setModalidadeSelecionada(null);

    consultarFrete(
      cliente,
      enderecoSelecionadoId,
      itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
      })),
      controlador.signal,
    )
      .then((opcoes) => {
        if (cancelado) return;
        setOpcoesDeFrete(opcoes);
        setModalidadeSelecionada(opcoes[0]?.modalidade ?? null);
        setCarregandoFrete(false);
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') {
          return;
        }
        setErroDeFrete(
          falha instanceof ApiError
            ? falha.message
            : 'Não foi possível calcular o frete agora.',
        );
        setCarregandoFrete(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, enderecoSelecionadoId, itens]);

  return {
    opcoesDeFrete,
    carregandoFrete,
    erroDeFrete,
    modalidadeSelecionada,
    selecionarModalidade: setModalidadeSelecionada,
  };
}
