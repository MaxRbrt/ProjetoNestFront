import { centavosParaReais, reaisParaCentavos } from '../../utils/dinheiro';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import {
  atualizarProduto,
  criarProduto,
  enviarImagemDoProduto,
  removerImagemDoProduto,
  type DadosDeProduto,
} from '../../api/catalogo-admin';
import {
  buscarProduto,
  urlDaImagemDoProduto,
  type Produto,
} from '../../api/produtos';
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Esqueleto,
  Etiqueta,
  Selecao,
  classesDeBotao,
} from '../../ui/indice';
import { CabecalhoDaPagina } from '../../layout/cabecalho-da-pagina';
import { useCategorias } from '../../hooks/use-categorias';
import { ImagemDoProdutoAdmin } from './imagem-do-produto-admin';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Estado passado por navigate() ao cair no modo edição após falha de upload
// A tela de criação usa `replace` com esse estado quando o produto foi
// criado mas a imagem falhou, para explicar o aviso na tela de edição.
// ---------------------------------------------
interface EstadoDeNavegacao {
  aviso?: string;
}

interface CamposDoProduto {
  nome: string;
  preco: string;
  categoriaId: string;
  estoque: string;
}

const CAMPOS_VAZIOS: CamposDoProduto = {
  nome: '',
  preco: '',
  categoriaId: '',
  estoque: '',
};

function validarCampos(
  campos: CamposDoProduto,
): Partial<Record<keyof CamposDoProduto, string>> {
  const erros: Partial<Record<keyof CamposDoProduto, string>> = {};
  if (!campos.nome.trim()) erros.nome = 'Informe o nome do produto.';
  const preco = reaisParaCentavos(campos.preco);
  if (
    !/^\d+(?:[.,]\d{1,2})?$/.test(campos.preco.trim()) ||
    preco === null ||
    !Number.isSafeInteger(preco) ||
    preco <= 0
  ) {
    erros.preco = 'Informe um preço maior que zero, como 19,90.';
  }
  if (
    !/^\d+$/.test(campos.estoque) ||
    !Number.isSafeInteger(Number(campos.estoque))
  ) {
    erros.estoque = 'Informe uma quantidade inteira, igual ou maior que zero.';
  }
  if (
    !Number.isSafeInteger(Number(campos.categoriaId)) ||
    Number(campos.categoriaId) <= 0
  ) {
    erros.categoriaId = 'Selecione uma categoria.';
  }
  return erros;
}

// ---------------------------------------------
// Motivo legível de uma falha de upload
// A mensagem do backend já vem em PT-BR e termina em ponto; o ponto final é
// retirado porque o texto é encaixado no meio de uma frase maior.
// ---------------------------------------------
function motivoDaFalhaDeImagem(falha: unknown): string {
  return (
    falha instanceof ApiError ? falha.message : 'erro desconhecido'
  ).replace(/\.$/, '');
}

// ---------------------------------------------
// Aviso vindo da navegação (falha de upload logo após criar)
// Consome location.state uma vez e limpa a entrada do histórico para não
// repetir o aviso ao voltar. O formulário tem chave por id: mudar de produto
// também descarta campos, arquivo e erros que pertenciam à edição anterior.
// ---------------------------------------------
function useAvisoDaNavegacao(
  emEdicao: boolean,
  setErro: Dispatch<SetStateAction<string | null>>,
) {
  const navegar = useNavigate();
  const localizacao = useLocation();
  const aviso = (localizacao.state as EstadoDeNavegacao | null)?.aviso;

  useEffect(() => {
    if (emEdicao && aviso) {
      setErro(aviso);
      navegar(localizacao.pathname, { replace: true, state: null });
    }
  }, [emEdicao, aviso, localizacao.pathname, navegar, setErro]);
}

