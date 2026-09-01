import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { useCategories } from './use-categories';

describe('useCategories', () => {
  it('carrega a lista de categorias uma vez', async () => {
    const categorias = [
      { id: 1, name: 'Bebidas' },
      { id: 2, name: 'Hardware' },
    ];
    const fetchFalso = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: categorias,
          total: 2,
          page: 1,
          limit: 100,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useCategories(cliente));

    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.categorias).toEqual(categorias);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
