import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './client';

const SESSAO = {
  accessToken: 'token-compartilhado',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  user: {
    id: 'u1',
    email: 'a@b.com',
    isEmailVerified: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    role: 'CLIENTE' as const,
  },
};

function esperarPropagacao(): Promise<void> {
  // O canal de transmissão entrega em outra volta do laço de eventos.
  return new Promise((resolver) => setTimeout(resolver, 0));
}

// ---------------------------------------------
// Sessão compartilhada entre abas
// Cada aba tem sua própria instância do cliente. Sem coordenação, duas abas
// apresentam o mesmo refresh cookie: uma o rotaciona e a outra manda um token
// já consumido, que o backend trata como reuso e responde revogando a família
// inteira — derrubando o usuário nas duas.
// ---------------------------------------------
describe('Sessão entre abas', () => {
  const canal = 'teste-multi-aba';

  it('propaga o início de sessão para a outra aba', async () => {
    const abaA = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
      canalDeSessao: canal,
    });
    const abaB = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
      canalDeSessao: canal,
    });

    abaA.definirSessao(SESSAO);
    await esperarPropagacao();

    expect(abaB.tokenAtual()).toBe('token-compartilhado');
    abaA.encerrar();
    abaB.encerrar();
  });

  it('propaga o encerramento para a outra aba', async () => {
    const abaA = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
      canalDeSessao: `${canal}-saida`,
    });
    const abaB = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
      canalDeSessao: `${canal}-saida`,
    });
    const eventosDeB: string[] = [];
    abaB.aoMudarSessao((evento) => eventosDeB.push(evento.tipo));

    abaA.definirSessao(SESSAO);
    await esperarPropagacao();
    abaA.limparSessao();
    await esperarPropagacao();

    expect(abaB.temSessao()).toBe(false);
    expect(eventosDeB).toContain('encerrada');
    abaA.encerrar();
    abaB.encerrar();
  });

  it('a aba que recebe o evento não o reenvia, evitando eco', async () => {
    const abaA = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
      canalDeSessao: `${canal}-eco`,
    });
    const abaB = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
      canalDeSessao: `${canal}-eco`,
    });
    const eventosDeA: string[] = [];
    abaA.aoMudarSessao((evento) => eventosDeA.push(evento.tipo));

    abaB.definirSessao(SESSAO);
    await esperarPropagacao();
    await esperarPropagacao();

    // Um evento recebido de B, e nenhum retorno de B reagindo ao próprio eco.
    expect(eventosDeA).toEqual(['renovada']);
    abaA.encerrar();
    abaB.encerrar();
  });
});
