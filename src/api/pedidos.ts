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
// Listagem paginada dos próprios pedidos
// O backend já filtra por dono automaticamente — nenhum parâmetro extra além
// da página é necessário para o cliente ver só o que é seu.
// ---------------------------------------------
export function listarPedidos(
  cliente: ApiClient,
  pagina: number,
  signal: AbortSignal,
): Promise<Paginado<Pedido>> {
  return cliente.get<Paginado<Pedido>>(`/orders?pagina=${pagina}`, {
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
export function cancelarPedido(cliente: ApiClient, id: number): Promise<Pedido> {
  return cliente.patch<Pedido>(`/orders/${id}/status`, {
    situacao: 'CANCELADO',
  });
}
