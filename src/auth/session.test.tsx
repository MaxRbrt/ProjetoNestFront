import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { RotaProtegida } from './protected-route';
import { ProvedorDeSessao, useSessao } from './session-context';

// ---------------------------------------------
// Dublê de fetch para o ciclo de sessão
// Controla o que a rota de renovação responde e quanto ela demora, para que o
// teste consiga observar o estado intermediário de verificação.
// ---------------------------------------------
function criarFetch(opcoes: { temSessao: boolean; atrasoMs?: number }) {
  return vi.fn(async (entrada: string): Promise<Response> => {
    if (opcoes.atrasoMs) {
      await new Promise((resolver) => setTimeout(resolver, opcoes.atrasoMs));
    }
    if (entrada.endsWith('/auth/refresh')) {
      if (!opcoes.temSessao) {
        return new Response(JSON.stringify({ message: 'sem sessão' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          accessToken: 'token',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: {
            id: 'u1',
            email: 'cliente@example.com',
            isEmailVerified: true,
            createdAt: '2026-08-28T00:00:00.000Z',
            role: 'CLIENTE',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function montar(opcoes: { temSessao: boolean; atrasoMs?: number }) {
  const cliente = new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: criarFetch(opcoes) as unknown as typeof fetch,
  });

  render(
    <MemoryRouter initialEntries={['/painel']}>
      <ProvedorDeSessao cliente={cliente}>
        <Routes>
          <Route path="/entrar" element={<p>Tela de entrada</p>} />
          <Route
            path="/painel"
            element={
              <RotaProtegida>
                <p>Conteúdo protegido</p>
              </RotaProtegida>
            }
          />
        </Routes>
      </ProvedorDeSessao>
    </MemoryRouter>,
  );

  return cliente;
}

describe('Sessão e rota protegida', () => {
  // ---------------------------------------------
  // Estado intermediário de verificação
  // ---------------------------------------------
  it('não mostra a tela de entrada enquanto verifica a sessão', async () => {
    montar({ temSessao: true, atrasoMs: 30 });

    expect(screen.getByText(/verificando sessão/i)).toBeInTheDocument();
    expect(screen.queryByText('Tela de entrada')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------
  // Decisão após a verificação
  // ---------------------------------------------
  it('libera o conteúdo quando o cookie devolve uma sessão válida', async () => {
    montar({ temSessao: true });

    await waitFor(() => {
      expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
    });
  });

  it('redireciona para a entrada quando não há sessão', async () => {
    montar({ temSessao: false });

    await waitFor(() => {
      expect(screen.getByText('Tela de entrada')).toBeInTheDocument();
    });
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  // ---------------------------------------------
  // Proteção contra renovação duplicada
  // O refresh é rotativo: se a montagem dupla do modo estrito chamasse a rota
  // duas vezes, a segunda apresentaria um token já invalidado pela primeira.
  // A verificação usa <StrictMode>, e não um rerender: rerender preserva o
  // mesmo useRef e por isso jamais exercitaria a trava que está sendo testada.
  // ---------------------------------------------
  it('verifica a sessão uma única vez sob a montagem dupla do modo estrito', async () => {
    const fetchFalso = criarFetch({ temSessao: true });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    function Sonda() {
      const { situacao } = useSessao();
      return <p>{situacao}</p>;
    }

    render(
      <StrictMode>
        <ProvedorDeSessao cliente={cliente}>
          <Sonda />
        </ProvedorDeSessao>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('autenticado')).toBeInTheDocument();
    });

    const chamadasDeRenovacao = fetchFalso.mock.calls.filter((chamada) =>
      String(chamada[0]).endsWith('/auth/refresh'),
    );
    expect(chamadasDeRenovacao).toHaveLength(1);
  });

  // ---------------------------------------------
  // Comportamento sob o modo estrito
  // O modo estrito monta, desmenta e monta de novo. Uma limpeza que marcasse
  // "não montado" descartaria a resposta da única chamada feita, e a tela
  // ficaria presa em "verificando" — falha que só aparece na aplicação real,
  // porque a renderização de teste comum não repete a montagem.
  // ---------------------------------------------
  it('conclui a verificação mesmo com a montagem dupla do modo estrito', async () => {
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: criarFetch({ temSessao: true }) as unknown as typeof fetch,
    });

    function Sonda() {
      const { situacao } = useSessao();
      return <p>{situacao}</p>;
    }

    render(
      <StrictMode>
        <ProvedorDeSessao cliente={cliente}>
          <Sonda />
        </ProvedorDeSessao>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('autenticado')).toBeInTheDocument();
    });
  });

  it('conclui como anônimo sob o modo estrito quando não há sessão', async () => {
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: criarFetch({ temSessao: false }) as unknown as typeof fetch,
    });

    function Sonda() {
      const { situacao } = useSessao();
      return <p>{situacao}</p>;
    }

    render(
      <StrictMode>
        <ProvedorDeSessao cliente={cliente}>
          <Sonda />
        </ProvedorDeSessao>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('anonimo')).toBeInTheDocument();
    });
  });
});
