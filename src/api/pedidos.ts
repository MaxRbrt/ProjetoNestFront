import type { ApiClient } from './cliente';
import type { Paginado } from './produtos';

export interface ItemDoPedido {
  id: number;
  quantidade: number;
  pedidoId: number;
  produtoId: number;
  nomeDoProduto: string;
  precoUnitario: number;
}

export type SituacaoDoPedido = 'PENDENTE' | 'PAGO' | 'CANCELADO';

export interface Pedido {
  id: number;
  total: number;
  criadoEm: string;
  itens: ItemDoPedido[];
  situacao: SituacaoDoPedido;
  usuarioId: string;
  chaveDeIdempotencia: string | null;
  hashDoPayload: string | null;
}

export interface ItemParaCriarPedido {
  produtoId: number;
  quantidade: number;
}

// ---------------------------------------------
// Criação de pedido com idempotência
// A chave vai no cabeçalho HTTP Idempotency-Key, não no corpo: é o contrato
// que o backend já implementa (índice único por usuário e chave). Retry de
// rede com a mesma chave devolve o pedido já criado em vez de duplicar.
// ---------------------------------------------
export function criarPedido(
  cliente: ApiClient,
  itens: ItemParaCriarPedido[],
  chaveDeIdempotencia: string,
): Promise<Pedido> {
  return cliente.post<Pedido>(
    '/orders',
    { itens },
    { cabecalhos: { 'Idempotency-Key': chaveDeIdempotencia } },
  );
}

// ---------------------------------------------
// Listagem paginada dos pedidos visíveis à sessão
// O backend filtra por dono para cliente e permite todos para administrador.
// Situação é opcional para preservar os consumidores sem filtro.
// ---------------------------------------------
export function listarPedidos(
  cliente: ApiClient,
  pagina: number,
  signal: AbortSignal,
  situacao?: SituacaoDoPedido,
): Promise<Paginado<Pedido>> {
  const consulta = new URLSearchParams({ pagina: String(pagina) });
  if (situacao) consulta.set('situacao', situacao);
  return cliente.get<Paginado<Pedido>>(`/orders?${consulta}`, {
    signal,
  });
}

// ---------------------------------------------
// Consulta de pedido por identificador
// ---------------------------------------------
export function buscarPedido(
  cliente: ApiClient,
  id: number,
  signal: AbortSignal,
): Promise<Pedido> {
  return cliente.get<Pedido>(`/orders/${id}`, { signal });
}

// ---------------------------------------------
// Cancelamento de pedido pendente
// Sem AbortSignal de propósito: é uma ação de escrita disparada por clique,
// não uma busca que a troca de tela deva cancelar.
// ---------------------------------------------
export function cancelarPedido(
  cliente: ApiClient,
  id: number,
): Promise<Pedido> {
  return atualizarSituacaoDoPedido(cliente, id, 'CANCELADO');
}

// ---------------------------------------------
// Transição de situação
// O servidor decide permissões e estado de origem sob lock. A interface
// nunca reenvia automaticamente uma escrita cuja resposta foi perdida.
// ---------------------------------------------
export function atualizarSituacaoDoPedido(
  cliente: ApiClient,
  id: number,
  situacao: Exclude<SituacaoDoPedido, 'PENDENTE'>,
): Promise<Pedido> {
  return cliente.patch<Pedido>(`/orders/${id}/status`, { situacao });
}
