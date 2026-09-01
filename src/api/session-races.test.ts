import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './client';

interface RespostaProgramada {
  status: number;
  corpo: unknown;
}

// ---------------------------------------------
// Promessa que o teste resolve na hora que quiser
// Necessária para reproduzir corridas: sem controlar o momento exato em que
// cada resposta chega, o teste passaria por acidente de ordenação.
// ---------------------------------------------
function promessaControlada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promessa, resolver };
}

function resposta({ status, corpo }: RespostaProgramada): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const SESSAO_UM = {
  accessToken: 'token-1',
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

const SESSAO_DOIS = { ...SESSAO_UM, accessToken: 'token-2' };

describe('Corridas de sessão', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------
  // Achado 2 — falha de renovação precisa encerrar a sessão observável
  // O cliente limpava o próprio token mas nada avisava a aplicação, que
  // continuava exibindo a interface autenticada sem token nenhum.
  // ---------------------------------------------
  it('avisa os assinantes quando a renovação falha em definitivo', async () => {
    const fetchFalso = vi.fn(async (url: string) =>
      url.endsWith('/auth/refresh')
        ? resposta({ status: 401, corpo: { message: 'sem sessão' } })
        : resposta({ status: 401, corpo: { message: 'expirado' } }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    const eventos: string[] = [];
    cliente.aoMudarSessao((evento) => eventos.push(evento.tipo));
    cliente.definirSessao(SESSAO_UM);

    await expect(cliente.get('/products')).rejects.toBeTruthy();

    expect(eventos).toContain('encerrada');
    expect(cliente.temSessao()).toBe(false);
  });

  it('publica a sessão renovada para que o usuário exibido acompanhe', async () => {
    let jaFalhou = false;
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return resposta({ status: 200, corpo: SESSAO_DOIS });
      }
      if (!jaFalhou) {
        jaFalhou = true;
        return resposta({ status: 401, corpo: { message: 'expirado' } });
      }
      return resposta({ status: 200, corpo: { ok: true } });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    cliente.definirSessao(SESSAO_UM);

    // A assinatura começa depois da sessão inicial: interessa o que a
    // renovação publica, não o login que a precedeu.
    const recebidos: unknown[] = [];
    cliente.aoMudarSessao((evento) => {
      if (evento.tipo === 'renovada') {
        recebidos.push(evento.sessao);
      }
    });

    await cliente.get('/products');

    expect(recebidos).toEqual([SESSAO_DOIS]);
  });

  it('permite cancelar a assinatura', async () => {
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    const eventos: string[] = [];
    const cancelar = cliente.aoMudarSessao((e) => eventos.push(e.tipo));

    cancelar();
    cliente.definirSessao(SESSAO_UM);

    expect(eventos).toHaveLength(0);
  });

  // ---------------------------------------------
  // Achado 3 — 401 atrasado não pode disparar segunda rotação
  // A requisição que saiu com o token antigo volta depois que a renovação já
  // terminou. Renovar de novo apresentaria ao backend um refresh já usado,
  // que o trata como reuso e revoga a família inteira de tokens.
  // ---------------------------------------------
  it('repete com o token novo em vez de renovar outra vez', async () => {
    const atrasada = promessaControlada<void>();
    let renovacoes = 0;
    let pedidosProtegidos = 0;

    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        renovacoes += 1;
        return resposta({ status: 200, corpo: SESSAO_DOIS });
      }
      pedidosProtegidos += 1;
      const autorizacao = new Headers(init?.headers).get('Authorization');
      if (pedidosProtegidos === 2) {
        // Requisição que saiu com o token velho e só volta depois que a
        // renovação disparada pela primeira já terminou.
        await atrasada.promessa;
      }
      return autorizacao === 'Bearer token-2'
        ? resposta({ status: 200, corpo: { ok: true } })
        : resposta({ status: 401, corpo: { message: 'expirado' } });
    });

    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    cliente.definirSessao(SESSAO_UM);

    const primeira = cliente.get('/products');
    const segunda = cliente.get('/orders');

    await primeira;
    atrasada.resolver();
    await segunda;

    expect(renovacoes).toBe(1);
  });

  it('para de tentar renovar depois de uma falha terminal', async () => {
    const fetchFalso = vi.fn(async (url: string) =>
      url.endsWith('/auth/refresh')
        ? resposta({ status: 401, corpo: { message: 'sem sessão' } })
        : resposta({ status: 401, corpo: { message: 'expirado' } }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    cliente.definirSessao(SESSAO_UM);

    await expect(cliente.get('/products')).rejects.toBeTruthy();
    await expect(cliente.get('/categories')).rejects.toBeTruthy();

    const renovacoes = fetchFalso.mock.calls.filter((c) =>
      String(c[0]).endsWith('/auth/refresh'),
    );
    expect(renovacoes).toHaveLength(1);
  });

  it('volta a renovar depois de um login novo', async () => {
    let permitirRenovacao = false;
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return permitirRenovacao
          ? resposta({ status: 200, corpo: SESSAO_DOIS })
          : resposta({ status: 401, corpo: { message: 'sem sessão' } });
      }
      return resposta({ status: 401, corpo: { message: 'expirado' } });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    cliente.definirSessao(SESSAO_UM);

    await expect(cliente.get('/products')).rejects.toBeTruthy();

    permitirRenovacao = true;
    cliente.definirSessao(SESSAO_UM);
    await expect(cliente.get('/products')).rejects.toBeTruthy();

    const renovacoes = fetchFalso.mock.calls.filter((c) =>
      String(c[0]).endsWith('/auth/refresh'),
    );
    expect(renovacoes).toHaveLength(2);
  });

  // ---------------------------------------------
  // Achado 4 — resultado obsoleto não pode sobrescrever sessão mais nova
  // Uma renovação lenta que termina depois de o usuário ter entrado com outra
  // conta trocaria a sessão dele pela antiga, sem nenhum aviso.
  // ---------------------------------------------
  it('descarta renovação que termina depois de um login mais novo', async () => {
    const renovacaoLenta = promessaControlada<void>();
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        await renovacaoLenta.promessa;
        return resposta({ status: 200, corpo: SESSAO_DOIS });
      }
      return resposta({ status: 401, corpo: { message: 'expirado' } });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    cliente.definirSessao(SESSAO_UM);

    const pendente = cliente.get('/products').catch(() => undefined);

    const sessaoDeOutraConta = {
      ...SESSAO_UM,
      accessToken: 'token-de-outra-conta',
      user: { ...SESSAO_UM.user, id: 'u2', email: 'outro@b.com' },
    };
    cliente.definirSessao(sessaoDeOutraConta);

    renovacaoLenta.resolver();
    await pendente;

    expect(cliente.tokenAtual()).toBe('token-de-outra-conta');
  });

  it('descarta renovação que termina depois do logout', async () => {
    const renovacaoLenta = promessaControlada<void>();
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        await renovacaoLenta.promessa;
        return resposta({ status: 200, corpo: SESSAO_DOIS });
      }
      return resposta({ status: 401, corpo: { message: 'expirado' } });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    cliente.definirSessao(SESSAO_UM);

    const pendente = cliente.get('/products').catch(() => undefined);
    cliente.limparSessao();

    renovacaoLenta.resolver();
    await pendente;

    expect(cliente.temSessao()).toBe(false);
    expect(cliente.tokenAtual()).toBeNull();
  });
});
