import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { listarPedidos } from '../../api/pedidos';
import type { Pedido } from '../../api/pedidos';
import { ApiError, type ApiClient } from '../../api/cliente';
import { TelaDeDetalheDoPedido } from '../pedidos/tela-de-detalhe-do-pedido';
import { TelaDePedidosAdmin } from './tela-de-pedidos-admin';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function criarPedido(situacao: Pedido['situacao'] = 'PENDENTE'): Pedido {
  return {
    id: 12,
    situacao,
    subtotalEmCentavos: 4500,
    freteEmCentavos: 0,
    modalidadeDeFrete: 'PAC',
    prazoEmDiasUteis: 5,
    totalEmCentavos: 4500,
    criadoEm: '2026-09-08T12:00:00Z',
    usuarioId: 'cliente-teste',
    chaveDeIdempotencia: null,
    hashDoPayload: null,
    enderecoId: 1,
    enderecoDestinatario: 'Fulano de Tal',
    enderecoCep: '01310100',
    enderecoLogradouro: 'Av. Paulista',
    enderecoNumero: '1000',
    enderecoComplemento: null,
    enderecoBairro: 'Bela Vista',
    enderecoCidade: 'São Paulo',
    enderecoUf: 'SP',
    itens: [
      {
        id: 1,
        pedidoId: 12,
        produtoId: 9,
        nomeDoProduto: 'Produto da compra',
        precoUnitarioEmCentavos: 1500,
        quantidade: 3,
      },
    ],
  };
}

