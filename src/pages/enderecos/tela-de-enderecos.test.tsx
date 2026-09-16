import { StrictMode } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../api/cliente';
import { TelaDeEnderecos } from './tela-de-enderecos';

afterEach(() => {
  vi.restoreAllMocks();
});

const ENDERECO_PRINCIPAL = {
  id: 1,
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

const ENDERECO_SECUNDARIO = {
  id: 2,
  apelido: 'Trabalho',
  destinatario: 'Fulano',
  cep: '04538132',
  logradouro: 'Av. Brigadeiro Faria Lima',
  numero: '2000',
  complemento: 'Sala 10',
  bairro: 'Itaim Bibi',
  cidade: 'São Paulo',
  uf: 'SP',
  principal: false,
  criadoEm: '2026-09-02T00:00:00Z',
};

// ---------------------------------------------
// Cliente HTTP simulado por rota
// `get` responde a listagem de endereços; `patch` responde à atualização, com
// `aoAtualizar` como parâmetro para cada teste compor o cenário de sucesso ou
// falha sem duplicar a função inteira. O `get` rejeita com AbortError quando
// o `signal` já foi abortado, reproduzindo o comportamento real de fetch sob
// StrictMode (armadilha de mock que resolve mesmo após o abort).
// ---------------------------------------------
function montarCliente(opcoes: {
  enderecos?: (typeof ENDERECO_PRINCIPAL)[];
  aoAtualizar?: (id: number, dados: unknown) => Promise<unknown>;
}) {
  const enderecos = opcoes.enderecos ?? [
    ENDERECO_PRINCIPAL,
    ENDERECO_SECUNDARIO,
  ];
  const get = vi.fn((caminho: string, config?: { signal?: AbortSignal }) => {
    if (config?.signal?.aborted) {
      return Promise.reject(new DOMException('abortado', 'AbortError'));
    }
    if (caminho === '/addresses') {
      return Promise.resolve(enderecos);
    }
    return Promise.reject(new Error(`rota inesperada: ${caminho}`));
  });
  const patch = vi.fn((caminho: string, dados: unknown) => {
    const id = Number(caminho.replace('/addresses/', ''));
    return opcoes.aoAtualizar
      ? opcoes.aoAtualizar(id, dados)
      : Promise.resolve({ ...ENDERECO_PRINCIPAL, id, ...(dados as object) });
  });
  return { get, patch } as unknown as ApiClient;
}

function abrirTela(cliente: ApiClient) {
  render(
    <MemoryRouter initialEntries={['/enderecos']}>
      <Routes>
        <Route
          path="/enderecos"
          element={<TelaDeEnderecos cliente={cliente} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Tela de endereços', () => {
  it('mostra a etiqueta "Principal" só no endereço principal', async () => {
    abrirTela(montarCliente({}));

    await screen.findByText('Casa');
    const etiquetas = screen.getAllByText('Principal');
    expect(etiquetas).toHaveLength(1);

    const cartaoDoTrabalho = screen.getByText('Trabalho').closest('li');
    expect(cartaoDoTrabalho).not.toBeNull();
    expect(
      within(cartaoDoTrabalho as HTMLElement).queryByText('Principal'),
    ).not.toBeInTheDocument();
  });

  it('editar preenche o formulário e salvar envia PATCH para o id certo', async () => {
    const cliente = montarCliente({});
    abrirTela(cliente);

    await screen.findByText('Trabalho');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    const campoApelido = (await screen.findByLabelText(
      'Apelido',
    )) as HTMLInputElement;
    expect(campoApelido.value).toBe('Casa');

    fireEvent.change(campoApelido, { target: { value: 'Casa nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar endereço' }));

    await waitFor(() => expect(cliente.patch).toHaveBeenCalledTimes(1));
    expect(cliente.patch).toHaveBeenCalledWith(
      '/addresses/1',
      expect.objectContaining({ apelido: 'Casa nova' }),
    );
    expect(
      await screen.findByText('Endereço salvo com sucesso.'),
    ).toBeInTheDocument();
  });

  it('erro da API ao salvar mantém o formulário preenchido e mostra a mensagem', async () => {
    const { ApiError } = await import('../../api/cliente');
    const cliente = montarCliente({
      aoAtualizar: () => Promise.reject(new ApiError(400, 'CEP inválido.')),
    });
    abrirTela(cliente);

    await screen.findByText('Casa');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    const campoApelido = (await screen.findByLabelText(
      'Apelido',
    )) as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Salvar endereço' }));

    await screen.findByText('CEP inválido.');
    expect(campoApelido.value).toBe('Casa');
  });

  // ---------------------------------------------
  // StrictMode duplica o efeito de carga (montar/desmontar/montar): a
  // primeira leitura é abortada pelo cleanup e rejeita com AbortError depois
  // que a segunda já está em voo. Sem a flag `cancelado` em cada etapa
  // (then/catch/finally), o `finally` da leitura abortada zera `carregando`
  // por cima da leitura válida ainda pendente, e a tela pisca "nenhum
  // endereço cadastrado" antes da lista real chegar. O mock nunca resolve
  // sozinho: cada chamada de `get` fica pendente até o teste liberar,
  // e o `abort` do `AbortSignal` é o que rejeita a chamada abortada — mesmo
  // contrato do fetch real, sem `mockResolvedValueOnce`.
  // ---------------------------------------------
  it('sob StrictMode, a leitura abortada não antecipa o fim do carregamento nem mostra a lista vazia', async () => {
    const chamadas: { resolver: (valor: unknown) => void }[] = [];
    const get = vi.fn((caminho: string, config?: { signal?: AbortSignal }) => {
      if (caminho !== '/addresses') {
        return Promise.reject(new Error(`rota inesperada: ${caminho}`));
      }
      return new Promise((resolve, reject) => {
        config?.signal?.addEventListener('abort', () => {
          reject(new DOMException('abortado', 'AbortError'));
        });
        chamadas.push({ resolver: resolve });
      });
    });
    const cliente = { get } as unknown as ApiClient;

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/enderecos']}>
          <Routes>
            <Route
              path="/enderecos"
              element={<TelaDeEnderecos cliente={cliente} />}
            />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => expect(chamadas).toHaveLength(2));

    expect(
      await screen.findByRole('status', { name: 'Carregando endereços' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Você ainda não tem nenhum endereço cadastrado.'),
    ).not.toBeInTheDocument();

    chamadas[chamadas.length - 1].resolver([
      {
        id: 1,
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
      },
    ]);

    await screen.findByText('Casa');
    expect(
      screen.queryByText('Você ainda não tem nenhum endereço cadastrado.'),
    ).not.toBeInTheDocument();
  });
});
