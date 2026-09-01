import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { RotaAdmin } from './admin-route';
import { ProvedorDeSessao } from './session-context';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function montar(role: 'ADMIN' | 'CLIENTE' | null) {
  const fetchFalso = vi.fn(async () => {
    if (role === null) {
      return respostaJson({ message: 'sem sessão' }, 401);
    }
    return respostaJson({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: 'u1',
        email: 'a@b.com',
        isEmailVerified: true,
        createdAt: '2026-08-31T00:00:00.000Z',
        role,
      },
    });
  });
  const cliente = new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: fetchFalso as unknown as typeof fetch,
  });

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <ProvedorDeSessao cliente={cliente}>
        <Routes>
          <Route path="/entrar" element={<p>Tela de entrada</p>} />
          <Route path="/" element={<p>Tela inicial</p>} />
          <Route
            path="/admin"
            element={
              <RotaAdmin>
                <p>Conteúdo do painel</p>
              </RotaAdmin>
            }
          />
        </Routes>
      </ProvedorDeSessao>
    </MemoryRouter>,
  );
}

describe('RotaAdmin', () => {
  it('libera o conteúdo para usuário ADMIN', async () => {
    montar('ADMIN');
    await waitFor(() => {
      expect(screen.getByText('Conteúdo do painel')).toBeInTheDocument();
    });
  });

  it('redireciona CLIENTE autenticado para a tela inicial, não para o login', async () => {
    montar('CLIENTE');
    await waitFor(() => {
      expect(screen.getByText('Tela inicial')).toBeInTheDocument();
    });
    expect(screen.queryByText('Tela de entrada')).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo do painel')).not.toBeInTheDocument();
  });

  it('redireciona anônimo para o login', async () => {
    montar(null);
    await waitFor(() => {
      expect(screen.getByText('Tela de entrada')).toBeInTheDocument();
    });
  });
});
