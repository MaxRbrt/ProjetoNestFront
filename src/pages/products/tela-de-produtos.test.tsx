import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../api/cliente';
import { TelaDeProdutos } from './tela-de-produtos';

// ---------------------------------------------
// Localização observável
// Confere a URL produzida pela interação, sem substituir os hooks da tela.
// ---------------------------------------------
function Localizacao() {
  const local = useLocation();
  return <output aria-label="URL atual">{local.search}</output>;
}

// ---------------------------------------------
// Catálogo isolado do banco
// A resposta vazia permite verificar navegação e estados sem criar produtos
// reais. O mock responde por rota para preservar a consulta de categorias.
// ---------------------------------------------
function abrirCatalogo(consulta = '') {
  const get = vi.fn((caminho: string) =>
    Promise.resolve({
      dados: caminho.startsWith('/categories')
        ? [{ id: 2, nome: 'Eletronicos' }]
        : [],
      total: 0,
      pagina: 1,
      limite: 20,
    }),
  );
  render(
    <MemoryRouter initialEntries={[`/produtos${consulta}`]}>
      <TelaDeProdutos cliente={{ get } as unknown as ApiClient} />
      <Localizacao />
    </MemoryRouter>,
  );
  return get;
}

// ---------------------------------------------
// Navegação e estados do catálogo
// Alterar a ordenação deve refazer a leitura e abandonar a página anterior;
// remover a busca deve preservar os demais filtros compartilhados.
// ---------------------------------------------
describe('Tela de produtos', () => {
  it('troca a ordenação, volta à página 1 e refaz a consulta', async () => {
    const get = abrirCatalogo('?pagina=3&categoria=2');
    await screen.findByText(
      'Nenhum produto encontrado com categoria: Eletronicos.',
    );
    fireEvent.change(screen.getByLabelText('Ordenar por'), {
      target: { value: 'preco-desc' },
    });
    const parametros = new URLSearchParams(
      screen.getByLabelText('URL atual').textContent ?? '',
    );
    expect(parametros.has('pagina')).toBe(false);
    expect(parametros.get('categoria')).toBe('2');
    expect(parametros.get('ordenarPor')).toBe('preco');
    expect(parametros.get('direcao')).toBe('desc');
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        '/products?pagina=1&ordenarPor=preco&direcao=desc&categoriaId=2',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it('remove só busca e página, mantendo categoria e ordenação', () => {
    abrirCatalogo(
      '?busca=Mouse&pagina=3&categoria=2&ordenarPor=preco&direcao=desc',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remover busca' }));
    expect(screen.getByLabelText('URL atual')).toHaveTextContent(
      '?categoria=2&ordenarPor=preco&direcao=desc',
    );
    expect(
      screen.queryByText('Resultados para “Mouse”'),
    ).not.toBeInTheDocument();
  });

  it('mostra vazio sem filtro sem oferecer limpeza', async () => {
    abrirCatalogo();
    await screen.findByText('Nenhum produto cadastrado ainda.');
    expect(
      screen.queryByRole('button', { name: 'Limpar filtros' }),
    ).not.toBeInTheDocument();
  });

  it('mantém o título Produtos quando a categoria não existe', async () => {
    abrirCatalogo('?categoria=999');
    await screen.findByText('Nenhum produto encontrado com categoria: 999.');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Produtos',
    );
  });
});
