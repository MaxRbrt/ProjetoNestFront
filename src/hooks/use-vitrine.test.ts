import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/cliente';
import type { Paginado, Produto } from '../api/produtos';
import { useVitrine } from './use-vitrine';

const PAGINA_VAZIA: Paginado<Produto> = {
  dados: [],
  total: 0,
  pagina: 1,
  limite: 8,
};

// ---------------------------------------------
// Leituras independentes da home
// Uma resposta antiga não pode substituir a vitrine atual, mesmo se o
// transporte ignorar AbortSignal. Nenhum teste acessa o banco real.
// ---------------------------------------------
describe('useVitrine', () => {
  it('pede a primeira página com limite e ordenação', async () => {
    const get = vi.fn().mockResolvedValue(PAGINA_VAZIA);
    const { result } = renderHook(() =>
      useVitrine({ get } as unknown as ApiClient, {
        ordenarPor: 'preco',
        direcao: 'asc',
        limite: 8,
      }),
    );
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const parametros = new URLSearchParams(get.mock.calls[0][0].split('?')[1]);
    expect(Object.fromEntries(parametros)).toEqual({
      pagina: '1',
      ordenarPor: 'preco',
      direcao: 'asc',
      limite: '8',
    });
    expect(result.current.produtos).toEqual([]);
  });

  it('omite a ordenação padrão e aborta ao desmontar', async () => {
    const get = vi.fn().mockResolvedValue(PAGINA_VAZIA);
    const { unmount } = renderHook(() =>
      useVitrine({ get } as unknown as ApiClient, { limite: 8 }),
    );
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0]).toBe('/products?pagina=1&limite=8');
    const sinal = get.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(sinal.aborted).toBe(true);
  });

  it('descarta resposta antiga após trocar a ordenação', async () => {
    let resolverAntiga!: (pagina: Paginado<Produto>) => void;
    const antiga = new Promise<Paginado<Produto>>((resolve) => {
      resolverAntiga = resolve;
    });
    const get = vi
      .fn()
      .mockReturnValueOnce(antiga)
      .mockResolvedValue(PAGINA_VAZIA);
    const cliente = { get } as unknown as ApiClient;
    const { result, rerender } = renderHook(
      ({ direcao }: { direcao: 'asc' | 'desc' }) =>
        useVitrine(cliente, { ordenarPor: 'preco', direcao, limite: 8 }),
      { initialProps: { direcao: 'asc' } },
    );
    rerender({ direcao: 'desc' });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () =>
      resolverAntiga({ ...PAGINA_VAZIA, dados: [{ id: 99 } as Produto] }),
    );
    expect(result.current.produtos).toEqual([]);
    expect(get.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('expõe falha sem deixar carregamento pendente', async () => {
    const get = vi.fn().mockRejectedValue(new Error('Falha simulada'));
    const { result } = renderHook(() =>
      useVitrine({ get } as unknown as ApiClient, { limite: 8 }),
    );
    await waitFor(() => expect(result.current.erro).toBeTruthy());
    expect(result.current.carregando).toBe(false);
    expect(result.current.produtos).toEqual([]);
  });
});
