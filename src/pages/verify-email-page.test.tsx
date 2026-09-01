import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { TelaDeVerificacaoDeEmail } from './verify-email-page';

// ---------------------------------------------
// Origem real do token: fragmento da URL, não query string
// O backend manda o link como .../verificar-email#token=XYZ, de propósito —
// fragmento não é enviado ao servidor HTTP e não aparece em log de acesso.
// A tela precisa ler daí, não de useSearchParams (que só vê ?token=).
// ---------------------------------------------
function montarComHash(hash: string, cliente: ApiClient) {
  window.history.pushState(null, '', `/verificar-email${hash}`);
  return render(
    <MemoryRouter initialEntries={[`/verificar-email${hash}`]}>
      <TelaDeVerificacaoDeEmail cliente={cliente} />
    </MemoryRouter>,
  );
}

describe('Verificação de email — origem do token', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('lê o token do fragmento da URL e confirma a verificação', async () => {
    const fetchFalso = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    );
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    montarComHash('#token=token-valido-do-email', cliente);

    await waitFor(() => {
      expect(screen.getByText(/email confirmado/i)).toBeInTheDocument();
    });

    const corpoEnviado = JSON.parse(
      String(fetchFalso.mock.calls[0][1]?.body),
    ) as { token: string };
    expect(corpoEnviado.token).toBe('token-valido-do-email');
  });

  it('mostra link incompleto quando não há token nem no fragmento nem na query', async () => {
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    montarComHash('', cliente);

    await waitFor(() => {
      expect(screen.getByText(/não deu certo/i)).toBeInTheDocument();
    });
  });

  it('limpa o fragmento da URL antes de enviar a requisição', async () => {
    const fetchFalso = vi.fn(async () => new Response(null, { status: 204 }));
    const cliente = new ApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: fetchFalso as unknown as typeof fetch,
    });

    montarComHash('#token=abc', cliente);

    await waitFor(() => {
      expect(window.location.hash).toBe('');
    });
  });
});
