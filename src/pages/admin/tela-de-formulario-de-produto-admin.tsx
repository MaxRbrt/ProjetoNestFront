import { centavosParaReais, reaisParaCentavos } from '../../utils/dinheiro';
import {
  useEffect,
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
import { buscarProduto, urlDaImagemDoProduto, type Produto } from '../../api/produtos';
import { Aviso, Botao, Campo, Selecao, classesDeBotao } from '../../ui/indice';
import { useCategorias } from '../../hooks/use-categorias';

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
// A navegação para a edição troca só os parâmetros de rota, não desmonta
// o componente (mesmo slot, mesmo tipo dentro de <Routes>) — um estado
// inicial de useState nunca veria esse aviso, porque o inicializador só
// roda na montagem real. Por isso o aviso entra por efeito, reagindo à
// mudança do próprio location.state. O state é consumido uma única vez:
// depois de fixar o texto em `erro`, a entrada do histórico é substituída
// sem o state, para que apertar Voltar depois de corrigir e salvar não
// traga o aviso velho de volta sobre um produto já certo; a execução
// seguinte do efeito, já com o state limpo, não faz nada.
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
  setErro: Dispatch<SetStateAction<string | null>>,
) {
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
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar o produto.');
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, idDaRota, setCampos, setProduto, setErro]);
}

// ---------------------------------------------
// Pré-visualização do arquivo anexado
// jsdom não implementa URL.createObjectURL/revokeObjectURL nativamente
// (os testes fazem stub); em produção, a URL de objeto precisa ser
// revogada no cleanup deste efeito — senão cada troca de arquivo vaza
// memória enquanto a tela ficar montada.
// ---------------------------------------------
function usePreviaDoArquivo(arquivo: File | null): string | null {
  const [previa, setPrevia] = useState<string | null>(null);

  useEffect(() => {
    if (!arquivo) {
      setPrevia(null);
      return;
    }

    const url = URL.createObjectURL(arquivo);
    setPrevia(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [arquivo]);

  return previa;
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
  const navegar = useNavigate();
  const { categorias } = useCategorias(cliente);
  const emEdicao = parametros.id !== undefined;

  const [campos, setCampos] = useState<CamposDoProduto>(CAMPOS_VAZIOS);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useAvisoDaNavegacao(emEdicao, setErro);
  useProdutoEmEdicao(cliente, parametros.id, setCampos, setProduto, setErro);
  const previa = usePreviaDoArquivo(arquivo);
  const urlDaImagemAtual =
    emEdicao && produto ? urlDaImagemDoProduto(produto) : null;

  function alterarCampo(campo: keyof CamposDoProduto, valor: string) {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
  }

  async function aoRemoverImagem() {
    if (!produto) return;

    try {
      const atualizado = await removerImagemDoProduto(cliente, produto.id);
      setProduto(atualizado);
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível remover a imagem.',
      );
    }
  }

  async function aoSalvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const precoEmCentavos = reaisParaCentavos(campos.preco);
    if (precoEmCentavos === null) {
      setErro('Informe um preço válido, como 19,90.');
      return;
    }

    setSalvando(true);

    const dados: DadosDeProduto = {
      nome: campos.nome,
      precoEmCentavos,
      categoriaId: Number(campos.categoriaId),
      estoque: Number(campos.estoque),
    };

    try {
      if (emEdicao) {
        const id = Number(parametros.id);
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
        navegar('/admin/produtos');
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
        navegar('/admin/produtos');
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
    <div className="max-w-xl">
      <h1 className="text-balance text-2xl font-bold text-tinta">
        {emEdicao ? 'Editar produto' : 'Novo produto'}
      </h1>

      {erro ? (
        <div className="mt-4">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}

      <form
        className="mt-6 flex flex-col gap-4 rounded-card border border-borda bg-superficie p-5 shadow-carta sm:p-6"
        onSubmit={aoSalvar}
      >
        <Campo
          rotulo="Nome"
          value={campos.nome}
          onChange={(evento) => alterarCampo('nome', evento.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Preço"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={campos.preco}
            onChange={(evento) => alterarCampo('preco', evento.target.value)}
            required
          />
          <Campo
            rotulo="Estoque"
            type="number"
            min="0"
            inputMode="numeric"
            value={campos.estoque}
            onChange={(evento) => alterarCampo('estoque', evento.target.value)}
            required
          />
        </div>
        <Selecao
          rotulo="Categoria"
          value={campos.categoriaId}
          onChange={(evento) => alterarCampo('categoriaId', evento.target.value)}
          required
        >
          <option value="" disabled>
            Selecione
          </option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </Selecao>

        {urlDaImagemAtual ? (
          <div className="flex flex-wrap items-center gap-4 rounded-card border border-borda bg-superficie-sutil p-3">
            <img
              className="size-32 rounded-pequeno bg-superficie object-contain"
              src={urlDaImagemAtual}
              width={128}
              height={128}
              alt="Imagem atual do produto"
            />
            <Botao
              type="button"
              variante="secundario"
              tamanho="pequeno"
              onClick={aoRemoverImagem}
            >
              Remover imagem
            </Botao>
          </div>
        ) : null}

        <Campo
          rotulo="Imagem"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          ajuda="JPEG, PNG ou WebP."
          className="py-2 file:mr-3 file:rounded-pequeno file:border-0 file:bg-superficie-sutil file:px-3 file:py-1 file:text-sm file:font-medium file:text-tinta"
          onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
        />

        {previa ? (
          <img
            className="size-32 rounded-pequeno border border-borda bg-superficie-sutil object-contain"
            src={previa}
            width={128}
            height={128}
            alt="Pré-visualização da imagem selecionada"
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Link
            to="/admin/produtos"
            className={classesDeBotao({ variante: 'fantasma' })}
          >
            Cancelar
          </Link>
          <Botao type="submit" carregando={salvando}>
            Salvar
          </Botao>
        </div>
      </form>
    </div>
  );
}
