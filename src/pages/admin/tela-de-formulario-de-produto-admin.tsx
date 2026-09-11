import { centavosParaReais, reaisParaCentavos } from '../../utils/dinheiro';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { Aviso, Botao, Campo } from '../../components/primitivos';
import { useCategorias } from '../../hooks/use-categorias';
import './tela-de-formulario-de-produto-admin.css';

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

// ---------------------------------------------
// Formulário de produto (criar e editar)
// O modo é decidido pela presença de :id na rota, não por uma prop separada:
// evita duas telas quase idênticas divergindo com o tempo. No modo edição, o
// produto é buscado uma vez para preencher os campos; a categoria vem do
// mesmo hook que a vitrine pública usa para o filtro.
// ---------------------------------------------
export function TelaDeFormularioDeProdutoAdmin({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id?: string }>();
  const navegar = useNavigate();
  const localizacao = useLocation();
  const { categorias } = useCategorias(cliente);
  const emEdicao = parametros.id !== undefined;
  const estadoDeNavegacao = localizacao.state as EstadoDeNavegacao | null;

  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [estoque, setEstoque] = useState('');
  const [produto, setProduto] = useState<Produto | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // ---------------------------------------------
  // Aviso vindo da navegação (falha de upload logo após criar)
  // A navegação para a edição troca só os parâmetros de rota, não desmonta
  // o componente (mesmo slot, mesmo tipo dentro de <Routes>) — um estado
  // inicial de useState nunca veria esse aviso, porque o inicializador só
  // roda na montagem real. Por isso o aviso entra por efeito, reagindo à
  // mudança do próprio location.state. O state é consumido uma única vez:
  // depois de fixar o texto em `erro`, a entrada do histórico é substituída
  // sem o state, para que apertar Voltar depois de corrigir e salvar não
  // traga o aviso velho de volta sobre um produto já certo. O state é
  // consumido uma única vez; a execução seguinte do efeito, já com o state
  // limpo, não faz nada.
  // ---------------------------------------------
  useEffect(() => {
    if (emEdicao && estadoDeNavegacao?.aviso) {
      setErro(estadoDeNavegacao.aviso);
      navegar(localizacao.pathname, { replace: true, state: null });
    }
  }, [emEdicao, estadoDeNavegacao?.aviso, localizacao.pathname, navegar]);

  useEffect(() => {
    if (!emEdicao) return;

    let cancelado = false;
    const controlador = new AbortController();
    const id = Number(parametros.id);

    buscarProduto(cliente, id, controlador.signal)
      .then((produtoCarregado) => {
        if (cancelado) return;
        setNome(produtoCarregado.nome);
        setPreco(centavosParaReais(produtoCarregado.precoEmCentavos));
        setCategoriaId(String(produtoCarregado.categoriaId));
        setEstoque(String(produtoCarregado.estoque));
        setProduto(produtoCarregado);
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar o produto.');
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, emEdicao, parametros.id]);

  // ---------------------------------------------
  // Pré-visualização do arquivo anexado
  // jsdom não implementa URL.createObjectURL/revokeObjectURL nativamente
  // (os testes fazem stub); em produção, a URL de objeto precisa ser
  // revogada no cleanup deste efeito — senão cada troca de arquivo vaza
  // memória enquanto a tela ficar montada.
  // ---------------------------------------------
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

  // ---------------------------------------------
  // Remoção da imagem atual
  // Só existe no modo edição, com produto já carregado. O produto devolvido
  // pela rota de remoção substitui o estado local para refletir
  // nomeDoArquivoDaImagem: null sem precisar recarregar a tela inteira.
  // ---------------------------------------------
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

  // ---------------------------------------------
  // Gravação do produto
  // O campo de preço é digitado em reais, com vírgula ou ponto, e a API só
  // aceita centavos inteiros. A conversão falha explicitamente em vez de
  // enviar NaN: sem esta checagem, "dezenove reais" viraria um preço nulo no
  // catálogo sem nenhum aviso para quem cadastrou.
  //
  // O upload da imagem, quando há arquivo anexado, roda num try próprio,
  // separado do try da criação/atualização: em edição, o produto já
  // existia, então a falha do upload não pode virar "não foi possível
  // salvar" — fica na própria tela com aviso específico, sem navegar. Na
  // criação, o produto já foi criado com sucesso quando o upload falha;
  // ficar no modo criação faria o próximo clique em Salvar criar um
  // segundo produto, então a tela navega (replace, sem deixar a tela de
  // criação no histórico) para a edição do produto recém-criado, com o
  // aviso explicando o que falhou.
  // ---------------------------------------------
  async function aoSalvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const precoEmCentavos = reaisParaCentavos(preco);
    if (precoEmCentavos === null) {
      setErro('Informe um preço válido, como 19,90.');
      return;
    }

    setSalvando(true);

    const dados: DadosDeProduto = {
      nome,
      precoEmCentavos,
      categoriaId: Number(categoriaId),
      estoque: Number(estoque),
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
            const motivo = (
              falhaDeImagem instanceof ApiError
                ? falhaDeImagem.message
                : 'erro desconhecido'
            ).replace(/\.$/, '');
            setErro(`Produto salvo, mas a imagem não foi enviada: ${motivo}.`);
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
            const motivo = (
              falhaDeImagem instanceof ApiError
                ? falhaDeImagem.message
                : 'erro desconhecido'
            ).replace(/\.$/, '');
            navegar(`/admin/produtos/${criado.id}/editar`, {
              replace: true,
              state: {
                aviso: `Produto criado, mas a imagem não foi enviada: ${motivo}. Tente enviar de novo.`,
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
    <div>
      <h1>{emEdicao ? 'Editar produto' : 'Novo produto'}</h1>

      {erro ? <Aviso>{erro}</Aviso> : null}

      <form className="admin-form" onSubmit={aoSalvar}>
        <Campo
          rotulo="Nome"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          required
        />
        <Campo
          rotulo="Preço"
          type="number"
          step="0.01"
          value={preco}
          onChange={(evento) => setPreco(evento.target.value)}
          required
        />
        <div className="campo">
          <label className="campo__rotulo" htmlFor="categoria">
            Categoria
          </label>
          <select
            id="categoria"
            className="campo__entrada"
            value={categoriaId}
            onChange={(evento) => setCategoriaId(evento.target.value)}
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
          </select>
        </div>
        <Campo
          rotulo="Estoque"
          type="number"
          value={estoque}
          onChange={(evento) => setEstoque(evento.target.value)}
          required
        />

        {emEdicao && produto && urlDaImagemDoProduto(produto) ? (
          <div className="admin-form__imagem-atual">
            <img
              className="admin-form__imagem"
              src={urlDaImagemDoProduto(produto) ?? undefined}
              alt="Imagem atual do produto"
            />
            <Botao type="button" variante="secundario" onClick={aoRemoverImagem}>
              Remover imagem
            </Botao>
          </div>
        ) : null}

        <Campo
          rotulo="Imagem"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
        />

        {previa ? (
          <img
            className="admin-form__imagem"
            src={previa}
            alt="Pré-visualização da imagem selecionada"
          />
        ) : null}

        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </div>
  );
}
