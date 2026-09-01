import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import { AdminCategoriesPage } from './admin-categories-page';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AdminCategoriesPage', () => {
  it('lista categorias com editar e remover', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({
        data: [{ id: 1, name: 'Bebidas' }],
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    render(
      <MemoryRouter>
        <AdminCategoriesPage cliente={cliente} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Bebidas')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /editar bebidas/i }),
    ).toHaveAttribute('href', '/admin/categorias/1/editar');
  });

  it('mostra o erro 409 ao tentar remover categoria com produto vinculado', async () => {
    const usuario = userEvent.setup();
    const fetchFalso = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return respostaJson(
          {
            message:
              'Não é possível remover a categoria 1: existem produtos vinculados a ela',
          },
          409,
        );
      }
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <AdminCategoriesPage cliente={cliente} />
      </MemoryRouter>,
    );

    await screen.findByText('Bebidas');
    await usuario.click(
      screen.getByRole('button', { name: /remover bebidas/i }),
    );

    expect(
      await screen.findByText(
        'Não é possível remover a categoria 1: existem produtos vinculados a ela',
      ),
    ).toBeInTheDocument();
  });
});
