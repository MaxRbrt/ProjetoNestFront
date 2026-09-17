import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, type ApiClient } from '../../api/cliente';
import { TelaDeFormularioDeProdutoAdmin } from './tela-de-formulario-de-produto-admin';

// ---------------------------------------------
// Stub de URL.createObjectURL/revokeObjectURL
// jsdom não implementa essas funções. O componente usa createObjectURL para
// gerar a pré-visualização do arquivo anexado; sem o stub, todo teste que
// anexa arquivo quebra ao montar o efeito de pré-visualização.
// ---------------------------------------------
let criarUrlDeObjetoOriginal: typeof URL.createObjectURL | undefined;
let revogarUrlDeObjetoOriginal: typeof URL.revokeObjectURL | undefined;

beforeEach(() => {
  criarUrlDeObjetoOriginal = URL.createObjectURL;
  revogarUrlDeObjetoOriginal = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:previa-de-teste');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  URL.createObjectURL = criarUrlDeObjetoOriginal as typeof URL.createObjectURL;
  URL.revokeObjectURL =
    revogarUrlDeObjetoOriginal as typeof URL.revokeObjectURL;
});

const CATEGORIAS = {
  dados: [{ id: 1, nome: 'Eletronicos' }],
  total: 1,
  pagina: 1,
  limite: 20,
};

function produtoCriado(nomeDoArquivoDaImagem: string | null = null) {
  return {
    id: 7,
    nome: 'Novo',
    precoEmCentavos: 1000,
    estoque: 2,
    categoriaId: 1,
    nomeDoArquivoDaImagem,
  };
}

// ---------------------------------------------
// Helper de renderização
// A falha de upload no modo criação navega para a rota de edição (decisão
// tomada fora do brief: ficar no modo criação faria o próximo clique em
// Salvar criar um segundo produto). Por isso o helper registra também a
// rota de edição, e o mock de `get` responde por caminho: `/categories...`
// devolve as categorias, `/products/7` devolve o produto recém-criado. Um
// `get` que devolvesse as categorias para qualquer caminho faria a tela de
// edição, ao ser alcançada por essa navegação, carregar lixo no lugar do
// produto.
// ---------------------------------------------
function abrirFormularioDeCriacao(post: ReturnType<typeof vi.fn>) {
  const get = vi.fn((caminho: string) => {
    if (caminho.startsWith('/categories')) return Promise.resolve(CATEGORIAS);
    if (caminho.startsWith('/products/7'))
      return Promise.resolve(produtoCriado('aaa.png'));
    return Promise.reject(new Error(`get não mapeado no mock: ${caminho}`));
  });
  abrirFormulario({ get, post });
}

