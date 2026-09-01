import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { ProvedorDeSessao, useSessao } from './session-context';

const USUARIO = {
  id: 'u1',
  email: 'cliente@example.com',
  isEmailVerified: true,
  createdAt: '2026-08-31T00:00:00.000Z',
  role: 'CLIENTE' as const,
};

const SESSAO = {
  accessToken: 'token-1',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  user: USUARIO,
};

function criarFetch(opcoes: { logoutFunciona: boolean }) {
  return vi.fn(async (url: string): Promise<Response> => {
    if (url.endsWith('/auth/logout') && !opcoes.logoutFunciona) {
      return new Response(JSON.stringify({ message: 'rede indisponível' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/auth/logout')) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/auth/refresh')) {
      return new Response(JSON.stringify(SESSAO), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function Painel() {
  const { situacao, usuario, saidaNaoConfirmada, sair } = useSessao();
  return (
    <div>
      <p>situacao: {situacao}</p>
      <p>usuario: {usuario?.email ?? 'nenhum'}</p>
      <p>saida pendente: {saidaNaoConfirmada ? 'sim' : 'nao'}</p>
      <button onClick={() => void sair()}>Sair</button>
    </div>
  );
}

describe('Encerramento de sessão', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------
  // Saída bem-sucedida
  // ---------------------------------------------
  it('limpa a sessão e não deixa pendência quando o servidor confirma', async () => {
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: criarFetch({ logoutFunciona: true }) as unknown as typeof fetch,
      canalDeSessao: 'teste-logout-ok',
    });
    render(
      <ProvedorDeSessao cliente={cliente}>
        <Painel />
      </ProvedorDeSessao>,
    );
    await screen.findByText('situacao: autenticado');

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(screen.getByText('situacao: anonimo')).toBeInTheDocument();
    });
    expect(screen.getByText('saida pendente: nao')).toBeInTheDocument();
    expect(cliente.temSessao()).toBe(false);
  });

  // ---------------------------------------------
  // Saída que o servidor não confirmou
  // O cookie httpOnly continua no navegador e o JavaScript não o apaga. A
  // sessão precisa cair localmente mesmo assim, mas a pendência fica marcada
  // para que o próximo carregamento não recupere a sessão que o usuário
  // pediu para encerrar.
  // ---------------------------------------------
  it('encerra localmente e sinaliza a pendência quando o servidor falha', async () => {
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: criarFetch({
        logoutFunciona: false,
      }) as unknown as typeof fetch,
      canalDeSessao: 'teste-logout-falho',
    });
    render(
      <ProvedorDeSessao cliente={cliente}>
        <Painel />
      </ProvedorDeSessao>,
    );
    await screen.findByText('situacao: autenticado');

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(screen.getByText('situacao: anonimo')).toBeInTheDocument();
    });
    expect(screen.getByText('saida pendente: sim')).toBeInTheDocument();
    expect(cliente.temSessao()).toBe(false);
  });

  it('não recupera a sessão automaticamente quando há saída pendente', async () => {
    sessionStorage.setItem('saida-pendente', '1');
    const fetchFalso = criarFetch({ logoutFunciona: true });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
      canalDeSessao: 'teste-saida-pendente',
    });

    render(
      <ProvedorDeSessao cliente={cliente}>
        <Painel />
      </ProvedorDeSessao>,
    );

    await waitFor(() => {
      expect(screen.getByText('situacao: anonimo')).toBeInTheDocument();
    });
    const renovacoes = fetchFalso.mock.calls.filter((c) =>
      String(c[0]).endsWith('/auth/refresh'),
    );
    expect(renovacoes).toHaveLength(0);
  });
});
