import type { ApiClient } from './cliente';
import type { Categoria, Produto } from './produtos';

export interface DadosDeProduto {
  nome: string;
  preco: number;
  categoriaId: number;
  estoque: number;
}

export interface DadosDeCategoria {
  nome: string;
}

// ---------------------------------------------
// Mutações de catálogo restritas a administrador
// Separado de products.ts (só leitura, usado pela vitrine pública) porque é
// uma responsabilidade distinta: escrita admin-only, com erros que a vitrine
// nunca precisa tratar (400 de validação, 409 de dependência ao remover).
// ---------------------------------------------
export function criarProduto(
  cliente: ApiClient,
  dados: DadosDeProduto,
): Promise<Produto> {
  return cliente.post<Produto>('/products', dados);
}

export function atualizarProduto(
  cliente: ApiClient,
  id: number,
  dados: Partial<DadosDeProduto>,
): Promise<Produto> {
  return cliente.patch<Produto>(`/products/${id}`, dados);
}

export function removerProduto(cliente: ApiClient, id: number): Promise<void> {
  return cliente.delete<void>(`/products/${id}`);
}

export function buscarCategoria(
  cliente: ApiClient,
  id: number,
  signal: AbortSignal,
): Promise<Categoria> {
  return cliente.get<Categoria>(`/categories/${id}`, { signal });
}

export function criarCategoria(
  cliente: ApiClient,
  dados: DadosDeCategoria,
): Promise<Categoria> {
  return cliente.post<Categoria>('/categories', dados);
}

export function atualizarCategoria(
  cliente: ApiClient,
  id: number,
  dados: Partial<DadosDeCategoria>,
): Promise<Categoria> {
  return cliente.patch<Categoria>(`/categories/${id}`, dados);
}

export function removerCategoria(
  cliente: ApiClient,
  id: number,
): Promise<void> {
  return cliente.delete<void>(`/categories/${id}`);
}
