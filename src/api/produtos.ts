import type { ApiClient } from './cliente';

export interface Produto {
  id: number;
  nome: string;
  preco: number;
  estoque: number;
  categoriaId: number;
}

export interface Categoria {
  id: number;
  nome: string;
}

export interface Paginado<T> {
  dados: T[];
  total: number;
  pagina: number;
  limite: number;
}

export interface FiltroDeProdutos {
  categoria: number | null;
  busca: string;
  pagina: number;
}

const CATEGORIA_PADRAO = null;
const BUSCA_PADRAO = '';
const PAGINA_PADRAO = 1;
const LIMITE_MAXIMO_DA_API = 100;

// ---------------------------------------------
// Listagem paginada de produtos
// ---------------------------------------------
export function listarProdutos(
  cliente: ApiClient,
  filtro: FiltroDeProdutos,
  signal: AbortSignal,
): Promise<Paginado<Produto>> {
  const parametros = new URLSearchParams();
  parametros.set('pagina', String(filtro.pagina));
  if (filtro.categoria !== null) {
    parametros.set('categoriaId', String(filtro.categoria));
  }
  if (filtro.busca) {
    parametros.set('nome', filtro.busca);
  }
  return cliente.get<Paginado<Produto>>(`/products?${parametros.toString()}`, {
    signal,
  });
}

// ---------------------------------------------
// Consulta de produto por identificador
// ---------------------------------------------
export function buscarProduto(
  cliente: ApiClient,
  id: number,
  signal: AbortSignal,
): Promise<Produto> {
  return cliente.get<Produto>(`/products/${id}`, { signal });
}

// ---------------------------------------------
// Listagem de categorias para o filtro
// Pede o teto de itens numa página só: o dropdown de filtro precisa de
// todas as categorias de uma vez, não faz sentido paginar uma lista de
// filtro. Se um dia existirem mais de 100 categorias, esta função para de
// cobrir todas — aceito por ora, YAGNI para um catálogo deste tamanho.
// ---------------------------------------------
export async function listarCategorias(
  cliente: ApiClient,
  signal: AbortSignal,
): Promise<Categoria[]> {
  const resultado = await cliente.get<Paginado<Categoria>>(
    `/categories?limite=${LIMITE_MAXIMO_DA_API}`,
    { signal },
  );
  return resultado.dados;
}

// ---------------------------------------------
// Leitura do filtro a partir da URL
// Página inválida ou ausente sempre vira 1: um link editado à mão não pode
// pedir uma página fora do intervalo que a interface sabe desenhar.
// Categoria: qualquer número finito válido (incluindo 0), invalida vira null.
// Usa Number.isFinite em vez de checagem falsy para não descartar categoria=0.
// ---------------------------------------------
export function filtroDaUrl(parametros: URLSearchParams): FiltroDeProdutos {
  const categoriaBruta = parametros.get('categoria');
  const categoriaConvertida = categoriaBruta ? Number(categoriaBruta) : NaN;
  const categoria = Number.isFinite(categoriaConvertida)
    ? categoriaConvertida
    : CATEGORIA_PADRAO;

  const paginaBruta = Number(parametros.get('pagina'));
  const pagina =
    Number.isInteger(paginaBruta) && paginaBruta >= 1
      ? paginaBruta
      : PAGINA_PADRAO;

  return {
    categoria,
    busca: parametros.get('busca') ?? BUSCA_PADRAO,
    pagina,
  };
}

// ---------------------------------------------
// Escrita do filtro de volta para a URL
// Só grava o que diverge do padrão: URL limpa quando não há filtro nenhum,
// em vez de sempre carregar ?categoria=&busca=&pagina=1 visível.
// ---------------------------------------------
export function urlDoFiltro(filtro: FiltroDeProdutos): URLSearchParams {
  const parametros = new URLSearchParams();
  if (filtro.categoria !== null) {
    parametros.set('categoria', String(filtro.categoria));
  }
  if (filtro.busca) {
    parametros.set('busca', filtro.busca);
  }
  if (filtro.pagina !== PAGINA_PADRAO) {
    parametros.set('pagina', String(filtro.pagina));
  }
  return parametros;
}
