import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutAdmin } from './layout-admin';

vi.mock('../../auth/contexto-de-sessao', () => ({
  useSessao: () => ({
    usuario: { email: 'admin@exemplo.com', papel: 'ADMIN' },
    sair: vi.fn(),
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<LayoutAdmin />}>
          <Route index element={<p>Conteúdo do painel</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------
// Casca do painel administrativo
// A navegação do painel é o único <nav> com este rótulo — precisa conter os
// quatro links de seção. O link "Ver loja" leva à loja pública, e a ausência
// do campo de busca confirma que o Cabecalho da loja não é montado aqui.
// ---------------------------------------------
describe('LayoutAdmin', () => {
  it('mostra a navegação do painel com os quatro links', () => {
    renderizar();
    const nav = screen.getByRole('navigation', {
      name: 'Navegação do painel admin',
    });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Produtos' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Categorias' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Pedidos' })).toBeTruthy();
  });

  it('tem link "Ver loja" para a raiz', () => {
    renderizar();
    expect(
      screen.getByRole('link', { name: 'Ver loja' }).getAttribute('href'),
    ).toBe('/');
  });

  it('não monta o campo de busca da loja', () => {
    renderizar();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByPlaceholderText(/buscar/i)).toBeNull();
  });
});