function abrirFormulario(cliente: object, rota = '/admin/produtos/novo') {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route
            path="/admin/produtos/novo"
            element={
              <TelaDeFormularioDeProdutoAdmin cliente={cliente as ApiClient} />
            }
          />
          <Route
            path="/admin/produtos/:id/editar"
            element={
              <TelaDeFormularioDeProdutoAdmin cliente={cliente as ApiClient} />
            }
          />
          <Route path="/admin/produtos" element={<h1>Lista de produtos</h1>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

// ---------------------------------------------
// O caso de upload usa ponto; o bloco de preenchimento cobre vírgula.
// Os dois formatos devem chegar à API como centavos inteiros.
// ---------------------------------------------
async function preencherEAnexar() {
  fireEvent.change(await screen.findByLabelText('Nome'), {
    target: { value: 'Novo' },
  });
  fireEvent.change(screen.getByLabelText('Preço'), {
    target: { value: '10.00' },
  });
  fireEvent.change(screen.getByLabelText('Estoque'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Categoria'), {
    target: { value: '1' },
  });

  const arquivo = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
    'foto.png',
    {
      type: 'image/png',
    },
  );
  fireEvent.change(screen.getByLabelText('Imagem'), {
    target: { files: [arquivo] },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  });
}

// ---------------------------------------------
// Imagem no formulário de produto
// No modo criação o produto ainda não tem id, e a rota de upload precisa
// dele. O formulário guarda o arquivo, cria o produto, lê o id da resposta e
// envia a imagem em seguida. O caso que merece teste é a falha do segundo
// passo: o produto já existe, e dizer "não foi possível salvar" seria
// mentira — o admin recadastraria e ficaria com dois.
// ---------------------------------------------
describe('Imagem no formulário de produto', () => {
  it('recusa arquivo acima de 2 MB antes de salvar e permite descartar a seleção', async () => {
    const post = vi.fn();
    abrirFormularioDeCriacao(post);
    await screen.findByRole('option', { name: 'Eletronicos' });
    const arquivo = new File(
      [new Uint8Array(2 * 1024 * 1024 + 1)],
      'grande.png',
      { type: 'image/png' },
    );
    fireEvent.change(screen.getByLabelText('Imagem'), {
      target: { files: [arquivo] },
    });
    expect(
      await screen.findByText('A imagem deve ter no máximo 2 MB.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar seleção' }));
    expect(screen.queryByText('A imagem deve ter no máximo 2 MB.')).toBeNull();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeEnabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('descarta a prévia sem enviar arquivo nem remover a imagem salva', async () => {
    const cliente = {
      get: vi.fn((caminho: string) =>
        Promise.resolve(
          caminho.startsWith('/categories')
            ? CATEGORIAS
            : produtoCriado('atual.png'),
        ),
      ),
      delete: vi.fn(),
    };
    abrirFormulario(cliente, '/admin/produtos/7/editar');
    await screen.findByAltText('Imagem atual do produto');
    fireEvent.change(screen.getByLabelText('Imagem'), {
      target: {
        files: [new File(['foto'], 'nova.png', { type: 'image/png' })],
      },
    });
    await screen.findByAltText('Pré-visualização da imagem selecionada');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar seleção' }));
    expect(
      await screen.findByAltText('Imagem atual do produto'),
    ).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:previa-de-teste');
    expect(cliente.delete).not.toHaveBeenCalled();
  });

  it('confirma a remoção da imagem salva e bloqueia o envio durante a remoção', async () => {
    let resolverRemocao!: (produto: ReturnType<typeof produtoCriado>) => void;
    const cliente = {
      get: vi.fn((caminho: string) =>
        Promise.resolve(
          caminho.startsWith('/categories')
            ? CATEGORIAS
            : produtoCriado('atual.png'),
        ),
      ),
      delete: vi.fn(
        () =>
          new Promise<ReturnType<typeof produtoCriado>>((resolver) => {
            resolverRemocao = resolver;
          }),
      ),
    };
    abrirFormulario(cliente, '/admin/produtos/7/editar');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Remover imagem' }),
    );
    expect(cliente.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar remoção' }));
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    await act(async () => resolverRemocao(produtoCriado()));
    await screen.findByText('Imagem removida do produto.');
    expect(screen.queryByAltText('Imagem atual do produto')).toBeNull();
    expect(cliente.delete).toHaveBeenCalledTimes(1);
  });

  it('ao criar, envia a imagem depois de obter o id do produto', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(produtoCriado())
      .mockResolvedValueOnce(produtoCriado('aaa.png'));
    abrirFormularioDeCriacao(post);

    await preencherEAnexar();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0][0]).toBe('/products');
    expect(post.mock.calls[1][0]).toBe('/products/7/image');
    expect(post.mock.calls[1][1]).toBeInstanceOf(FormData);
    await screen.findByRole('heading', { name: 'Lista de produtos' });
  });

  it('produto criado com falha no upload avisa sem sugerir recadastro', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(produtoCriado())
      .mockRejectedValueOnce(
        new ApiError(413, 'A imagem excede o limite de 2 MB.'),
      );
    abrirFormularioDeCriacao(post);

    await preencherEAnexar();

    await screen.findByText(/produto criado, mas a imagem não foi enviada/i);
    expect(screen.queryByText(/não foi possível salvar/i)).toBeNull();
  });

  it('não chama a rota de imagem quando nenhum arquivo foi anexado', async () => {
    const post = vi.fn().mockResolvedValue(produtoCriado());
    abrirFormularioDeCriacao(post);

    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Sem foto' },
    });
    fireEvent.change(screen.getByLabelText('Preço'), {
      target: { value: '10.00' },
    });
    fireEvent.change(screen.getByLabelText('Estoque'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Categoria'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/products');
    await screen.findByRole('heading', { name: 'Lista de produtos' });
  });

  it('produto salvo com falha no upload avisa e não navega (modo edição)', async () => {
    const get = vi.fn((caminho: string) => {
      if (caminho.startsWith('/categories')) return Promise.resolve(CATEGORIAS);
      if (caminho.startsWith('/products/7'))
        return Promise.resolve(produtoCriado());
      return Promise.reject(new Error(`get não mapeado no mock: ${caminho}`));
    });
    const patch = vi.fn().mockResolvedValue(produtoCriado());
    const post = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(413, 'A imagem excede o limite de 2 MB.'),
      );

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/admin/produtos/7/editar']}>
          <Routes>
            <Route
              path="/admin/produtos/:id/editar"
              element={
                <TelaDeFormularioDeProdutoAdmin
                  cliente={{ get, patch, post } as unknown as ApiClient}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    await preencherEAnexar();

    await screen.findByText(
      'Produto salvo, mas a imagem não foi enviada: A imagem excede o limite de 2 MB.',
    );
    expect(
      screen.getByRole('heading', { name: 'Editar produto' }),
    ).toBeInTheDocument();
    expect(patch).toHaveBeenCalledTimes(1);
  });
});

