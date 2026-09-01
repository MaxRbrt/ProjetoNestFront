import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { ProvedorDeSessao } from '../auth/session-context';
import { NavPrincipal } from './nav-principal';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function montar(role: 'ADMIN' | 'CLIENTE') {
  const sessao = {
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
  };
  const fetchFalso = vi.fn(async () => respostaJson(sessao));
  const cliente = new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: fetchFalso as unknown as typeof fetch,
  });

  return render(
    <MemoryRouter>
      <ProvedorDeSessao cliente={cliente}>
        <NavPrincipal />
      </ProvedorDeSessao>
    </MemoryRouter>,
  );
}

describe('NavPrincipal', () => {
  it('mostra o link Painel Admin para usuário ADMIN', async () => {
    montar('ADMIN');
    expect(
      await screen.findByRole('link', { name: 'Painel Admin' }),
    ).toBeInTheDocument();
  });

  it('não mostra o link Painel Admin para usuário CLIENTE', async () => {
    montar('CLIENTE');
    await screen.findByRole('link', { name: 'Produtos' });
    expect(
      screen.queryByRole('link', { name: 'Painel Admin' }),
    ).not.toBeInTheDocument();
  });

  it('sempre mostra o link Produtos', async () => {
    montar('CLIENTE');
    expect(
      await screen.findByRole('link', { name: 'Produtos' }),
    ).toBeInTheDocument();
  });
});
