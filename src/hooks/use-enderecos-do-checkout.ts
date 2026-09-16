import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import { listarEnderecos, type Endereco } from '../api/enderecos';

interface ResultadoDosEnderecos {
  enderecos: Endereco[];
  carregando: boolean;
  enderecoSelecionadoId: number | null;
  selecionarEndereco: (id: number) => void;
}

// ---------------------------------------------
// Endereços disponíveis para o checkout
// Pré-seleciona o principal (a API já devolve a lista com ele primeiro).
// Sem endereço nenhum, o chamador bloqueia o botão de finalizar — pedido sem
// destino de entrega não existe mais neste projeto.
// ---------------------------------------------
export function useEnderecosDoCheckout(
  cliente: ApiClient,
): ResultadoDosEnderecos {
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<
    number | null
  >(null);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    listarEnderecos(cliente, controlador.signal)
      .then((lista) => {
        if (cancelado) return;
        setEnderecos(lista);
        setEnderecoSelecionadoId((atual) => atual ?? lista[0]?.id ?? null);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') {
          return;
        }
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente]);

  return {
    enderecos,
    carregando,
    enderecoSelecionadoId,
    selecionarEndereco: setEnderecoSelecionadoId,
  };
}
