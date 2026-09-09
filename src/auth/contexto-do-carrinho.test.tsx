import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProvedorDoCarrinho, useCarrinho } from './contexto-do-carrinho';

// ---------------------------------------------
// Sessão controlada pelo teste
// O provedor do carrinho lê useSessao() só para saber quando a situação vira
// 'anonimo'. Trocar o módulo inteiro por um dublê evita arrastar cliente HTTP,
// BroadcastChannel e recuperação por cookie para dentro de um teste que é
// sobre carrinho.
// ---------------------------------------------
let situacaoAtual: 'verificando' | 'autenticado' | 'anonimo' = 'autenticado';

vi.mock('./contexto-de-sessao', () => ({
  useSessao: () => ({ situacao: situacaoAtual, usuario: null }),
}));

function Sonda() {
  const { itens, totalDeItens, adicionar, removerItem, atualizarQuantidade, limpar } =
    useCarrinho();

  return (
    <div>
      <span data-testid="total">{totalDeItens}</span>
      <span data-testid="itens">{JSON.stringify(itens)}</span>
      <button onClick={() => adicionar(1, 2)}>adicionar</button>
      <button onClick={() => atualizarQuantidade(1, 7)}>atualizar</button>
      <button onClick={() => removerItem(1)}>remover</button>
      <button onClick={limpar}>limpar</button>
    </div>
  );
}

function montar() {
  return render(
    <ProvedorDoCarrinho>
      <Sonda />
    </ProvedorDoCarrinho>,
  );
}

function clicar(nome: string) {
  act(() => {
    screen.getByText(nome).click();
  });
}

describe('ProvedorDoCarrinho', () => {
  it('persiste o carrinho em localStorage a cada mudança', () => {
    situacaoAtual = 'autenticado';
    montar();

    clicar('adicionar');

    expect(JSON.parse(localStorage.getItem('carrinho') ?? '[]')).toEqual([
      { produtoId: 1, quantidade: 2 },
    ]);
  });

  it('recupera o carrinho persistido ao montar', () => {
    situacaoAtual = 'autenticado';
    localStorage.setItem(
      'carrinho',
      JSON.stringify([{ produtoId: 9, quantidade: 3 }]),
    );

    montar();

    expect(screen.getByTestId('total').textContent).toBe('3');
  });

  it('descarta conteúdo inválido no armazenamento em vez de quebrar', () => {
    situacaoAtual = 'autenticado';
    localStorage.setItem('carrinho', 'isto não é JSON');

    montar();

    expect(screen.getByTestId('total').textContent).toBe('0');
  });

  it('descarta itens com formato inesperado, mantendo os válidos', () => {
    situacaoAtual = 'autenticado';
    localStorage.setItem(
      'carrinho',
      JSON.stringify([
        { produtoId: 1, quantidade: 2 },
        { produtoId: 'texto', quantidade: 1 },
        null,
      ]),
    );

    montar();

    expect(screen.getByTestId('total').textContent).toBe('2');
  });

  it('soma quantidade quando o mesmo produto é adicionado de novo', () => {
    situacaoAtual = 'autenticado';
    montar();

    clicar('adicionar');
    clicar('adicionar');

    // O contexto soma sem teto de propósito: o limite de estoque é aplicado no
    // ponto de chamada (tela de detalhe do produto), onde a quantidade
    // disponível é conhecida. Este teste fixa esse contrato — se alguém mover
    // o teto para cá, ele quebra e a decisão volta a ser consciente.
    expect(screen.getByTestId('total').textContent).toBe('4');
  });

  it('atualizar quantidade substitui em vez de somar', () => {
    situacaoAtual = 'autenticado';
    montar();

    clicar('adicionar');
    clicar('atualizar');

    expect(screen.getByTestId('total').textContent).toBe('7');
  });

  it('remover item tira do carrinho e do armazenamento', () => {
    situacaoAtual = 'autenticado';
    montar();

    clicar('adicionar');
    clicar('remover');

    expect(screen.getByTestId('total').textContent).toBe('0');
    expect(JSON.parse(localStorage.getItem('carrinho') ?? '[]')).toEqual([]);
  });

  it('esvazia o carrinho quando a sessão vira anônima', () => {
    situacaoAtual = 'autenticado';
    localStorage.setItem(
      'carrinho',
      JSON.stringify([{ produtoId: 1, quantidade: 5 }]),
    );

    const { rerender } = montar();
    expect(screen.getByTestId('total').textContent).toBe('5');

    // sair não pode deixar o carrinho do usuário anterior num computador
    // compartilhado — mesma razão da marca de saída pendente
    situacaoAtual = 'anonimo';
    act(() => {
      rerender(
        <ProvedorDoCarrinho>
          <Sonda />
        </ProvedorDoCarrinho>,
      );
    });

    expect(screen.getByTestId('total').textContent).toBe('0');
    expect(JSON.parse(localStorage.getItem('carrinho') ?? '[]')).toEqual([]);
  });

  it('useCarrinho fora do provedor lança erro explícito', () => {
    const semProvedor = () => render(<Sonda />);
    expect(semProvedor).toThrow(/ProvedorDoCarrinho/);
  });
});
