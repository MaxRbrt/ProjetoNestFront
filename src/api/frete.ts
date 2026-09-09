import type { ApiClient } from './cliente';
import type { ItemParaCriarPedido } from './pedidos';

export type ModalidadeDeFrete = 'PAC' | 'SEDEX';

export interface OpcaoDeFrete {
  modalidade: ModalidadeDeFrete;
  custoEmCentavos: number;
  prazoEmDiasUteis: number;
}

// ---------------------------------------------
// Cotação de frete
// Simulada no backend (não é integração com transportadora real) — ver
// CLAUDE.md do backend. O custo aqui é só para exibição antes da compra; o
// valor que realmente entra no pedido é recalculado no servidor na criação,
// a partir da modalidade escolhida, não deste retorno.
// ---------------------------------------------
export function consultarFrete(
  cliente: ApiClient,
  enderecoId: number,
  itens: ItemParaCriarPedido[],
  signal?: AbortSignal,
): Promise<OpcaoDeFrete[]> {
  return cliente.post<OpcaoDeFrete[]>(
    '/shipping/quote',
    { enderecoId, itens },
    { signal },
  );
}
