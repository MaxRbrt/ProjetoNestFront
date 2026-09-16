import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '../api/cliente';
import { TelaDeRedefinirSenha } from './tela-de-redefinir-senha';

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/redefinir-senha');
});

function renderizar(cliente: ApiClient) {
  return render(
    <StrictMode>
      <MemoryRouter>
        <TelaDeRedefinirSenha cliente={cliente} />
      </MemoryRouter>
    </StrictMode>,
  );
}

// ---------------------------------------------
// Leitura do token sob StrictMode
// A dupla montagem do StrictMode não pode perder o token lido de
// "#token=..." (armadilha 16 do CLAUDE.md): o formulário precisa aparecer, e
// não o estado de "link incompleto".
// ---------------------------------------------
describe('TelaDeRedefinirSenha', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/redefinir-senha#token=abc');
  });

  it('mantém o token lido do fragmento sob StrictMode e mostra o formulário', () => {
    const cliente = { post: vi.fn() } as unknown as ApiClient;
    renderizar(cliente);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Redefinir senha' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('O link de redefinição está incompleto.'),
    ).not.toBeInTheDocument();
  });

  it('erro terminal exato de token inválido/expirado vira estado final', async () => {
    const post = vi.fn(async () => {
      throw new ApiError(400, 'O token é inválido ou expirou.');
    });
    const cliente = { post } as unknown as ApiClient;
    renderizar(cliente);

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'SenhaNova123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Não deu certo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('O link pode ter expirado ou já ter sido usado.'),
    ).toBeInTheDocument();
  });

  it('outro erro mantém o formulário preenchido, sem virar estado terminal', async () => {
    const post = vi.fn(async () => {
      throw new ApiError(400, 'A senha não atende à política mínima.');
    });
    const cliente = { post } as unknown as ApiClient;
    renderizar(cliente);

    const campoDeSenha = screen.getByLabelText<HTMLInputElement>('Nova senha');
    fireEvent.change(campoDeSenha, { target: { value: 'fraca' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(
      await screen.findByText('A senha não atende à política mínima.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Redefinir senha' }),
    ).toBeInTheDocument();
    expect(campoDeSenha).toHaveValue('fraca');
  });
});
