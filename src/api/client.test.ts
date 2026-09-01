import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

// ---------------------------------------------
// Dublê de fetch controlável por rota
// Permite simular 401 nas rotas de dados e decidir, por teste, se o refresh
// funciona ou falha — sem depender do backend real.
// ---------------------------------------------
function criarFetchFalso(opcoes: {
  refreshFunciona: boolean;
  falhasAntesDeAutorizar?: number;
}) {
  const chamadas = { refresh: 0, dados: 0 };
  let falhasRestantes = opcoes.falhasAntesDeAutorizar ?? 1;

  const fetchFalso = vi.fn(
    async (entrada: string, init?: RequestInit): Promise<Response> => {
      if (entrada.endsWith('/auth/refresh')) {
        chamadas.refresh += 1;
        if (!opcoes.refreshFunciona) {
          return new Response(JSON.stringify({ message: 'sessão expirada' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            accessToken: 'token-novo',
            tokenType: 'Bearer',
            expiresIn: 900,
            user: { id: 'u1', email: 'a@b.com', role: 'CLIENTE' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      chamadas.dados += 1;
      const autorizacao = new Headers(init?.headers).get('Authorization');
      if (autorizacao !== 'Bearer token-novo' && falhasRestantes > 0) {
        falhasRestantes -= 1;
        return new Response(JSON.stringify({ message: 'não autorizado' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true, autorizacao }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  );

  return { fetchFalso, chamadas };
}

describe('Cliente HTTP', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------
  // Renovação concorrente de sessão
  // O refresh do backend é rotativo: cada uso invalida o anterior. Se três
  // requisições tomarem 401 juntas e as três chamarem /auth/refresh, só a
  // primeira funciona e o usuário cai sem motivo. A fila existe para isso.
  // ---------------------------------------------
  it('dispara um único refresh quando várias requisições recebem 401 ao mesmo tempo', async () => {
    const { fetchFalso, chamadas } = criarFetchFalso({
      refreshFunciona: true,
      falhasAntesDeAutorizar: 3,
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const resultados = await Promise.all([
      cliente.get('/products'),
      cliente.get('/categories'),
      cliente.get('/orders'),
    ]);

    expect(chamadas.refresh).toBe(1);
    expect(resultados).toHaveLength(3);
  });

  it('reexecuta as requisições com o token renovado', async () => {
    const { fetchFalso } = criarFetchFalso({
      refreshFunciona: true,
      falhasAntesDeAutorizar: 2,
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    const [primeira, segunda] = await Promise.all([
      cliente.get<{ autorizacao: string }>('/products'),
      cliente.get<{ autorizacao: string }>('/orders'),
    ]);

    expect(primeira.autorizacao).toBe('Bearer token-novo');
    expect(segunda.autorizacao).toBe('Bearer token-novo');
  });

  it('avisa a sessão expirada uma única vez quando o refresh falha', async () => {
    const { fetchFalso, chamadas } = criarFetchFalso({
      refreshFunciona: false,
      falhasAntesDeAutorizar: 3,
    });
    // Sem callback no construtor: a aplicação real assina o evento depois de
    // criar o cliente, e o teste precisa exercitar o mesmo caminho para não
    // aprovar um comportamento que só existe aqui.
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    const encerramentos: string[] = [];
    cliente.aoMudarSessao((evento) => {
      if (evento.tipo === 'encerrada') {
        encerramentos.push(evento.tipo);
      }
    });

    const resultados = await Promise.allSettled([
      cliente.get('/products'),
      cliente.get('/categories'),
      cliente.get('/orders'),
    ]);

    expect(resultados.every((r) => r.status === 'rejected')).toBe(true);
    expect(chamadas.refresh).toBe(1);
    expect(encerramentos).toHaveLength(1);
  });

  // ---------------------------------------------
  // Repasse de erro da API
  // ---------------------------------------------
  it('expõe a mensagem devolvida pela API no erro', async () => {
    const fetchFalso = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Estoque insuficiente' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    await expect(cliente.get('/products')).rejects.toMatchObject({
      status: 400,
      message: 'Estoque insuficiente',
    });
  });

  it('junta as mensagens quando a validação devolve uma lista', async () => {
    const fetchFalso = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ message: ['email inválido', 'senha curta'] }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    await expect(cliente.get('/auth/register')).rejects.toThrow(
      'email inválido, senha curta',
    );
  });

  // ---------------------------------------------
  // Erro de credencial não vira tentativa de renovação
  // Senha errada devolve 401, mas não é sessão expirada. Renovar aqui trocaria
  // a mensagem real pela do refresh, e o usuário leria "não foi possível
  // renovar a sessão" depois de apenas errar a senha.
  // ---------------------------------------------
  it('preserva a mensagem do login quando a credencial é inválida', async () => {
    const chamadas: string[] = [];
    const fetchFalso = vi.fn(async (entrada: string): Promise<Response> => {
      chamadas.push(entrada);
      const mensagem = entrada.endsWith('/auth/login')
        ? 'Email ou senha inválidos.'
        : 'Não foi possível renovar a sessão.';
      return new Response(JSON.stringify({ message: mensagem }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    await expect(
      cliente.post('/auth/login', { email: 'a@b.com', password: 'errada' }),
    ).rejects.toThrow('Email ou senha inválidos.');
    expect(chamadas.some((url) => url.endsWith('/auth/refresh'))).toBe(false);
  });

  it('renova a sessão quando uma rota protegida devolve 401', async () => {
    const { fetchFalso, chamadas } = criarFetchFalso({
      refreshFunciona: true,
      falhasAntesDeAutorizar: 1,
    });
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    await cliente.get('/auth/me');

    expect(chamadas.refresh).toBe(1);
  });

  it('não tenta renovar sessão quando a própria rota de refresh devolve 401', async () => {
    const fetchFalso = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'sem sessão' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    await expect(cliente.post('/auth/refresh')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------
  // Envio do cookie de sessão
  // O refresh vive num cookie httpOnly; sem credentials as requisições saem
  // sem ele e a renovação nunca funciona.
  // ---------------------------------------------
  it('envia credenciais em todas as requisições', async () => {
    const fetchFalso = vi.fn(
      async (_entrada: string, _init?: RequestInit): Promise<Response> =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    await cliente.get('/products');

    expect(fetchFalso.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
    });
  });

  // ---------------------------------------------
  // Cancelamento de requisição
  // Filtros de busca disparam uma requisição por mudança; sem repassar o
  // signal ao fetch real, não há como cancelar a chamada anterior quando uma
  // nova é disparada.
  // ---------------------------------------------
  it('repassa o AbortSignal para a requisição real', async () => {
    const fetchFalso = vi.fn(
      async (_url: string, _init?: RequestInit): Promise<Response> =>
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    const controlador = new AbortController();

    await cliente.get('/products', { signal: controlador.signal });

    expect(fetchFalso.mock.calls[0][1]).toMatchObject({
      signal: controlador.signal,
    });
  });

  it('rejeita com AbortError quando a requisição é cancelada', async () => {
    const fetchFalso = vi.fn(
      async (_url: string, _init?: RequestInit): Promise<Response> => {
        const sinal = _init?.signal;
        return new Promise((_resolve, reject) => {
          sinal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      },
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });
    const controlador = new AbortController();

    const chamada = cliente.get('/products', { signal: controlador.signal });
    controlador.abort();

    await expect(chamada).rejects.toMatchObject({ name: 'AbortError' });
  });
});
