import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { useAdminProductsList } from './use-admin-products-list';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('useAdminProductsList', () => {
  it('lista produtos da página pedida', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({
        data: [{ id: 1, name: 'Caneca', price: 10, stock: 5, categoryId: 1 }],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useAdminProductsList(cliente, 1));

    await waitFor(() => {
      expect(result.current.produtos?.data).toHaveLength(1);
    });
    expect(result.current.carregando).toBe(false);
  });

  it('recarregar dispara nova busca', async () => {
    let chamadas = 0;
    const fetchFalso = vi.fn(async () => {
      chamadas += 1;
      return respostaJson({ data: [], total: 0, page: 1, limit: 20 });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useAdminProductsList(cliente, 1));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const chamadasAntes = chamadas;

    result.current.recarregar();

    await waitFor(() => expect(chamadas).toBeGreaterThan(chamadasAntes));
  });
});
