import { useRef } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/cliente';
import { TelaInicial } from './tela-inicial';

vi.mock('../hooks/use-gsap', () => ({ useGsap: () => useRef(null) }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { refresh: vi.fn() } }));

// ---------------------------------------------
// Home sem sessão ou banco
// Cada rota recebe somente dados do próprio contrato. A simulação permite
// derrubar uma vitrine sem esconder uma dependência indevida entre seções.
// ---------------------------------------------
function abrirHome(falharOrdenada = false) {
  const get = vi.fn((caminho: string) => {
    if (falharOrdenada && caminho.includes('ordenarPor'))
      return Promise.reject(new Error('Falha simulada'));
    return Promise.resolve({
      dados: caminho.startsWith('/categories')
        ? [{ id: 2, nome: 'Eletronicos' }]
        : [
            {
              id: 1,
              nome: 'Mouse',
              precoEmCentavos: 9900,
              estoque: 5,
              categoriaId: 2,
              nomeDoArquivoDaImagem: null,
            },
          ],
      total: 1,
      pagina: 1,
      limite: 8,
    });
  });
  render(
    <MemoryRouter>
      <TelaInicial cliente={{ get } as unknown as ApiClient} />
    </MemoryRouter>,
  );
  return get;
}

// ---------------------------------------------
// Home pública com vitrines reais
// Links conservam o contrato da URL do catálogo. Falha de uma leitura não
// deve remover hero, categorias ou outra vitrine que carregou corretamente.
// ---------------------------------------------
describe('Tela inicial', () => {
  it('exibe categorias e duas vitrines com links corretos sem sessão', async () => {
    abrirHome();
    expect(screen.getByRole('link', { name: 'Ver catálogo' })).toHaveAttribute(
      'href',
      '/produtos',
    );
    expect(
      screen.getByRole('link', { name: 'Ver por categoria' }),
    ).toHaveAttribute('href', '#categorias');
    expect(
      await screen.findByRole('link', { name: 'Eletronicos' }),
    ).toHaveAttribute('href', '/produtos?categoria=2');
    await waitFor(() => expect(screen.getAllByText('Mouse')).toHaveLength(2));
    expect(
      within(screen.getByRole('region', { name: 'No catálogo' })).getByRole(
        'link',
        { name: 'Ver todos' },
      ),
    ).toHaveAttribute('href', '/produtos');
    expect(
      within(screen.getByRole('region', { name: 'Menores preços' })).getByRole(
        'link',
        { name: 'Ver todos' },
      ),
    ).toHaveAttribute('href', '/produtos?ordenarPor=preco&direcao=asc');
  });

  it('oculta somente a vitrine que falhou', async () => {
    abrirHome(true);
    await screen.findByText('Mouse');
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Menores preços' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('region', { name: 'No catálogo' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Eletronicos' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pagamento simulado')).toBeInTheDocument();
  });
});
