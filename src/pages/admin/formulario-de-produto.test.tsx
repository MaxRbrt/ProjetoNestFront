import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  URL.revokeObjectURL = revogarUrlDeObjetoOriginal as typeof URL.revokeObjectURL;
});

const CATEGORIAS = { dados: [{ id: 1, nome: 'Eletronicos' }], total: 1, pagina: 1, limite: 20 };

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
    if (caminho.startsWith('/products/7')) return Promise.resolve(produtoCriado('aaa.png'));
    return Promise.reject(new Error(`get não mapeado no mock: ${caminho}`));
  });
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/admin/produtos/novo']}>
        <Routes>
          <Route
            path="/admin/produtos/novo"
            element={<TelaDeFormularioDeProdutoAdmin cliente={{ get, post } as unknown as ApiClient} />}
          />
          <Route
            path="/admin/produtos/:id/editar"
            element={<TelaDeFormularioDeProdutoAdmin cliente={{ get, post } as unknown as ApiClient} />}
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

// ---------------------------------------------
// Preço com ponto, não vírgula
// O campo aceita os dois formatos em produção (reaisParaCentavos trata
// vírgula e ponto), mas <input type="number"> tem sanitização própria do
// jsdom: atribuir "10,00" via fireEvent.change é silenciosamente convertido
// para "" (confirmado isoladamente fora deste arquivo), o que reprovaria
// toda validação do formulário antes mesmo de chegar no upload de imagem.
// Ponto evita esse limite do ambiente de teste sem mexer no campo real.
// ---------------------------------------------
async function preencherEAnexar() {
  fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Novo' } });
  fireEvent.change(screen.getByLabelText('Preço'), { target: { value: '10.00' } });
  fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '1' } });

  const arquivo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'foto.png', {
    type: 'image/png',
  });
  fireEvent.change(screen.getByLabelText('Imagem'), { target: { files: [arquivo] } });
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
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
  });

  it('produto criado com falha no upload avisa sem sugerir recadastro', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(produtoCriado())
      .mockRejectedValueOnce(new ApiError(413, 'A imagem excede o limite de 2 MB.'));
    abrirFormularioDeCriacao(post);

    await preencherEAnexar();

    await screen.findByText(/produto criado, mas a imagem não foi enviada/i);
    expect(screen.queryByText(/não foi possível salvar/i)).toBeNull();
  });

  it('não chama a rota de imagem quando nenhum arquivo foi anexado', async () => {
    const post = vi.fn().mockResolvedValue(produtoCriado());
    abrirFormularioDeCriacao(post);

    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Sem foto' } });
    fireEvent.change(screen.getByLabelText('Preço'), { target: { value: '10.00' } });
    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/products');
  });

  it('produto salvo com falha no upload avisa e não navega (modo edição)', async () => {
    const get = vi.fn((caminho: string) => {
      if (caminho.startsWith('/categories')) return Promise.resolve(CATEGORIAS);
      if (caminho.startsWith('/products/7')) return Promise.resolve(produtoCriado());
      return Promise.reject(new Error(`get não mapeado no mock: ${caminho}`));
    });
    const patch = vi.fn().mockResolvedValue(produtoCriado());
    const post = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(413, 'A imagem excede o limite de 2 MB.'));

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
    expect(screen.getByRole('heading', { name: 'Editar produto' })).toBeInTheDocument();
    expect(patch).toHaveBeenCalledTimes(1);
  });
});
