import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { useProduct } from './use-product';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('useProduct', () => {
  it('carrega o produto pelo id', async () => {
    const produto = {
      id: 7,
      name: 'Teclado',
      price: 150,
      stock: 2,
      categoryId: 1,
    };
    const fetchFalso = vi.fn(async () => respostaJson(produto));
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useProduct(cliente, 7));

    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.produto).toEqual(produto);
  });

  it('ignora a resposta anterior ao trocar de id', async () => {
    const pendente: { resolver?: (resposta: Response) => void } = {};
    let chamadas = 0;
    const fetchFalso = vi.fn(async () => {
      chamadas += 1;
      if (chamadas === 1) {
        return new Promise<Response>((resolve) => {
          pendente.resolver = resolve;
        });
      }
      return respostaJson({
        id: 9,
        name: 'Novo',
        price: 10,
        stock: 1,
        categoryId: 1,
      });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result, rerender } = renderHook(
      ({ id }) => useProduct(cliente, id),
      { initialProps: { id: 7 } },
    );

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    rerender({ id: 9 });
    pendente.resolver?.(
      respostaJson({
        id: 7,
        name: 'Velho',
        price: 1,
        stock: 1,
        categoryId: 1,
      }),
    );

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.produto?.id).toBe(9);
  });

  it('expõe erro quando o produto não existe', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({ message: 'Produto 999 não encontrado' }, 404),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useProduct(cliente, 999));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe('Produto 999 não encontrado');
  });

  it('rejeita identificador inválido sem chamar a API', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({ id: 1, name: 'Mouse', price: 10, stock: 1, categoryId: 1 }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useProduct(cliente, Number.NaN));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe('Produto inválido.');
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
