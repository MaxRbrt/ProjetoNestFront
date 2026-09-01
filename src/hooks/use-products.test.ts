import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { useProducts } from './use-products';

function respostaJson(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('useProducts', () => {
  // ---------------------------------------------
  // Carregamento simples
  // ---------------------------------------------
  it('carrega os produtos da página pedida', async () => {
    const produtos = [{ id: 1, name: 'Mouse', price: 50, stock: 4, categoryId: 1 }];
    const fetchFalso = vi.fn(async () =>
      respostaJson({ data: produtos, total: 1, page: 1, limit: 20 }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() =>
      useProducts(cliente, { categoria: null, busca: '', pagina: 1 }),
    );

    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.produtos?.data).toEqual(produtos);
    expect(result.current.erro).toBeNull();
  });

  // ---------------------------------------------
  // Cancelamento de requisição obsoleta
  // Troca de filtro no meio de uma requisição não pode deixar a resposta
  // antiga sobrescrever o resultado do filtro mais novo.
  // ---------------------------------------------
  it('cancela a requisição anterior quando o filtro muda antes dela responder', async () => {
    const primeira = { promessa: null as unknown as Promise<Response>, resolver: null as unknown as (r: Response) => void };
    primeira.promessa = new Promise((resolve) => {
      primeira.resolver = resolve;
    });

    let chamadas = 0;
    const fetchFalso = vi.fn(async () => {
      chamadas += 1;
      if (chamadas === 1) {
        return primeira.promessa;
      }
      return respostaJson({ data: [], total: 0, page: 2, limit: 20 });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result, rerender } = renderHook(
      ({ filtro }) => useProducts(cliente, filtro),
      { initialProps: { filtro: { categoria: null, busca: '', pagina: 1 } } },
    );

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    rerender({ filtro: { categoria: null, busca: '', pagina: 2 } });

    // A primeira requisição só responde depois da troca de filtro — sua
    // resposta não pode aparecer no estado.
    primeira.resolver(respostaJson({ data: [{ id: 99 }], total: 1, page: 1, limit: 20 }));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.produtos?.page).toBe(2);
  });

  it('não trata cancelamento como erro visível', async () => {
    const fetchFalso = vi.fn(
      async (_url: string, _init?: RequestInit): Promise<Response> => {
        const sinal = _init?.signal;
        return new Promise((_resolve, reject) => {
          sinal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      },
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result, rerender, unmount } = renderHook(
      ({ filtro }) => useProducts(cliente, filtro),
      { initialProps: { filtro: { categoria: null, busca: '', pagina: 1 } } },
    );
    rerender({ filtro: { categoria: null, busca: 'outro', pagina: 1 } });

    expect(result.current.erro).toBeNull();
    unmount();
  });

  it('não dispara a busca anterior quando o filtro muda durante o debounce', async () => {
    const fetchFalso = vi.fn(async (_url: string) =>
      respostaJson({ data: [], total: 0, page: 1, limit: 20 }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { rerender } = renderHook(
      ({ filtro }) => useProducts(cliente, filtro),
      {
        initialProps: {
          filtro: { categoria: null, busca: 'mouse', pagina: 1 },
        },
      },
    );

    rerender({
      filtro: { categoria: null, busca: 'teclado', pagina: 1 },
    });

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1), {
      timeout: 1_000,
    });
    expect(String(fetchFalso.mock.calls[0][0])).toContain('name=teclado');
  });

  // ---------------------------------------------
  // Erro real
  // ---------------------------------------------
  it('expõe erro quando a API responde com falha', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({ message: 'Falha ao listar' }),
    );
    // Resposta de erro precisa de status != 2xx para o ApiClient rejeitar.
    fetchFalso.mockImplementation(
      async () =>
        new Response(JSON.stringify({ message: 'Falha ao listar' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() =>
      useProducts(cliente, { categoria: null, busca: '', pagina: 1 }),
    );

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe('Falha ao listar');
    expect(result.current.produtos).toBeNull();
  });

  it('permite tentar novamente depois de um erro', async () => {
    let chamadas = 0;
    const fetchFalso = vi.fn(async () => {
      chamadas += 1;
      if (chamadas === 1) {
        return new Response(JSON.stringify({ message: 'Fora do ar' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      return respostaJson({
        data: [
          { id: 2, name: 'Teclado', price: 80, stock: 2, categoryId: 1 },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() =>
      useProducts(cliente, { categoria: null, busca: '', pagina: 1 }),
    );
    await waitFor(() => expect(result.current.erro).toBe('Fora do ar'));

    act(() => result.current.recarregar());

    await waitFor(() => expect(result.current.produtos?.data[0]?.id).toBe(2));
    expect(result.current.erro).toBeNull();
  });
});
