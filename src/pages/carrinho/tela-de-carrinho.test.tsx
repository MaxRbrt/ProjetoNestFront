import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../api/cliente';
import { TelaDeCarrinho } from './tela-de-carrinho';

// ---------------------------------------------
// Carrinho controlado pelo teste
// Substituir o contexto evita montar ProvedorDoCarrinho real e localStorage
// para uma suíte que é sobre a tela, não sobre a persistência do carrinho.
// ---------------------------------------------
let itensDoCarrinho: { produtoId: number; quantidade: number }[] = [];
const limparCarrinho = vi.fn();
const atualizarQuantidade = vi.fn();
const removerItem = vi.fn();

vi.mock('../../auth/contexto-do-carrinho', () => ({
  useCarrinho: () => ({
    itens: itensDoCarrinho,
    atualizarQuantidade,
    removerItem,
    limpar: limparCarrinho,
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const PRODUTO = {
  id: 1,
  nome: 'Mouse sem fio',
  precoEmCentavos: 12990,
  estoque: 5,
  categoriaId: 2,
  nomeDoArquivoDaImagem: null,
};

const ENDERECO = {
  id: 7,
  apelido: 'Casa',
  destinatario: 'Fulano',
  cep: '01310100',
  logradouro: 'Av. Paulista',
  numero: '1000',
  complemento: null,
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP',
  principal: true,
  criadoEm: '2026-09-01T00:00:00Z',
};

const OPCOES_DE_FRETE = [
  { modalidade: 'PAC', custoEmCentavos: 3000, prazoEmDiasUteis: 12 },
  { modalidade: 'SEDEX', custoEmCentavos: 5200, prazoEmDiasUteis: 5 },
];

// ---------------------------------------------
// Cliente HTTP simulado por rota
// `get` responde produto e endereços; `post` responde cotação de frete e
// criação de pedido. `enderecos` e `respostaDoPedido` são parâmetros para que
// cada teste componha o cenário sem duplicar a função inteira.
// ---------------------------------------------
function montarCliente(opcoes: {
  falharProdutos?: () => boolean;
  enderecos?: (typeof ENDERECO)[];
  aoCriarPedido?: (chave: string | undefined) => Promise<unknown>;
}) {
  const enderecos = opcoes.enderecos ?? [ENDERECO];
  const post = vi.fn(
    (
      caminho: string,
      _corpo: unknown,
      config?: { cabecalhos?: Record<string, string> },
    ) => {
      if (caminho === '/shipping/quote') {
        return Promise.resolve(OPCOES_DE_FRETE);
      }
      if (caminho === '/orders') {
        const chave = config?.cabecalhos?.['Idempotency-Key'];
        return opcoes.aoCriarPedido
          ? opcoes.aoCriarPedido(chave)
          : Promise.resolve({ id: 99 });
      }
      return Promise.reject(new Error(`rota inesperada: ${caminho}`));
    },
  );
  const get = vi.fn((caminho: string) => {
    if (caminho.startsWith('/products/')) {
      if (opcoes.falharProdutos?.())
        return Promise.reject(new Error('rede indisponível'));
      return Promise.resolve(PRODUTO);
    }
    if (caminho === '/addresses') {
      return Promise.resolve(enderecos);
    }
    return Promise.reject(new Error(`rota inesperada: ${caminho}`));
  });
  return { get, post } as unknown as ApiClient;
}

function abrirCarrinho(cliente: ApiClient) {
  render(
    <MemoryRouter initialEntries={['/carrinho']}>
      <Routes>
        <Route
          path="/carrinho"
          element={<TelaDeCarrinho cliente={cliente} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Tela do carrinho', () => {
  it('distingue falha ao consultar produtos de carrinho vazio e permite repetir a leitura', async () => {
    itensDoCarrinho = [{ produtoId: 1, quantidade: 1 }];
    let falhar = true;
    const cliente = montarCliente({ falharProdutos: () => falhar });
    abrirCarrinho(cliente);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os produtos do carrinho.',
    );
    expect(
      screen.queryByText('Seu carrinho está vazio.'),
    ).not.toBeInTheDocument();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Mouse sem fio')).toBeInTheDocument();
  });

  it('carrinho vazio mostra "Ver catálogo"', async () => {
    itensDoCarrinho = [];
    abrirCarrinho(montarCliente({}));

    expect(
      await screen.findByRole('link', { name: 'Ver catálogo' }),
    ).toBeInTheDocument();
  });

  it('sem endereço cadastrado o botão de finalizar fica desabilitado com o motivo', async () => {
    itensDoCarrinho = [{ produtoId: 1, quantidade: 1 }];
    abrirCarrinho(montarCliente({ enderecos: [] }));

    await screen.findByText('Mouse sem fio');
    await screen.findByText('Cadastre um endereço de entrega para finalizar.');
    const botoes = screen.getAllByRole('button', { name: 'Finalizar pedido' });
    for (const botao of botoes) {
      expect(botao).toBeDisabled();
    }
  });

  // ---------------------------------------------
  // Motivo do bloqueio durante o carregamento dos endereços
  // Antes desta correção, a tela pulava a etapa de carregamento e afirmava
  // "Escolha uma modalidade de frete." enquanto ainda nem se sabia se havia
  // endereço — mensagem enganosa, já que a cotação de frete nem começou.
  // ---------------------------------------------
  it('endereços carregando mostra "Carregando endereços…", não o motivo de frete', async () => {
    itensDoCarrinho = [{ produtoId: 1, quantidade: 1 }];
    let liberarEnderecos!: () => void;
    const cliente = montarCliente({});
    (cliente.get as ReturnType<typeof vi.fn>).mockImplementation(
      (caminho: string) => {
        if (caminho.startsWith('/products/')) {
          return Promise.resolve(PRODUTO);
        }
        if (caminho === '/addresses') {
          return new Promise((resolve) => {
            liberarEnderecos = () => resolve([ENDERECO]);
          });
        }
        return Promise.reject(new Error(`rota inesperada: ${caminho}`));
      },
    );
    abrirCarrinho(cliente);

    await screen.findByText('Mouse sem fio');
    await screen.findAllByText('Carregando endereços…');
    expect(
      screen.queryByText('Escolha uma modalidade de frete.'),
    ).not.toBeInTheDocument();
    const botoes = screen.getAllByRole('button', { name: 'Finalizar pedido' });
    for (const botao of botoes) {
      expect(botao).toBeDisabled();
    }

    liberarEnderecos();
    await waitFor(() =>
      expect(
        screen.queryByText('Carregando endereços…'),
      ).not.toBeInTheDocument(),
    );
  });

  it('retry após falha de criarPedido reenvia a mesma Idempotency-Key', async () => {
    itensDoCarrinho = [{ produtoId: 1, quantidade: 1 }];
    let tentativa = 0;
    const chavesRecebidas: (string | undefined)[] = [];
    const cliente = montarCliente({
      aoCriarPedido: (chave) => {
        chavesRecebidas.push(chave);
        tentativa += 1;
        return tentativa === 1
          ? Promise.reject(new Error('rede indisponível'))
          : Promise.resolve({ id: 99 });
      },
    });
    abrirCarrinho(cliente);

    await screen.findByText('Mouse sem fio');
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Finalizar pedido' })[0],
      ).not.toBeDisabled(),
    );

    const [botao] = screen.getAllByRole('button', { name: 'Finalizar pedido' });
    fireEvent.click(botao);
    await screen.findByText(/Não foi possível finalizar o pedido agora\./);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Finalizar pedido' })[0],
    );
    await waitFor(() => expect(chavesRecebidas).toHaveLength(2));

    expect(chavesRecebidas[0]).toBeTruthy();
    expect(chavesRecebidas[0]).toBe(chavesRecebidas[1]);
  });

  // ---------------------------------------------
  // Troca de modalidade após uma resposta perdida
  // A primeira tentativa "falha" (resposta perdida) sem trocar nada no
  // carrinho, só para capturar a chave sem navegar para /pedidos/:id — a
  // troca de modalidade em seguida é o que precisa gerar chave nova.
  // ---------------------------------------------
  it('trocar a modalidade de frete gera chave nova no envio seguinte', async () => {
    itensDoCarrinho = [{ produtoId: 1, quantidade: 1 }];
    let tentativa = 0;
    const chavesRecebidas: (string | undefined)[] = [];
    const cliente = montarCliente({
      aoCriarPedido: (chave) => {
        chavesRecebidas.push(chave);
        tentativa += 1;
        return tentativa === 1
          ? Promise.reject(new Error('rede indisponível'))
          : Promise.resolve({ id: 99 });
      },
    });
    abrirCarrinho(cliente);

    await screen.findByText('Mouse sem fio');
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Finalizar pedido' })[0],
      ).not.toBeDisabled(),
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Finalizar pedido' })[0],
    );
    await waitFor(() => expect(chavesRecebidas).toHaveLength(1));

    const radioSedex = await screen.findByRole('radio', { name: /SEDEX/ });
    fireEvent.click(radioSedex);
    await waitFor(() =>
      expect((radioSedex as HTMLInputElement).checked).toBe(true),
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Finalizar pedido' })[0],
    );
    await waitFor(() => expect(chavesRecebidas).toHaveLength(2));

    expect(chavesRecebidas[0]).toBeTruthy();
    expect(chavesRecebidas[1]).toBeTruthy();
    expect(chavesRecebidas[0]).not.toBe(chavesRecebidas[1]);
  });
});
