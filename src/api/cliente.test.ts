import { describe, expect, it } from 'vitest';
import { ApiError, ApiClient } from './cliente';

// ---------------------------------------------
// Resposta falsa
// Só o que ApiClient.interpretar realmente consome: status, ok e json(). Não
// é um Response completo de propósito — fingir a interface inteira daria a
// impressão de fidelidade que o teste não tem.
// ---------------------------------------------
function resposta(status: number, corpo: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

const SESSAO_RENOVADA = {
  tokenDeAcesso: 'token-novo',
  tipoDoToken: 'Bearer',
  expiraEm: 900,
  usuario: {
    id: 'id-do-usuario',
    email: 'dono@teste.com',
    emailVerificado: true,
    criadoEm: new Date().toISOString(),
    papel: 'CLIENTE',
  },
};

// ---------------------------------------------
// Fila de renovação do ApiClient
// Armadilha nº 1 do CLAUDE.md: o refresh é rotativo, cada uso invalida o
// anterior. Sem uma promessa única compartilhada, várias requisições levando
// 401 ao mesmo tempo disparam vários POST /auth/refresh — o primeiro funciona
// e os demais apresentam um refresh já consumido, que o backend trata como
// reuso e responde revogando a sessão inteira. O usuário cai sem ter feito
// nada. Este teste falha se a fila for removida.
// ---------------------------------------------
describe('ApiClient — fila de renovação', () => {
  function criarCliente(opcoes: { falharRenovacao?: boolean } = {}) {
    const chamadas: string[] = [];
    let tokenValido = false;

    const fetchFalso = ((url: string): Promise<Response> => {
      chamadas.push(url);

      if (url.endsWith('/auth/refresh')) {
        if (opcoes.falharRenovacao) {
          return Promise.resolve(resposta(401, { message: 'refresh inválido' }));
        }
        tokenValido = true;
        return Promise.resolve(resposta(200, SESSAO_RENOVADA));
      }

      return Promise.resolve(
        tokenValido
          ? resposta(200, { ok: true })
          : resposta(401, { message: 'token expirado' }),
      );
    }) as unknown as typeof fetch;

    const cliente = new ApiClient({
      baseUrl: 'http://api.teste',
      fetchImpl: fetchFalso,
      canalDeSessao: `teste-${Math.random()}`,
    });

    return { cliente, chamadas };
  }

  it('cinco requisições simultâneas com 401 disparam UMA única renovação', async () => {
    const { cliente, chamadas } = criarCliente();
    cliente.definirSessao(
      { ...SESSAO_RENOVADA, tokenDeAcesso: 'token-velho' } as never,
      false,
    );

    await Promise.all([
      cliente.get('/orders'),
      cliente.get('/products'),
      cliente.get('/categories'),
      cliente.get('/orders/1'),
      cliente.get('/auth/me'),
    ]);

    const renovacoes = chamadas.filter((url) => url.endsWith('/auth/refresh'));
    expect(renovacoes).toHaveLength(1);
  });

  it('todas as requisições enfileiradas terminam com sucesso após a renovação', async () => {
    const { cliente } = criarCliente();
    cliente.definirSessao(
      { ...SESSAO_RENOVADA, tokenDeAcesso: 'token-velho' } as never,
      false,
    );

    const resultados = await Promise.all([
      cliente.get<{ ok: boolean }>('/orders'),
      cliente.get<{ ok: boolean }>('/products'),
    ]);

    expect(resultados).toEqual([{ ok: true }, { ok: true }]);
  });

  it('renovação que falha encerra a sessão em vez de deixar token morto', async () => {
    const { cliente } = criarCliente({ falharRenovacao: true });
    cliente.definirSessao(
      { ...SESSAO_RENOVADA, tokenDeAcesso: 'token-velho' } as never,
      false,
    );

    await expect(cliente.get('/orders')).rejects.toBeInstanceOf(ApiError);
    expect(cliente.temSessao()).toBe(false);
  });

  it('401 em rota de credencial não dispara renovação', async () => {
    const { cliente, chamadas } = criarCliente();

    // senha errada no login responde 401; tratar como sessão expirada faria a
    // mensagem do refresh sobrescrever a real — armadilha nº 2 do CLAUDE.md
    await expect(
      cliente.post('/auth/login', { email: 'a@b.c', senha: 'errada' }),
    ).rejects.toBeInstanceOf(ApiError);

    const renovacoes = chamadas.filter((url) => url.endsWith('/auth/refresh'));
    expect(renovacoes).toHaveLength(0);
  });
});
