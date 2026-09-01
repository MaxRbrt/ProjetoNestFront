import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { useAdminCategoriesList } from './use-admin-categories-list';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('useAdminCategoriesList', () => {
  it('lista categorias paginadas', async () => {
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://api.local/categories?page=1');
      expect(init?.signal).toBeDefined();
      return respostaJson({
        data: [{ id: 1, name: 'Bebidas' }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useAdminCategoriesList(cliente, 1));

    await waitFor(() => {
      expect(result.current.categorias?.data).toHaveLength(1);
    });
  });
});
