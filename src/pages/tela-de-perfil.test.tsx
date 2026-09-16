import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { UsuarioPublico } from '../api/cliente';
import { TelaDePerfil } from './tela-de-perfil';

const usuario: UsuarioPublico = {
  id: 'u-1',
  email: 'cliente@exemplo.com',
  emailVerificado: true,
  criadoEm: '2026-09-01T12:00:00Z',
  papel: 'CLIENTE',
};

const useSessaoMock = vi.hoisted(() => vi.fn());

vi.mock('../auth/contexto-de-sessao', () => ({
  useSessao: useSessaoMock,
}));

function renderizar(caminho = '/perfil') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/perfil" element={<TelaDePerfil />} />
        <Route path="/entrar" element={<p>Entrar</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Tela de perfil', () => {
  it('permite mostrar e ocultar o email por uma ação explícita', async () => {
    const pessoa = userEvent.setup();
    useSessaoMock.mockReturnValue({ situacao: 'autenticado', usuario });
    renderizar();
    expect(screen.queryByText(usuario.email)).not.toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Mostrar email' }));
    expect(screen.getByText(usuario.email)).toBeVisible();
    await pessoa.click(screen.getByRole('button', { name: 'Ocultar email' }));
    expect(screen.queryByText(usuario.email)).not.toBeInTheDocument();
  });

  it('informa que os dados estão carregando durante a verificação', () => {
    useSessaoMock.mockReturnValue({ situacao: 'verificando', usuario: null });
    renderizar();
    expect(
      screen.getByRole('status', { name: 'Carregando perfil' }),
    ).toBeInTheDocument();
  });

  it('renderiza os dados reais da sessão atual', () => {
    useSessaoMock.mockReturnValue({ situacao: 'autenticado', usuario });

    renderizar();

    expect(
      screen.getByRole('heading', { name: 'Meu perfil' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(usuario.email)).not.toBeInTheDocument();
    expect(screen.getByText('CLIENTE')).toBeInTheDocument();
    expect(screen.getByText('Email verificado')).toBeInTheDocument();
    expect(screen.getByText('01/09/2026')).toBeInTheDocument();
  });

  it('redireciona para entrada quando a sessão é anônima', () => {
    useSessaoMock.mockReturnValue({ situacao: 'anonimo', usuario: null });

    renderizar();

    expect(screen.getByText('Entrar')).toBeInTheDocument();
  });
});
