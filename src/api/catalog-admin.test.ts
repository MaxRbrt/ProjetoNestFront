import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';
import {
  atualizarCategoria,
  atualizarProduto,
  buscarCategoria,
  criarCategoria,
  criarProduto,
  removerCategoria,
  removerProduto,
} from './catalog-admin';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function clienteComSessao(
  responder: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/auth/refresh')) {
      return respostaJson({ message: 'sem sessão' }, 401);
    }
    return responder(url, init);
  });
  return new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: fetchFalso as unknown as typeof fetch,
  });
}

describe('catalog-admin', () => {
  it('criarProduto faz POST /products com o corpo informado', async () => {
    const cliente = clienteComSessao(async (url, init) => {
      expect(url).toBe('http://api.local/products');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        name: 'Caneca',
        price: 29.9,
        categoryId: 3,
        stock: 10,
      });
      return respostaJson({
        id: 1,
        name: 'Caneca',
        price: 29.9,
        categoryId: 3,
        stock: 10,
      });
    });

    const produto = await criarProduto(cliente, {
      name: 'Caneca',
      price: 29.9,
      categoryId: 3,
      stock: 10,
    });

    expect(produto).toMatchObject({ id: 1, name: 'Caneca' });
  });

  it('criarProduto propaga o erro 400 de validação da API', async () => {
    const cliente = clienteComSessao(async () =>
      respostaJson({ message: ['price must be a positive number'] }, 400),
    );

    await expect(
      criarProduto(cliente, {
        name: 'X',
        price: -1,
        categoryId: 1,
        stock: 1,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('atualizarProduto faz PATCH /products/:id', async () => {
    const cliente = clienteComSessao(async (url, init) => {
      expect(url).toBe('http://api.local/products/7');
      expect(init?.method).toBe('PATCH');
      return respostaJson({
        id: 7,
        name: 'Novo nome',
        price: 10,
        categoryId: 1,
        stock: 5,
      });
    });

    const produto = await atualizarProduto(cliente, 7, { name: 'Novo nome' });
    expect(produto.name).toBe('Novo nome');
  });

  it('removerProduto faz DELETE /products/:id', async () => {
    const cliente = clienteComSessao(async (url, init) => {
      expect(url).toBe('http://api.local/products/9');
      expect(init?.method).toBe('DELETE');
      return respostaJson(undefined, 204);
    });

    await expect(removerProduto(cliente, 9)).resolves.toBeUndefined();
  });

  it('removerProduto propaga 409 quando há pedido vinculado', async () => {
    const cliente = clienteComSessao(async () =>
      respostaJson(
        { message: 'Não é possível remover o produto 9: existem pedidos vinculados a ele' },
        409,
      ),
    );

    await expect(removerProduto(cliente, 9)).rejects.toMatchObject({
      status: 409,
      message: 'Não é possível remover o produto 9: existem pedidos vinculados a ele',
    });
  });

  it('buscarCategoria faz GET /categories/:id', async () => {
    const controlador = new AbortController();
    const cliente = clienteComSessao(async (url, init) => {
      expect(url).toBe('http://api.local/categories/4');
      expect(init?.signal).toBe(controlador.signal);
      return respostaJson({ id: 4, name: 'Bebidas' });
    });

    const categoria = await buscarCategoria(cliente, 4, controlador.signal);
    expect(categoria).toEqual({ id: 4, name: 'Bebidas' });
  });

  it('criarCategoria faz POST /categories', async () => {
    const cliente = clienteComSessao(async (url, init) => {
      expect(url).toBe('http://api.local/categories');
      expect(init?.method).toBe('POST');
      return respostaJson({ id: 5, name: 'Papelaria' });
    });

    const categoria = await criarCategoria(cliente, { name: 'Papelaria' });
    expect(categoria).toEqual({ id: 5, name: 'Papelaria' });
  });

  it('atualizarCategoria faz PATCH /categories/:id', async () => {
    const cliente = clienteComSessao(async (url, init) => {
      expect(url).toBe('http://api.local/categories/5');
      expect(init?.method).toBe('PATCH');
      return respostaJson({ id: 5, name: 'Papelaria e Livros' });
    });

    const categoria = await atualizarCategoria(cliente, 5, {
      name: 'Papelaria e Livros',
    });
    expect(categoria.name).toBe('Papelaria e Livros');
  });

  it('removerCategoria propaga 409 quando há produto vinculado', async () => {
    const cliente = clienteComSessao(async () =>
      respostaJson(
        { message: 'Não é possível remover a categoria 5: existem produtos vinculados a ela' },
        409,
      ),
    );

    await expect(removerCategoria(cliente, 5)).rejects.toMatchObject({
      status: 409,
    });
  });
});
