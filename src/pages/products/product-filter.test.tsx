import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import type { FiltroDeProdutos } from '../../api/products';
import { FiltroDeProdutosView } from './product-filter';

function clienteComCategorias() {
  const fetchFalso = vi.fn(async () =>
    new Response(
      JSON.stringify({
        data: [
          { id: 1, name: 'Bebidas' },
          { id: 2, name: 'Hardware' },
        ],
        total: 2,
        page: 1,
        limit: 100,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    ),
  );

  return new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: fetchFalso as unknown as typeof fetch,
  });
}

function FiltroControlado({
  cliente,
  filtroInicial,
  aoMudar,
}: {
  cliente: ApiClient;
  filtroInicial: FiltroDeProdutos;
  aoMudar: (filtro: FiltroDeProdutos) => void;
}) {
  const [filtro, setFiltro] = useState(filtroInicial);

  function mudarFiltro(novoFiltro: FiltroDeProdutos) {
    setFiltro(novoFiltro);
    aoMudar(novoFiltro);
  }

  return (
    <FiltroDeProdutosView
      cliente={cliente}
      filtro={filtro}
      aoMudar={mudarFiltro}
    />
  );
}

describe('FiltroDeProdutosView', () => {
  it('lista as categorias carregadas no dropdown', async () => {
    render(
      <FiltroDeProdutosView
        cliente={clienteComCategorias()}
        filtro={{ categoria: null, busca: '', pagina: 1 }}
        aoMudar={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Bebidas')).toBeInTheDocument();
    });
  });

  it('avisa a mudança de categoria zerando a página', async () => {
    const aoMudar = vi.fn();
    render(
      <FiltroDeProdutosView
        cliente={clienteComCategorias()}
        filtro={{ categoria: null, busca: '', pagina: 3 }}
        aoMudar={aoMudar}
      />,
    );
    await waitFor(() => expect(screen.getByText('Bebidas')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/categoria/i), '1');

    expect(aoMudar).toHaveBeenCalledWith({
      categoria: 1,
      busca: '',
      pagina: 1,
    });
  });

  it('avisa a mudança de busca zerando a página', async () => {
    const aoMudar = vi.fn();
    render(
      <FiltroControlado
        cliente={clienteComCategorias()}
        filtroInicial={{ categoria: null, busca: '', pagina: 2 }}
        aoMudar={aoMudar}
      />,
    );

    await userEvent.type(screen.getByLabelText(/buscar/i), 'mouse');

    expect(aoMudar).toHaveBeenLastCalledWith({
      categoria: null,
      busca: 'mouse',
      pagina: 1,
    });
  });
});
