import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../api/cliente';
import { TelaDeDetalheDoProduto } from './tela-de-detalhe-do-produto';

// ---------------------------------------------
// Sessão e carrinho controlados pelo teste
// Substituir os módulos evita montar ApiClient real, BroadcastChannel e
// localStorage do carrinho para um teste que é sobre a tela de produto.
// ---------------------------------------------
let situacaoAtual: 'verificando' | 'autenticado' | 'anonimo' = 'autenticado';
let itensDoCarrinho: { produtoId: number; quantidade: number }[] = [];
const adicionarAoCarrinho = vi.fn();

vi.mock('../../auth/contexto-de-sessao', () => ({
  useSessao: () => ({ situacao: situacaoAtual }),
}));

vi.mock('../../auth/contexto-do-carrinho', () => ({
  useCarrinho: () => ({
    itens: itensDoCarrinho,
    adicionar: adicionarAoCarrinho,
  }),
}));

function Localizacao() {
  const local = useLocation();
  return (
    <output aria-label="URL atual">{`${local.pathname}${local.search}`}</output>
  );
}

// ---------------------------------------------
// Produto isolado do banco
// `cliente.get` responde por rota: produto, categorias e a busca de
// relacionados (mesmo endpoint de listagem, filtrado por categoria).
// ---------------------------------------------
function abrirDetalhe(
  produto: Record<string, unknown>,
  relacionados: Record<string, unknown>[] = [],
  entrada = '/produtos/1',
) {
  const get = vi.fn((caminho: string) => {
    if (caminho.startsWith('/products/1')) {
      return Promise.resolve(produto);
    }
    if (caminho.startsWith('/categories')) {
      return Promise.resolve({ dados: [{ id: 2, nome: 'Eletronicos' }] });
    }
    if (caminho.startsWith('/products')) {
      return Promise.resolve({
        dados: relacionados,
        total: relacionados.length,
        pagina: 1,
        limite: 6,
      });
    }
    return Promise.reject(new Error(`rota inesperada: ${caminho}`));
  });

  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route
          path="/produtos/:id"
          element={
            <TelaDeDetalheDoProduto cliente={{ get } as unknown as ApiClient} />
          }
        />
      </Routes>
      <Localizacao />
    </MemoryRouter>,
  );
  return get;
}

const PRODUTO_BASE = {
  id: 1,
  nome: 'Mouse sem fio',
  precoEmCentavos: 12990,
  estoque: 5,
  categoriaId: 2,
  nomeDoArquivoDaImagem: null,
};

describe('Tela de detalhe do produto', () => {
  beforeEach(() => {
    situacaoAtual = 'autenticado';
    itensDoCarrinho = [];
    adicionarAoCarrinho.mockClear();
  });

  it('limita a quantidade ao estoque menos o que já está no carrinho', async () => {
    itensDoCarrinho = [{ produtoId: 1, quantidade: 3 }];
    abrirDetalhe(PRODUTO_BASE);

    const campo = (await screen.findByLabelText(
      'Quantidade',
    )) as HTMLInputElement;
    expect(campo.max).toBe('2');
  });

  it('desabilita o botão e explica quando o teto chega a zero', async () => {
    itensDoCarrinho = [{ produtoId: 1, quantidade: 5 }];
    abrirDetalhe(PRODUTO_BASE);

    await screen.findByRole('heading', { name: 'Mouse sem fio' });
    expect(
      screen.getByRole('button', { name: 'Adicionar ao carrinho' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/já tem no carrinho todo o estoque disponível/),
    ).toBeInTheDocument();
  });

  it('visitante anônimo é enviado para /entrar com o retorno da página atual', async () => {
    situacaoAtual = 'anonimo';
    itensDoCarrinho = [];
    abrirDetalhe(PRODUTO_BASE, [], '/produtos/1');

    await screen.findByRole('heading', { name: 'Mouse sem fio' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar ao carrinho' }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText('URL atual')).toHaveTextContent(
        '/entrar?retorno=%2Fprodutos%2F1',
      ),
    );
    expect(adicionarAoCarrinho).not.toHaveBeenCalled();
  });

  it('desabilita o botão com carregando enquanto a sessão ainda está sendo verificada, sem redirecionar', async () => {
    situacaoAtual = 'verificando';
    itensDoCarrinho = [];
    abrirDetalhe(PRODUTO_BASE, [], '/produtos/1');

    await screen.findByRole('heading', { name: 'Mouse sem fio' });
    const botao = screen.getByRole('button', { name: 'Adicionar ao carrinho' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(botao);

    expect(screen.getByLabelText('URL atual')).toHaveTextContent('/produtos/1');
    expect(adicionarAoCarrinho).not.toHaveBeenCalled();
  });

  it('omite a seção de relacionados quando só existe o próprio produto', async () => {
    situacaoAtual = 'autenticado';
    itensDoCarrinho = [];
    abrirDetalhe(PRODUTO_BASE, [PRODUTO_BASE]);

    await screen.findByRole('heading', { name: 'Mouse sem fio' });
    await waitFor(() =>
      expect(screen.queryByText('Da mesma categoria')).not.toBeInTheDocument(),
    );
  });

  it('mostra a seção de relacionados com outros produtos da mesma categoria', async () => {
    situacaoAtual = 'autenticado';
    itensDoCarrinho = [];
    abrirDetalhe(PRODUTO_BASE, [
      PRODUTO_BASE,
      { ...PRODUTO_BASE, id: 2, nome: 'Teclado mecânico' },
    ]);

    await screen.findByRole('heading', { name: 'Mouse sem fio' });
    await screen.findByText('Da mesma categoria');
    expect(screen.getByText('Teclado mecânico')).toBeInTheDocument();
  });
});
