import type { ApiClient } from './cliente';

export type SituacaoDoPagamento = 'PENDENTE' | 'APROVADO' | 'RECUSADO';

export interface Pagamento {
  id: number;
  pedidoId: number;
  status: SituacaoDoPagamento;
  ultimosDigitosDoCartao: string;
  motivoDeRecusa: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

// ---------------------------------------------
// Início de pagamento
// Provedor simulado (ver CLAUDE.md do backend): resolve na hora, sem
// intervenção do usuário depois de enviar o cartão. Cartão terminado em
// 0002 é o "cartão de teste" que sempre recusa.
// ---------------------------------------------
export function iniciarPagamento(
  cliente: ApiClient,
  pedidoId: number,
  numeroDoCartao: string,
): Promise<Pagamento> {
  return cliente.post<Pagamento>(`/orders/${pedidoId}/payments`, {
    numeroDoCartao,
  });
}

export function listarPagamentos(
  cliente: ApiClient,
  pedidoId: number,
  signal?: AbortSignal,
): Promise<Pagamento[]> {
  return cliente.get<Pagamento[]>(`/orders/${pedidoId}/payments`, { signal });
}
