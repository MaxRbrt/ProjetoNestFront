import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './client';
import {
  buscarProduto,
  filtroDaUrl,
  listarCategorias,
  listarProdutos,
  urlDoFiltro,
  type FiltroDeProdutos,
} from './products';

function respostaJson(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Camada de dados de produtos', () => {
  // ---------------------------------------------
  // Montagem da query string
  // ---------------------------------------------
  it('monta a query string só com os filtros preenchidos', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({ data: [], total: 0, page: 1, limit: 20 }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    const filtro: FiltroDeProdutos = {
      categoria: 3,
      busca: 'caneca',
      pagina: 2,
    };

    await listarProdutos(cliente, filtro, new AbortController().signal);

    const urlChamada = String((fetchFalso.mock.calls[0] as unknown as [string])[0]);
    expect(urlChamada).toContain('categoryId=3');
    expect(urlChamada).toContain('name=caneca');
    expect(urlChamada).toContain('page=2');
  });

  it('omite categoria e busca da query string quando vazios', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({ data: [], total: 0, page: 1, limit: 20 }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    await listarProdutos(
      cliente,
      { categoria: null, busca: '', pagina: 1 },
      new AbortController().signal,
    );

    const urlChamada = String((fetchFalso.mock.calls[0] as unknown as [string])[0]);
    expect(urlChamada).not.toContain('categoryId');
    expect(urlChamada).not.toContain('name=');
  });

  it('busca um produto por id', async () => {
    const produto = { id: 5, name: 'Caneca', price: 20, stock: 3, categoryId: 1 };
    const fetchFalso = vi.fn(async () => respostaJson(produto));
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const resultado = await buscarProduto(cliente, 5, new AbortController().signal);

    expect(resultado).toEqual(produto);
    expect(String((fetchFalso.mock.calls[0] as unknown as [string])[0])).toContain('/products/5');
  });

  it('lista categorias pedindo o teto de itens por página', async () => {
    const categorias = [{ id: 1, name: 'Bebidas' }];
    const fetchFalso = vi.fn(async () =>
      respostaJson({ data: categorias, total: 1, page: 1, limit: 100 }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const resultado = await listarCategorias(cliente, new AbortController().signal);

    expect(resultado).toEqual(categorias);
    expect(String((fetchFalso.mock.calls[0] as unknown as [string])[0])).toContain('limit=100');
  });

  // ---------------------------------------------
  // Sincronização com a URL
  // Página ausente ou inválida na URL sempre vira 1: um link quebrado ou
  // editado à mão não pode pedir uma página fora do intervalo válido.
  // ---------------------------------------------
  it('lê o filtro a partir de parâmetros de URL completos', () => {
    const parametros = new URLSearchParams(
      'categoria=4&busca=mouse&pagina=3',
    );
    expect(filtroDaUrl(parametros)).toEqual({
      categoria: 4,
      busca: 'mouse',
      pagina: 3,
    });
  });

  it('usa os padrões quando a URL não tem nenhum parâmetro', () => {
    expect(filtroDaUrl(new URLSearchParams(''))).toEqual({
      categoria: null,
      busca: '',
      pagina: 1,
    });
  });

  it('trata página inválida na URL como página 1', () => {
    expect(filtroDaUrl(new URLSearchParams('pagina=abc')).pagina).toBe(1);
    expect(filtroDaUrl(new URLSearchParams('pagina=0')).pagina).toBe(1);
  });

  it('aceita categoria=0 como categoria válida', () => {
    expect(filtroDaUrl(new URLSearchParams('categoria=0')).categoria).toBe(0);
  });

  it('converte o filtro de volta para parâmetros de URL', () => {
    const parametros = urlDoFiltro({
      categoria: 4,
      busca: 'mouse',
      pagina: 3,
    });
    expect(parametros.get('categoria')).toBe('4');
    expect(parametros.get('busca')).toBe('mouse');
    expect(parametros.get('pagina')).toBe('3');
  });

  it('omite da URL o que está no valor padrão', () => {
    const parametros = urlDoFiltro({ categoria: null, busca: '', pagina: 1 });
    expect(parametros.toString()).toBe('');
  });
});
