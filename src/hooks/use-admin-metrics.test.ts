import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { useAdminMetrics } from './use-admin-metrics';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('useAdminMetrics', () => {
  it('busca os três totais em paralelo, um por recurso', async () => {
    const chamadas: string[] = [];
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return respostaJson({ message: 'sem sessão' }, 401);
      }
      chamadas.push(url);
      if (url.includes('/products')) {
        return respostaJson({ data: [], total: 42, page: 1, limit: 1 });
      }
      if (url.includes('/categories')) {
        return respostaJson({ data: [], total: 6, page: 1, limit: 1 });
      }
      return respostaJson({ data: [], total: 17, page: 1, limit: 1 });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useAdminMetrics(cliente));

    await waitFor(() => {
      expect(result.current.metricas).toEqual({
        totalDeProdutos: 42,
        totalDeCategorias: 6,
        totalDePedidos: 17,
      });
    });
    expect(result.current.carregando).toBe(false);
    expect(chamadas.some((u) => u.includes('/products?limit=1'))).toBe(true);
    expect(chamadas.some((u) => u.includes('/categories?limit=1'))).toBe(
      true,
    );
    expect(chamadas.some((u) => u.includes('/orders?limit=1'))).toBe(true);
  });

  it('reporta erro quando alguma das três chamadas falha', async () => {
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return respostaJson({ message: 'sem sessão' }, 401);
      }
      if (url.includes('/orders')) {
        return respostaJson({ message: 'Falha interna' }, 500);
      }
      return respostaJson({ data: [], total: 1, page: 1, limit: 1 });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const { result } = renderHook(() => useAdminMetrics(cliente));

    await waitFor(() => {
      expect(result.current.erro).not.toBeNull();
    });
    expect(result.current.metricas).toBeNull();
  });
});