describe('Preenchimento e recuperação do formulário de produto', () => {
  it('aceita preço com vírgula e envia somente os campos reais em centavos', async () => {
    const post = vi.fn().mockResolvedValue(produtoCriado());
    abrirFormularioDeCriacao(post);
    await screen.findByRole('option', { name: 'Eletronicos' });
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Mouse' },
    });
    fireEvent.change(screen.getByLabelText('Preço'), {
      target: { value: '19,90' },
    });
    fireEvent.change(screen.getByLabelText('Estoque'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('Categoria'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/products', {
        nome: 'Mouse',
        precoEmCentavos: 1990,
        estoque: 0,
        categoriaId: 1,
      }),
    );
  });

  it('identifica campos inválidos e leva o foco ao primeiro sem enviar dados', async () => {
    const post = vi.fn();
    abrirFormularioDeCriacao(post);
    await screen.findByRole('option', { name: 'Eletronicos' });
    fireEvent.change(screen.getByLabelText('Preço'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('Estoque'), {
      target: { value: '-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(screen.getByLabelText('Nome')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Preço')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Estoque')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(post).not.toHaveBeenCalled();
  });

  it('recupera categorias após erro sem apagar o nome já digitado', async () => {
    let falhar = true;
    const get = vi.fn(() =>
      falhar
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(CATEGORIAS),
    );
    abrirFormulario({ get });
    await screen.findByText('Não foi possível carregar as categorias.');
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Mouse' },
    });
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('option', { name: 'Eletronicos' });
    expect(screen.getByLabelText('Nome')).toHaveValue('Mouse');
    expect(screen.getByRole('button', { name: /salvar/i })).toBeEnabled();
  });

  it('não permite editar antes de carregar e oferece nova tentativa após falha', async () => {
    let falhar = true;
    const get = vi.fn((caminho: string) =>
      caminho.startsWith('/categories')
        ? Promise.resolve(CATEGORIAS)
        : falhar
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(produtoCriado()),
    );
    abrirFormulario({ get }, '/admin/produtos/7/editar');
    await screen.findByText('Não foi possível carregar o produto.');
    expect(screen.queryByLabelText('Nome')).toBeNull();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByLabelText('Nome')).toHaveValue('Novo');
  });

  it('informa quando não há categorias e permite abrir o cadastro de categoria', async () => {
    abrirFormulario({
      get: vi.fn().mockResolvedValue({ ...CATEGORIAS, dados: [], total: 0 }),
    });
    await screen.findByText('Cadastre uma categoria para organizar o produto.');
    expect(
      screen.getByRole('link', { name: 'Cadastrar categoria' }),
    ).toHaveAttribute('href', '/admin/categorias/novo');
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
  });
});