function abrirDetalhe(
  get: ReturnType<typeof vi.fn>,
  patch = vi.fn(),
  contexto: 'cliente' | 'admin' = 'admin',
  id = '12',
) {
  render(
    <StrictMode>
      <MemoryRouter
        initialEntries={[`/admin/pedidos/${id}?situacao=PENDENTE&pagina=2`]}
      >
        <LocalDaPagina />
        <Routes>
          <Route
            path="/admin/pedidos/:id"
            element={
              <TelaDeDetalheDoPedido
                cliente={{ get, patch } as unknown as ApiClient}
                contexto={contexto}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

function abrirDetalheDoCliente(
  get: ReturnType<typeof vi.fn>,
  post = vi.fn(),
  patch = vi.fn(),
) {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/pedidos/12']}>
        <Routes>
          <Route
            path="/pedidos/:id"
            element={
              <TelaDeDetalheDoPedido
                cliente={{ get, post, patch } as unknown as ApiClient}
                contexto="cliente"
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

function criarPagamento(
  status: 'APROVADO' | 'RECUSADO',
  motivoDeRecusa: string | null = null,
) {
  return {
    id: 1,
    pedidoId: 12,
    status,
    ultimosDigitosDoCartao: '1111',
    motivoDeRecusa,
    criadoEm: '2026-09-10T12:00:00Z',
    atualizadoEm: '2026-09-10T12:00:00Z',
  };
}

async function pagarCom(cartao: string) {
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Número do cartão' }),
    {
      target: { value: cartao },
    },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
}

// ---------------------------------------------
// Pagamento na tela de detalhe
// A recusa é um resultado, não uma falha: mantém o formulário para nova
// tentativa. Já uma exceção é ambígua — o pagamento pode ter sido processado
// e só a confirmação ter se perdido —, então precisa cair no mesmo bloqueio
// de "Atualizar pedido" que as outras escritas usam, em vez de convidar a
// pagar de novo às cegas sobre um pedido possivelmente já pago.
// ---------------------------------------------
describe('Pagamento', () => {
  it('cartão recusado mantém o formulário e mostra o motivo', async () => {
    const post = vi
      .fn()
      .mockResolvedValue(
        criarPagamento(
          'RECUSADO',
          'Cartão recusado pela operadora (simulado).',
        ),
      );
    abrirDetalheDoCliente(vi.fn().mockResolvedValue(criarPedido()), post);

    await pagarCom('4000000000000002');

    await screen.findByText('Cartão recusado pela operadora (simulado).');
    expect(
      (screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      screen.queryByRole('button', { name: 'Atualizar pedido' }),
    ).toBeNull();
  });

  it('aprovação recarrega o pedido e o formulário some', async () => {
    let pagou = false;
    const get = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(pagou ? criarPedido('PAGO') : criarPedido()),
      );
    const post = vi.fn().mockImplementation(() => {
      pagou = true;
      return Promise.resolve(criarPagamento('APROVADO'));
    });
    abrirDetalheDoCliente(get, post);

    await pagarCom('4111111111111111');

    await screen.findByText('Pago');
    expect(post).toHaveBeenCalledWith('/orders/12/payments', {
      numeroDoCartao: '4111111111111111',
    });
    expect(screen.queryByRole('button', { name: 'Pagar' })).toBeNull();
  });

  it('falha ambígua bloqueia nova tentativa até consultar a situação real', async () => {
    const get = vi.fn().mockResolvedValue(criarPedido());
    const post = vi.fn().mockRejectedValue(new TypeError('rede indisponível'));
    abrirDetalheDoCliente(get, post);

    await pagarCom('4111111111111111');

    await screen.findByText(
      /Não foi possível confirmar o resultado do pagamento/,
    );
    expect(
      (screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    get.mockResolvedValue(criarPedido('PAGO'));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar pedido' }));

    await screen.findByText('Pago');
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pagar' })).toBeNull();
  });

  it('perda da leitura após pagamento aprovado também bloqueia, sem repetir o pagamento', async () => {
    let pagou = false;
    const get = vi
      .fn()
      .mockImplementation(() =>
        pagou
          ? Promise.reject(new TypeError('rede indisponível'))
          : Promise.resolve(criarPedido()),
      );
    const post = vi.fn().mockImplementation(() => {
      pagou = true;
      return Promise.resolve(criarPagamento('APROVADO'));
    });
    abrirDetalheDoCliente(get, post);

    await pagarCom('4111111111111111');

    await screen.findByText(
      /Não foi possível confirmar o resultado do pagamento/,
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe('Contrato de pedidos', () => {
  it('envia o filtro de situação junto com a página e o sinal de cancelamento', async () => {
    const get = vi.fn().mockResolvedValue({ dados: [] });
    const cliente = { get } as unknown as ApiClient;
    const sinal = new AbortController().signal;
    await listarPedidos(cliente, 2, sinal, 'PAGO');
    expect(get).toHaveBeenCalledWith('/orders?pagina=2&situacao=PAGO', {
      signal: sinal,
    });
  });

  it('preserva a consulta do cliente quando nenhum filtro é fornecido', async () => {
    const get = vi.fn().mockResolvedValue({ dados: [] });
    const sinal = new AbortController().signal;
    await listarPedidos({ get } as unknown as ApiClient, 1, sinal);
    expect(get).toHaveBeenCalledWith('/orders?pagina=1', { signal: sinal });
  });
});

function LocalDaPagina() {
  const local = useLocation();
  const navegar = useNavigate();
  return (
    <>
      <output data-testid="local">
        {local.pathname}
        {local.search}
      </output>
      <button onClick={() => navegar(-1)}>Voltar no navegador</button>
      <button onClick={() => navegar('/admin/pedidos/13')}>Outro pedido</button>
    </>
  );
}

function abrirLista(get: ReturnType<typeof vi.fn>, consulta = '') {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/admin/pedidos${consulta}`]}>
        <LocalDaPagina />
        <Routes>
          <Route
            path="/admin/pedidos"
            element={
              <TelaDePedidosAdmin cliente={{ get } as unknown as ApiClient} />
            }
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('Listagem administrativa', () => {
  it('lê página e situação da URL, reinicia página ao filtrar e acompanha Voltar', async () => {
    const get = vi.fn().mockResolvedValue({
      dados: [criarPedido()],
      total: 30,
      pagina: 2,
      limite: 20,
    });
    abrirLista(get, '?situacao=PENDENTE&pagina=2');
    await screen.findByRole('link', { name: '#12' });
    expect(get).toHaveBeenCalledWith(
      '/orders?pagina=2&situacao=PENDENTE',
      expect.anything(),
    );
    fireEvent.change(screen.getByLabelText('Situação'), {
      target: { value: 'PAGO' },
    });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        '/orders?pagina=1&situacao=PAGO',
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('local').textContent).toContain('pagina=1');
    fireEvent.click(
      screen.getByRole('button', { name: 'Voltar no navegador' }),
    );
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Situação') as HTMLSelectElement).value,
      ).toBe('PENDENTE'),
    );
  });

  it('preserva o filtro no link para detalhe', async () => {
    abrirLista(
      vi.fn().mockResolvedValue({
        dados: [criarPedido('PAGO')],
        total: 1,
        pagina: 1,
        limite: 20,
      }),
      '?situacao=PAGO',
    );
    expect(
      (await screen.findByRole('link', { name: '#12' })).getAttribute('href'),
    ).toBe('/admin/pedidos/12?situacao=PAGO');
  });

  it('normaliza parâmetros inválidos antes de consultar a API', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ dados: [], total: 0, pagina: 1, limite: 20 });
    abrirLista(get, '?situacao=XPTO&pagina=1e100');
    await screen.findByText('Nenhum pedido encontrado.');
    expect(get.mock.calls.every(([url]) => url === '/orders?pagina=1')).toBe(
      true,
    );
  });

  it('descarta resposta antiga após mudar o filtro mesmo quando transporte ignora aborto', async () => {
    let concluir!: (valor: unknown) => void;
    const get = vi.fn().mockImplementation((url: string) =>
      url.includes('PENDENTE')
        ? new Promise((resolve) => {
            concluir = resolve;
          })
        : Promise.resolve({ dados: [], total: 0, pagina: 1, limite: 20 }),
    );
    abrirLista(get, '?situacao=PENDENTE');
    fireEvent.change(screen.getByLabelText('Situação'), {
      target: { value: 'CANCELADO' },
    });
    await screen.findByText('Nenhum pedido encontrado nesta situação.');
    await act(async () =>
      concluir({ dados: [criarPedido()], total: 1, pagina: 1, limite: 20 }),
    );
    expect(screen.queryByRole('link', { name: '#12' })).toBeNull();
  });

  it('distingue falha de vazio e permite nova tentativa', async () => {
    const get = vi.fn().mockRejectedValue(new Error('rede'));
    abrirLista(get);
    await screen.findByRole('alert');
    expect(screen.queryByText('Nenhum pedido encontrado.')).toBeNull();
    get.mockResolvedValue({ dados: [], total: 0, pagina: 1, limite: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Nenhum pedido encontrado.');
  });
});

describe('Detalhe e transições', () => {
  it('não aplica resposta de escrita do pedido anterior depois de navegar', async () => {
    let concluir!: (pedido: Pedido) => void;
    const get = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ...criarPedido('PAGO'),
        id: Number(url.split('/').pop()),
      }),
    );
    const patch = vi.fn().mockImplementation(
      () =>
        new Promise<Pedido>((resolve) => {
          concluir = resolve;
        }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrirDetalhe(get, patch);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Marcar como enviado' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Outro pedido' }));
    await screen.findByRole('heading', { name: 'Pedido #13' });
    await act(async () => concluir(criarPedido('ENVIADO')));
    expect(screen.queryByRole('heading', { name: 'Pedido #12' })).toBeNull();
    expect(screen.queryByText('Pedido marcado como enviado.')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Marcar como enviado' }),
    ).toBeTruthy();
  });

  it('não oferece a nenhum contexto o registro manual de pagamento', async () => {
    const patch = vi.fn();
    abrirDetalhe(vi.fn().mockResolvedValue(criarPedido()), patch);
    await screen.findByText('Produto da compra');
    expect(screen.queryByRole('button', { name: /pago/i })).toBeNull();
    expect(patch).not.toHaveBeenCalled();
  });

  it('não aplica leitura atrasada do pedido anterior depois de navegar', async () => {
    let concluir!: (pedido: Pedido) => void;
    const get = vi.fn().mockImplementation((url: string) =>
      url === '/orders/12'
        ? new Promise<Pedido>((resolve) => {
            concluir = resolve;
          })
        : Promise.resolve({ ...criarPedido('CANCELADO'), id: 13 }),
    );
    abrirDetalhe(get);
    fireEvent.click(screen.getByRole('button', { name: 'Outro pedido' }));
    await screen.findByRole('heading', { name: 'Pedido #13' });
    await act(async () => concluir(criarPedido()));
    expect(screen.queryByRole('heading', { name: 'Pedido #12' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Marcar como enviado' }),
    ).toBeNull();
  });

  it('mantém cancelamento de pendente no contexto do cliente', async () => {
    const patch = vi.fn().mockResolvedValue(criarPedido('CANCELADO'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrirDetalhe(vi.fn().mockResolvedValue(criarPedido()), patch, 'cliente');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancelar pedido' }),
    );
    await screen.findByText('Pedido cancelado. Estoque devolvido.');
    expect(patch).toHaveBeenCalledWith('/orders/12/status', {
      situacao: 'CANCELADO',
    });
    expect(
      screen
        .getByRole('link', { name: /Voltar para meus pedidos/ })
        .getAttribute('href'),
    ).toBe('/pedidos');
  });

  it('conserva bloqueio quando a leitura de recuperação também falha', async () => {
    const get = vi.fn().mockResolvedValue(criarPedido('PAGO'));
    const patch = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'Pedido já alterado'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrirDetalhe(get, patch);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Marcar como enviado' }),
    );
    await screen.findByText(/Pedido já alterado/);
    get.mockRejectedValue(new ApiError(503, 'Leitura indisponível'));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar pedido' }));
    await screen.findByText('Leitura indisponível');
    expect(
      (
        screen.getByRole('button', {
          name: 'Marcar como enviado',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Cancelar pedido',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText('Produto da compra')).toBeTruthy();
    expect(patch).toHaveBeenCalledTimes(1);
  });
  it('permite ao admin marcar como enviado e conserva os itens e o retorno filtrado', async () => {
    const patch = vi.fn().mockResolvedValue(criarPedido('ENVIADO'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrirDetalhe(vi.fn().mockResolvedValue(criarPedido('PAGO')), patch);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Marcar como enviado' }),
    );
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/orders/12/status', {
        situacao: 'ENVIADO',
      }),
    );
    await screen.findByText('Enviado');
    expect(screen.getByText('Produto da compra')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /Voltar para pedidos/ })
        .getAttribute('href'),
    ).toBe('/admin/pedidos?situacao=PENDENTE&pagina=2');
    expect(
      screen.queryByRole('button', { name: 'Marcar como enviado' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Marcar como entregue' }),
    ).toBeTruthy();
  });

  it('exige confirmação para cancelar um pedido pago e explica o efeito', async () => {
    const patch = vi.fn();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrirDetalhe(vi.fn().mockResolvedValue(criarPedido('PAGO')), patch);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancelar pedido' }),
    );
    expect(confirmar.mock.calls[0][0]).toMatch(/estoque/i);
    expect(confirmar.mock.calls[0][0]).toMatch(/reembolso/i);
    expect(patch).not.toHaveBeenCalled();
  });

  it('mantém cliente sem ação de logística ou cancelamento de pago', async () => {
    abrirDetalhe(
      vi.fn().mockResolvedValue(criarPedido('PAGO')),
      vi.fn(),
      'cliente',
    );
    await screen.findByText('Produto da compra');
    expect(
      screen.queryByRole('button', { name: 'Marcar como enviado' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Cancelar pedido' }),
    ).toBeNull();
  });

  it('mantém cancelado como terminal', async () => {
    abrirDetalhe(vi.fn().mockResolvedValue(criarPedido('CANCELADO')));
    await screen.findByText('Produto da compra');
    expect(
      screen.queryByRole('button', { name: 'Marcar como enviado' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Cancelar pedido' }),
    ).toBeNull();
  });

  it('após resposta perdida, bloqueia nova escrita até consultar a situação atual', async () => {
    const get = vi.fn().mockResolvedValue(criarPedido('PAGO'));
    const patch = vi.fn().mockRejectedValue(new TypeError('rede indisponível'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrirDetalhe(get, patch);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Marcar como enviado' }),
    );
    await screen.findByRole('alert');
    expect(screen.getByText('Produto da compra')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'Cancelar pedido',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    get.mockResolvedValue(criarPedido('ENVIADO'));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar pedido' }));
    await screen.findByText('Enviado');
    expect(patch).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Marcar como enviado' }),
    ).toBeNull();
  });

  it('oferece nova tentativa quando a leitura falha', async () => {
    const get = vi
      .fn()
      .mockRejectedValue(new ApiError(503, 'Serviço indisponível'));
    abrirDetalhe(get);
    await screen.findByRole('alert');
    get.mockResolvedValue(criarPedido());
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Produto da compra');
  });

  it('não envia identificador inválido ao servidor', async () => {
    const get = vi.fn();
    abrirDetalhe(get, vi.fn(), 'admin', 'NaN');
    await screen.findByText('Identificador de pedido inválido.');
    expect(get).not.toHaveBeenCalled();
  });

  it('bloqueia as duas ações enquanto a escrita está em andamento', async () => {
    let concluir!: (pedido: Pedido) => void;
    const patch = vi.fn().mockImplementation(
      () =>
        new Promise<Pedido>((resolve) => {
          concluir = resolve;
        }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrirDetalhe(vi.fn().mockResolvedValue(criarPedido('PAGO')), patch);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Marcar como enviado' }),
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Cancelar pedido',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => concluir(criarPedido('ENVIADO')));
    expect(patch).toHaveBeenCalledTimes(1);
  });
});
