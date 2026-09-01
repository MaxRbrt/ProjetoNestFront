import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import { AdminProductsPage } from './admin-products-page';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function montar(
  responder: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const fetchFalso = vi.fn(responder);
  const cliente = new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: fetchFalso as unknown as typeof fetch,
  });
  return {
    cliente,
    fetchFalso,
    ...render(
      <MemoryRouter>
        <AdminProductsPage cliente={cliente} />
      </MemoryRouter>,
    ),
  };
}

describe('AdminProductsPage', () => {
  it('lista os produtos com link para editar e botão de remover', async () => {
    montar(async () =>
      respostaJson({
        data: [
          { id: 1, name: 'Caneca', price: 29.9, stock: 10, categoryId: 1 },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );

    expect(await screen.findByText('Caneca')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /editar caneca/i }),
    ).toHaveAttribute('href', '/admin/produtos/1/editar');
    expect(
      screen.getByRole('button', { name: /remover caneca/i }),
    ).toBeInTheDocument();
  });

  it('remove o produto e atualiza a lista após confirmação', async () => {
    const usuario = userEvent.setup();
    let listaAtual = [
      { id: 1, name: 'Caneca', price: 29.9, stock: 10, categoryId: 1 },
    ];
    const { fetchFalso } = montar(async (_url, init) => {
      if (init?.method === 'DELETE') {
        listaAtual = [];
        return respostaJson(undefined, 204);
      }
      return respostaJson({
        data: listaAtual,
        total: listaAtual.length,
        page: 1,
        limit: 20,
      });
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await screen.findByText('Caneca');
    await usuario.click(screen.getByRole('button', { name: /remover caneca/i }));

    await waitFor(() => {
      expect(screen.queryByText('Caneca')).not.toBeInTheDocument();
    });
    expect(
      fetchFalso.mock.calls.some(
        (chamada) => (chamada[1] as RequestInit | undefined)?.method === 'DELETE',
      ),
    ).toBe(true);
  });

  it('mostra o erro 409 quando a remoção tem dependência', async () => {
    const usuario = userEvent.setup();
    montar(async (_url, init) => {
      if (init?.method === 'DELETE') {
        return respostaJson(
          {
            message:
              'Não é possível remover o produto 1: existem pedidos vinculados a ele',
          },
          409,
        );
      }
      return respostaJson({
        data: [
          { id: 1, name: 'Caneca', price: 29.9, stock: 10, categoryId: 1 },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await screen.findByText('Caneca');
    await usuario.click(screen.getByRole('button', { name: /remover caneca/i }));

    expect(
      await screen.findByText(
        'Não é possível remover o produto 1: existem pedidos vinculados a ele',
      ),
    ).toBeInTheDocument();
  });
});
