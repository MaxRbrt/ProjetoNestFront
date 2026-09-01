import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import { ProvedorDeSessao } from '../../auth/session-context';
import { TelaDeProdutos } from './products-page';

const SESSAO = {
  accessToken: 'token',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: 'u1',
    email: 'a@b.com',
    isEmailVerified: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    role: 'CLIENTE' as const,
  },
};

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function montar(
  responderPagina: (url: string, init?: RequestInit) => Promise<Response>,
  entrada = '/produtos',
) {
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/auth/refresh')) {
      return respostaJson(SESSAO);
    }
    return responderPagina(url, init);
  });
  const cliente = new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: fetchFalso as unknown as typeof fetch,
  });

  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <ProvedorDeSessao cliente={cliente}>
        <TelaDeProdutos cliente={cliente} />
      </ProvedorDeSessao>
    </MemoryRouter>,
  );
}

describe('TelaDeProdutos', () => {
  it('mostra os produtos carregados', async () => {
    montar(async (url) => {
      if (url.includes('/categories')) {
        return respostaJson({ data: [], total: 0, page: 1, limit: 100 });
      }
      return respostaJson({
        data: [
          { id: 1, name: 'Mouse', price: 50, stock: 4, categoryId: 1 },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Mouse')).toBeInTheDocument();
    });
  });

  it('mostra um estado de carregamento enquanto aguarda os produtos', async () => {
    montar(async (url) => {
      if (url.includes('/categories')) {
        return respostaJson({ data: [], total: 0, page: 1, limit: 100 });
      }
      return new Promise<Response>(() => undefined);
    });

    expect(
      await screen.findByRole('status', { name: /carregando produtos/i }),
    ).toBeInTheDocument();
  });

  it('mostra mensagem quando não há produtos', async () => {
    montar(async () =>
      respostaJson({ data: [], total: 0, page: 1, limit: 20 }),
    );

    await waitFor(() => {
      expect(screen.getByText(/nenhum produto/i)).toBeInTheDocument();
    });
  });

  it('limpa os filtros a partir do estado vazio', async () => {
    montar(
      async () =>
        respostaJson({ data: [], total: 0, page: 1, limit: 20 }),
      '/produtos?busca=mouse',
    );
    await screen.findByText(/nenhum produto/i);

    await userEvent.click(
      screen.getByRole('button', { name: /limpar filtros/i }),
    );

    expect(screen.getByLabelText(/buscar produto/i)).toHaveValue('');
  });

  it('mostra mensagem de erro quando a API falha', async () => {
    let chamadasDeProdutos = 0;
    montar(async (url) => {
      if (url.includes('/categories')) {
        return respostaJson({ data: [], total: 0, page: 1, limit: 100 });
      }
      chamadasDeProdutos += 1;
      if (chamadasDeProdutos === 1) {
        return respostaJson({ message: 'Fora do ar' }, 500);
      }
      return respostaJson({
        data: [
          { id: 3, name: 'Monitor', price: 900, stock: 1, categoryId: 1 },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    await screen.findByText('Fora do ar');

    await userEvent.click(
      screen.getByRole('button', { name: /tentar novamente/i }),
    );

    expect(await screen.findByText('Monitor')).toBeInTheDocument();
  });
});