// ---------------------------------------------
// Carga do produto no modo edição
// O produto é buscado uma vez por id para preencher os campos. Recebe só
// setters de useState (estáveis entre renderizações), então o efeito não
// dispara de novo a cada tecla digitada. Leitura abortada no cleanup e
// ignorada pela flag de cancelamento, como em todo efeito de leitura.
// ---------------------------------------------
function useProdutoEmEdicao(
  cliente: ApiClient,
  idDaRota: string | undefined,
  setCampos: Dispatch<SetStateAction<CamposDoProduto>>,
  setProduto: Dispatch<SetStateAction<Produto | null>>,
) {
  const [tentativa, setTentativa] = useState(0);
  const [carga, setCarga] = useState<{
    tentativa: number;
    erro: string | null;
  } | null>(null);
  useEffect(() => {
    if (idDaRota === undefined) return;

    let cancelado = false;
    const controlador = new AbortController();

    buscarProduto(cliente, Number(idDaRota), controlador.signal)
      .then((produtoCarregado) => {
        if (cancelado) return;
        setCampos({
          nome: produtoCarregado.nome,
          preco: centavosParaReais(produtoCarregado.precoEmCentavos),
          categoriaId: String(produtoCarregado.categoriaId),
          estoque: String(produtoCarregado.estoque),
        });
        setProduto(produtoCarregado);
        setCarga({ tentativa, erro: null });
      })
      .catch(() => {
        if (!cancelado)
          setCarga({ tentativa, erro: 'Não foi possível carregar o produto.' });
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, idDaRota, tentativa, setCampos, setProduto]);
  return {
    carregando: idDaRota !== undefined && carga?.tentativa !== tentativa,
    erro: carga?.tentativa === tentativa ? carga.erro : null,
    recarregar: () => setTentativa((atual) => atual + 1),
  };
}

// ---------------------------------------------
// Formulário de produto (criar e editar)
// O modo é decidido pela presença de :id na rota, não por uma prop separada:
// evita duas telas quase idênticas divergindo com o tempo. A categoria vem do
// mesmo hook que a vitrine pública usa para o filtro.
//
// Remover a imagem só existe no modo edição, com produto já carregado; o
// produto devolvido pela rota de remoção substitui o estado local para
// refletir nomeDoArquivoDaImagem: null sem recarregar a tela inteira.
//
// Ao salvar, o preço é digitado em reais, com vírgula ou ponto, e a API só
// aceita centavos inteiros. A conversão falha explicitamente em vez de
// enviar NaN: sem esta checagem, "dezenove reais" viraria um preço nulo no
// catálogo sem nenhum aviso para quem cadastrou.
//
// O upload da imagem, quando há arquivo anexado, roda num try próprio,
// separado do try da criação/atualização: em edição, o produto já existia,
// então a falha do upload não pode virar "não foi possível salvar" — fica
// na própria tela com aviso específico, sem navegar. Na criação, o produto
// já foi criado com sucesso quando o upload falha; ficar no modo criação
// faria o próximo clique em Salvar criar um segundo produto, então a tela
// navega (replace, sem deixar a tela de criação no histórico) para a
// edição do produto recém-criado, com o aviso explicando o que falhou.
// ---------------------------------------------
export function TelaDeFormularioDeProdutoAdmin({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id?: string }>();
  return (
    <FormularioDeProduto
      key={parametros.id ?? 'novo'}
      cliente={cliente}
      idDaRota={parametros.id}
    />
  );
}

function FormularioDeProduto({
  cliente,
  idDaRota,
}: PropsDaTela & { idDaRota?: string }) {
  const idDoFormulario = useId();
  const navegar = useNavigate();
  const {
    categorias,
    carregando: carregandoCategorias,
    erro: erroDasCategorias,
    recarregar: recarregarCategorias,
  } = useCategorias(cliente);
  const emEdicao = idDaRota !== undefined;

  const [campos, setCampos] = useState<CamposDoProduto>(CAMPOS_VAZIOS);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [removendoImagem, setRemovendoImagem] = useState(false);
  const [erroDaImagem, setErroDaImagem] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [validacaoVisivel, setValidacaoVisivel] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const avisoDeErro = useRef<HTMLDivElement>(null);
  const errosDosCampos = validarCampos(campos);
  useEffect(() => {
    if (erro) avisoDeErro.current?.focus();
  }, [erro]);

  useAvisoDaNavegacao(emEdicao, setErro);
  const cargaDoProduto = useProdutoEmEdicao(
    cliente,
    idDaRota,
    setCampos,
    setProduto,
  );
  const urlDaImagemAtual =
    emEdicao && produto ? urlDaImagemDoProduto(produto) : null;
  const ocupado = salvando || removendoImagem;
  const bloqueado =
    ocupado ||
    Boolean(erroDaImagem) ||
    cargaDoProduto.carregando ||
    Boolean(cargaDoProduto.erro) ||
    carregandoCategorias ||
    Boolean(erroDasCategorias) ||
    categorias.length === 0;

  function alterarCampo(campo: keyof CamposDoProduto, valor: string) {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
  }

  async function aoRemoverImagem() {
    if (!produto || ocupado) return;
    setRemovendoImagem(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizado = await removerImagemDoProduto(cliente, produto.id);
      setProduto(atualizado);
      setSucesso('Imagem removida do produto.');
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível remover a imagem.',
      );
    } finally {
      setRemovendoImagem(false);
    }
  }

  async function aoSalvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (bloqueado) return;
    setErro(null);
    setSucesso(null);
    setValidacaoVisivel(true);
    const precoEmCentavos = reaisParaCentavos(campos.preco);
    if (Object.keys(errosDosCampos).length || precoEmCentavos === null) {
      const primeiroCampo = Object.keys(errosDosCampos)[0];
      formulario.current
        ?.querySelector<HTMLInputElement | HTMLSelectElement>(
          `[name="${primeiroCampo}"]`,
        )
        ?.focus();
      return;
    }

    setSalvando(true);

    const dados: DadosDeProduto = {
      nome: campos.nome.trim(),
      precoEmCentavos,
      categoriaId: Number(campos.categoriaId),
      estoque: Number(campos.estoque),
    };

    try {
      if (emEdicao) {
        const id = Number(idDaRota);
        const atualizado = await atualizarProduto(cliente, id, dados);
        setProduto(atualizado);

        if (arquivo) {
          try {
            await enviarImagemDoProduto(cliente, id, arquivo);
          } catch (falhaDeImagem) {
            setErro(
              `Produto salvo, mas a imagem não foi enviada: ${motivoDaFalhaDeImagem(falhaDeImagem)}.`,
            );
            return;
          }
        }
        navegar('/admin/produtos', {
          state: { sucesso: 'Produto atualizado com sucesso.' },
        });
      } else {
        const criado = await criarProduto(cliente, dados);

        if (arquivo) {
          try {
            await enviarImagemDoProduto(cliente, criado.id, arquivo);
          } catch (falhaDeImagem) {
            navegar(`/admin/produtos/${criado.id}/editar`, {
              replace: true,
              state: {
                aviso: `Produto criado, mas a imagem não foi enviada: ${motivoDaFalhaDeImagem(falhaDeImagem)}. Tente enviar de novo.`,
              },
            });
            return;
          }
        }
        navegar('/admin/produtos', {
          state: { sucesso: 'Produto cadastrado com sucesso.' },
        });
      }
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível salvar o produto.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <CabecalhoDaPagina
        trilha={[
          { rotulo: 'Produtos', para: '/admin/produtos' },
          { rotulo: emEdicao ? 'Editar produto' : 'Novo produto' },
        ]}
        titulo={emEdicao ? 'Editar produto' : 'Novo produto'}
        descricao={
          emEdicao
            ? 'Atualize as informações e a imagem do produto.'
            : 'Prepare as informações do produto para o catálogo.'
        }
        acao={produto ? <Etiqueta>Produto #{produto.id}</Etiqueta> : undefined}
      />

      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-y border-borda bg-fundo py-3">
        <p className="hidden text-base text-tinta-media sm:block">
          {salvando ? 'Salvando produto…' : 'Revise os dados antes de salvar.'}
        </p>
        <div className="grid w-full grid-cols-2 gap-3 sm:ml-auto sm:w-auto sm:flex">
          <Botao
            type="button"
            variante="secundario"
            disabled={ocupado}
            onClick={() => navegar('/admin/produtos')}
          >
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form={idDoFormulario}
            carregando={salvando}
            disabled={bloqueado}
          >
            {salvando
              ? 'Salvando…'
              : emEdicao
                ? 'Salvar alterações'
                : 'Salvar produto'}
          </Botao>
        </div>
      </div>

      {erro ? (
        <div
          ref={avisoDeErro}
          tabIndex={-1}
          className="scroll-mt-32 rounded-card focus:outline-2 focus:outline-offset-4 focus:outline-erro"
        >
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}
      {sucesso ? <Aviso tipo="sucesso">{sucesso}</Aviso> : null}
      {cargaDoProduto.carregando ? (
        <Cartao className="flex flex-col gap-5">
          <p role="status" className="text-base text-tinta-media">
            Carregando produto…
          </p>
          <Esqueleto className="h-13 w-full" />
          <Esqueleto className="h-52 w-full" />
        </Cartao>
      ) : cargaDoProduto.erro ? (
        <Cartao className="flex flex-col items-start gap-4">
          <Aviso>{cargaDoProduto.erro}</Aviso>
          <Botao variante="secundario" onClick={cargaDoProduto.recarregar}>
            Tentar novamente
          </Botao>
        </Cartao>
      ) : (
        <form
          id={idDoFormulario}
          ref={formulario}
          onSubmit={aoSalvar}
          noValidate
        >
          <fieldset
            disabled={ocupado}
            className="grid min-w-0 gap-6 xl:grid-cols-3 [&_input]:scroll-mt-32 [&_select]:scroll-mt-32"
          >
            <legend className="sr-only">Dados do produto</legend>
            <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
              <Cartao
                como="section"
                aria-labelledby="informacoes-do-produto"
                className="flex flex-col gap-6"
              >
                <div>
                  <h2
                    id="informacoes-do-produto"
                    className="text-xl font-semibold text-tinta"
                  >
                    Informações principais
                  </h2>
                  <p className="mt-1 text-base text-tinta-media">
                    Como o produto será identificado na loja.
                  </p>
                </div>
                <Campo
                  rotulo="Nome"
                  name="nome"
                  value={campos.nome}
                  onChange={(evento) =>
                    alterarCampo('nome', evento.target.value)
                  }
                  erro={validacaoVisivel ? errosDosCampos.nome : undefined}
                  ajuda="Use um nome claro, que ajude a reconhecer o produto."
                  required
                />
              </Cartao>

              <ImagemDoProdutoAdmin
                arquivo={arquivo}
                urlAtual={urlDaImagemAtual}
                erro={erroDaImagem}
                removendo={removendoImagem}
                aoSelecionar={(selecionado, falha) => {
                  setArquivo(selecionado);
                  setErroDaImagem(falha);
                  setSucesso(null);
                }}
                aoRemover={aoRemoverImagem}
              />

              <Cartao
                como="section"
                aria-labelledby="venda-e-estoque"
                className="flex flex-col gap-6"
              >
                <div>
                  <h2
                    id="venda-e-estoque"
                    className="text-xl font-semibold text-tinta"
                  >
                    Preço e estoque
                  </h2>
                  <p className="mt-1 text-base text-tinta-media">
                    Defina o valor de venda e a quantidade disponível.
                  </p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Campo
                    rotulo="Preço"
                    name="preco"
                    inputMode="decimal"
                    value={campos.preco}
                    onChange={(evento) =>
                      alterarCampo('preco', evento.target.value)
                    }
                    erro={validacaoVisivel ? errosDosCampos.preco : undefined}
                    ajuda="Valor em reais (R$). Ex.: 19,90."
                    required
                  />
                  <Campo
                    rotulo="Estoque"
                    name="estoque"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={campos.estoque}
                    onChange={(evento) =>
                      alterarCampo('estoque', evento.target.value)
                    }
                    erro={validacaoVisivel ? errosDosCampos.estoque : undefined}
                    ajuda="Quantidade em unidades. Zero indica esgotado."
                    required
                  />
                </div>
              </Cartao>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <Cartao
                como="section"
                aria-labelledby="organizacao-do-produto"
                className="flex flex-col gap-5"
              >
                <h2
                  id="organizacao-do-produto"
                  className="text-xl font-semibold text-tinta"
                >
                  Organização
                </h2>
                {carregandoCategorias ? (
                  <p role="status" className="text-base text-tinta-media">
                    Carregando categorias…
                  </p>
                ) : erroDasCategorias ? (
                  <>
                    <Aviso>{erroDasCategorias}</Aviso>
                    <Botao
                      type="button"
                      variante="secundario"
                      onClick={recarregarCategorias}
                    >
                      Tentar novamente
                    </Botao>
                  </>
                ) : categorias.length === 0 ? (
                  <>
                    <p className="text-base text-tinta-media">
                      Cadastre uma categoria para organizar o produto.
                    </p>
                    <Link
                      to="/admin/categorias/novo"
                      className={classesDeBotao({
                        variante: 'secundario',
                        tamanho: 'pequeno',
                      })}
                    >
                      Cadastrar categoria
                    </Link>
                  </>
                ) : (
                  <Selecao
                    rotulo="Categoria"
                    name="categoriaId"
                    value={campos.categoriaId}
                    onChange={(evento) =>
                      alterarCampo('categoriaId', evento.target.value)
                    }
                    erro={
                      validacaoVisivel ? errosDosCampos.categoriaId : undefined
                    }
                    required
                  >
                    <option value="" disabled>
                      Selecione uma categoria
                    </option>
                    {produto &&
                    !categorias.some(
                      (categoria) => categoria.id === produto.categoriaId,
                    ) ? (
                      <option value={produto.categoriaId}>
                        Categoria #{produto.categoriaId}
                      </option>
                    ) : null}
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Cartao>

              <Cartao
                como="section"
                aria-labelledby="conferencia-do-produto"
                className="flex flex-col gap-5"
              >
                <div>
                  <h2
                    id="conferencia-do-produto"
                    className="text-xl font-semibold text-tinta"
                  >
                    Antes de salvar
                  </h2>
                  <p className="mt-1 text-base text-tinta-media">
                    Nome, preço, estoque e categoria são obrigatórios.
                  </p>
                </div>
                <ul className="divide-y divide-borda text-base">
                  {(
                    [
                      ['nome', 'Nome'],
                      ['preco', 'Preço'],
                      ['estoque', 'Estoque'],
                      ['categoriaId', 'Categoria'],
                    ] as const
                  ).map(([campo, rotulo]) => (
                    <li
                      key={campo}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-tinta">{rotulo}</span>
                      <span
                        className={
                          errosDosCampos[campo]
                            ? 'text-tinta-media'
                            : 'font-medium text-sucesso'
                        }
                      >
                        {errosDosCampos[campo] ? 'Pendente' : 'Preenchido'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-borda pt-4 text-base text-tinta-media">
                  {emEdicao
                    ? 'Ao salvar, as alterações serão aplicadas ao catálogo.'
                    : 'Ao salvar, o produto será incluído no catálogo.'}
                </p>
              </Cartao>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
