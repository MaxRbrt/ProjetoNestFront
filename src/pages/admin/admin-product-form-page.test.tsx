import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../api/client';
import { AdminProductFormPage } from './admin-product-form-page';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Simula o comportamento real do fetch nativo com AbortSignal: rejeita assim
// que o sinal aborta, em vez de ignorá-lo como um mock ingênuo faria. Sem
// isso, o teste de StrictMode passaria mesmo com o bug presente — o mock
// resolveria a requisição "abortada" normalmente, nunca disparando o catch
// que o bug depende de acionar.
function respostaComAbort(
  corpo: unknown,
  signal: AbortSignal | null | undefined,
  status = 200,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal?.addEventListener('abort', () => {
      reject(new DOMException('Aborted', 'AbortError'));
    });
    setTimeout(() => {
      if (!signal?.aborted) {
        resolve(respostaJson(corpo, status));
      }
    }, 20);
  });
}

function montar(
  entrada: string,
  responder: (url: string, init?: RequestInit) => Promise<Response>,
  opcoes: { strict?: boolean } = {},
) {
  const cliente = new ApiClient({
    baseUrl: 'http://api.local',
    fetchImpl: vi.fn(responder) as unknown as typeof fetch,
  });
  const arvore = (
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route
          path="/admin/produtos/novo"
          element={<AdminProductFormPage cliente={cliente} />}
        />
        <Route
          path="/admin/produtos/:id/editar"
          element={<AdminProductFormPage cliente={cliente} />}
        />
        <Route path="/admin/produtos" element={<p>Lista de produtos</p>} />
      </Routes>
    </MemoryRouter>
  );
  return render(opcoes.strict ? <StrictMode>{arvore}</StrictMode> : arvore);
}

describe('AdminProductFormPage', () => {
  it('cria um produto e volta para a lista', async () => {
    const usuario = userEvent.setup();
    montar('/admin/produtos/novo', async (url, init) => {
      if (url.includes('/categories')) {
        return respostaJson({
          data: [{ id: 1, name: 'Bebidas' }],
          total: 1,
          page: 1,
          limit: 100,
        });
      }
      expect(init?.method).toBe('POST');
      return respostaJson({
        id: 9,
        name: 'Caneca',
        price: 29.9,
        categoryId: 1,
        stock: 10,
      });
    });

    await usuario.type(await screen.findByLabelText('Nome'), 'Caneca');
    await usuario.type(screen.getByLabelText('Preço'), '29.9');
    await usuario.type(screen.getByLabelText('Estoque'), '10');
    await usuario.selectOptions(screen.getByLabelText('Categoria'), '1');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Lista de produtos')).toBeInTheDocument();
  });

  it('carrega o produto existente no modo edição', async () => {
    montar('/admin/produtos/9/editar', async (url) => {
      if (url.includes('/categories')) {
        return respostaJson({
          data: [{ id: 1, name: 'Bebidas' }],
          total: 1,
          page: 1,
          limit: 100,
        });
      }
      return respostaJson({
        id: 9,
        name: 'Caneca',
        price: 29.9,
        categoryId: 1,
        stock: 10,
      });
    });

    expect(await screen.findByDisplayValue('Caneca')).toBeInTheDocument();
    expect(screen.getByDisplayValue('29.9')).toBeInTheDocument();
  });

  it('sob StrictMode, não deixa erro fantasma do primeiro mount abortado', async () => {
    // O StrictMode monta, desmonta e monta de novo em desenvolvimento. O
    // primeiro efeito aborta ao desmontar; sem a flag "cancelado", o catch
    // dessa requisição abortada roda mesmo assim e marca erro — que o
    // segundo mount, ao ter sucesso, precisa limpar.
    montar(
      '/admin/produtos/9/editar',
      async (url, init) => {
        if (url.includes('/categories')) {
          return respostaJson({
            data: [{ id: 1, name: 'Bebidas' }],
            total: 1,
            page: 1,
            limit: 100,
          });
        }
        return respostaComAbort(
          { id: 9, name: 'Caneca', price: 29.9, categoryId: 1, stock: 10 },
          init?.signal,
        );
      },
      { strict: true },
    );

    expect(await screen.findByDisplayValue('Caneca')).toBeInTheDocument();
    expect(
      screen.queryByText('Não foi possível carregar o produto.'),
    ).not.toBeInTheDocument();
  });

  it('mostra o erro de validação vindo da API', async () => {
    const usuario = userEvent.setup();
    montar('/admin/produtos/novo', async (url) => {
      if (url.includes('/categories')) {
        return respostaJson({
          data: [{ id: 1, name: 'Bebidas' }],
          total: 1,
          page: 1,
          limit: 100,
        });
      }
      return respostaJson(
        { message: ['price must be a positive number'] },
        400,
      );
    });

    await usuario.type(await screen.findByLabelText('Nome'), 'X');
    await usuario.type(screen.getByLabelText('Preço'), '1');
    await usuario.type(screen.getByLabelText('Estoque'), '1');
    await usuario.selectOptions(screen.getByLabelText('Categoria'), '1');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('price must be a positive number'),
    ).toBeInTheDocument();
  });
});
