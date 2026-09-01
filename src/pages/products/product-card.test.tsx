import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CartaoDeProduto } from './product-card';

const PRODUTO = {
  id: 7,
  name: 'Mouse Gamer',
  price: 149.9,
  stock: 5,
  categoryId: 1,
};

function montar() {
  return render(
    <MemoryRouter>
      <CartaoDeProduto produto={PRODUTO} />
    </MemoryRouter>,
  );
}

describe('CartaoDeProduto', () => {
  it('mostra nome, preço formatado e estoque', () => {
    montar();

    expect(screen.getByText('Mouse Gamer')).toBeInTheDocument();
    expect(screen.getByText(/149,90/)).toBeInTheDocument();
    expect(screen.getByText(/5 em estoque/i)).toBeInTheDocument();
  });

  it('mostra a inicial do nome no lugar da imagem', () => {
    montar();

    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('avisa quando o estoque está zerado', () => {
    render(
      <MemoryRouter>
        <CartaoDeProduto produto={{ ...PRODUTO, stock: 0 }} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/esgotado/i)).toBeInTheDocument();
  });

  it('leva para a página de detalhe do produto', () => {
    montar();

    expect(screen.getByRole('link')).toHaveAttribute('href', '/produtos/7');
  });

  it('preserva o endereço filtrado para a volta do detalhe', async () => {
    render(
      <MemoryRouter initialEntries={['/produtos?busca=mouse&pagina=2']}>
        <Routes>
          <Route
            path="/produtos"
            element={<CartaoDeProduto produto={PRODUTO} />}
          />
          <Route path="/produtos/:id" element={<DestinoDoTeste />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('link'));

    expect(screen.getByText('/produtos?busca=mouse&pagina=2')).toBeInTheDocument();
  });
});

function DestinoDoTeste() {
  const local = useLocation();
  const estado = local.state as { retorno?: string } | null;

  return <p>{estado?.retorno ?? 'sem retorno'}</p>;
}
