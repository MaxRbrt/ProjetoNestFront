import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import { AdminCategoryFormPage } from './admin-category-form-page';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function montar(
  entrada: string,
  responder: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const cliente = new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: vi.fn(responder) as unknown as typeof fetch,
  });
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route
          path="/admin/categorias/novo"
          element={<AdminCategoryFormPage cliente={cliente} />}
        />
        <Route
          path="/admin/categorias/:id/editar"
          element={<AdminCategoryFormPage cliente={cliente} />}
        />
        <Route path="/admin/categorias" element={<p>Lista de categorias</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminCategoryFormPage', () => {
  it('cria uma categoria e volta para a lista', async () => {
    const usuario = userEvent.setup();
    montar('/admin/categorias/novo', async (_url, init) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'Papelaria' });
      return respostaJson({ id: 3, name: 'Papelaria' });
    });

    await usuario.type(screen.getByLabelText('Nome'), 'Papelaria');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Lista de categorias')).toBeInTheDocument();
  });

  it('carrega a categoria existente no modo edição', async () => {
    montar('/admin/categorias/3/editar', async (_url, init) => {
      expect(init?.signal).toBeDefined();
      return respostaJson({ id: 3, name: 'Papelaria' });
    });

    expect(await screen.findByDisplayValue('Papelaria')).toBeInTheDocument();
  });

  it('mostra o erro vindo da API ao salvar', async () => {
    const usuario = userEvent.setup();
    montar('/admin/categorias/novo', async () =>
      respostaJson({ message: 'name should not be empty' }, 400),
    );

    await usuario.type(screen.getByLabelText('Nome'), 'X');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('name should not be empty'),
    ).toBeInTheDocument();
  });
});
