import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import { AdminDashboardPage } from './admin-dashboard-page';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AdminDashboardPage', () => {
  it('mostra os três totais depois de carregar', async () => {
    const fetchFalso = vi.fn(async (url: string) => {
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

    render(<AdminDashboardPage cliente={cliente} />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it('mostra aviso de erro quando alguma métrica falha', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({ message: 'Falha interna' }, 500),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    render(<AdminDashboardPage cliente={cliente} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
