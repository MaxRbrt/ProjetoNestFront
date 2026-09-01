import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import { ProvedorDeSessao } from '../../auth/session-context';
import { AdminLayout } from './admin-layout';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AdminLayout', () => {
  it('mostra o cabeçalho, a subnav e o conteúdo da rota filha', async () => {
    const fetchFalso = vi.fn(async () =>
      respostaJson({
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'u1',
          email: 'admin@example.com',
          isEmailVerified: true,
          createdAt: '2026-08-31T00:00:00.000Z',
          role: 'ADMIN',
        },
      }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    render(
      <MemoryRouter initialEntries={['/admin/produtos']}>
        <ProvedorDeSessao cliente={cliente}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path="/admin/produtos" element={<p>Tela filha</p>} />
            </Route>
          </Routes>
        </ProvedorDeSessao>
      </MemoryRouter>,
    );

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();
    const subnav = screen.getByRole('navigation', {
      name: 'Navegação do painel admin',
    });
    expect(
      within(subnav).getByRole('link', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(
      within(subnav).getByRole('link', { name: 'Produtos' }),
    ).toBeInTheDocument();
    expect(
      within(subnav).getByRole('link', { name: 'Categorias' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tela filha')).toBeInTheDocument();
  });
});
