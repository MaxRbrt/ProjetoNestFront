import { formatarCentavos } from '../../utils/dinheiro';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { buscarProduto } from '../../api/produtos';
import type { Produto } from '../../api/produtos';
import { criarPedido } from '../../api/pedidos';
import { listarEnderecos, type Endereco } from '../../api/enderecos';
import { consultarFrete, type OpcaoDeFrete } from '../../api/frete';
import { useCarrinho } from '../../auth/contexto-do-carrinho';
import { Cabecalho } from '../../components/cabecalho';
import { NavPrincipal } from '../../components/nav-principal';
import { Aviso, Botao } from '../../components/primitivos';
import './tela-de-carrinho.css';

interface PropsDaTela {
  cliente: ApiClient;
}

interface LinhaDoCarrinho {
  produto: Produto;
  quantidade: number;
}

// ---------------------------------------------
// Tela do carrinho
// O contexto só guarda produtoId e quantidade; nome e preço são buscados de
// novo aqui para nunca exibir dado desatualizado. Um produto removido do
// catálogo entre a adição e a visita a esta tela some da lista em vez de
// quebrar a renderização inteira (Promise.allSettled, não Promise.all) — o
// carrinho persistido não tem como saber que o produto sumiu até perguntar à
// API. Erro de carga (buscar produtos) e erro de ação (finalizar pedido)
// ficam em estados separados: um erro ao finalizar não pode esconder a
// tabela que o usuário precisa ver para corrigir o carrinho. A chave de
// idempotência é gerada uma vez por conteúdo de carrinho e reaproveitada
// entre tentativas — se a resposta do checkout se perder na rede, o retry
// manual do usuário reenvia a mesma chave em vez de criar um pedido
// duplicado; só um carrinho realmente diferente (efeito com [itens] como
// dependência) gera uma chave nova.
// ---------------------------------------------
export function TelaDeCarrinho({ cliente }: PropsDaTela) {
  const { itens, atualizarQuantidade, removerItem, limpar } = useCarrinho();
  const navegar = useNavigate();
  const [linhas, setLinhas] = useState<LinhaDoCarrinho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [carregandoEnderecos, setCarregandoEnderecos] = useState(true);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<
    number | null
  >(null);
  const [opcoesDeFrete, setOpcoesDeFrete] = useState<OpcaoDeFrete[]>([]);
  const [carregandoFrete, setCarregandoFrete] = useState(false);
  const [erroDeFrete, setErroDeFrete] = useState<string | null>(null);
  const [modalidadeSelecionada, setModalidadeSelecionada] =
    useState<string | null>(null);
  const chaveDeIdempotenciaRef = useRef<string | null>(null);

  // ---------------------------------------------
  // Endereços disponíveis para o checkout
  // Pré-seleciona o principal (a API já devolve a lista com ele primeiro).
  // Sem endereço nenhum, o botão de finalizar fica bloqueado — pedido sem
  // destino de entrega não existe mais neste projeto.
  // ---------------------------------------------
  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    listarEnderecos(cliente, controlador.signal)
      .then((lista) => {
        if (cancelado) return;
        setEnderecos(lista);
        setEnderecoSelecionadoId((atual) => atual ?? lista[0]?.id ?? null);
        setCarregandoEnderecos(false);
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') return;
        setCarregandoEnderecos(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente]);

  // ---------------------------------------------
  // Cotação de frete
  // Depende do endereço (região) e da quantidade total de itens do carrinho
  // — não dispara antes de haver as duas coisas. Ao trocar de endereço, a
  // modalidade escolhida é resetada: o custo daquela modalidade era para o
  // endereço anterior, e mantê-la selecionada mostraria um preço que não é
  // mais o real até a nova cotação chegar.
  // ---------------------------------------------
  useEffect(() => {
    if (!enderecoSelecionadoId || itens.length === 0) {
      setOpcoesDeFrete([]);
      setModalidadeSelecionada(null);
      return;
    }

    const controlador = new AbortController();
    let cancelado = false;
    setCarregandoFrete(true);
    setErroDeFrete(null);
    setModalidadeSelecionada(null);

    consultarFrete(
      cliente,
      enderecoSelecionadoId,
      itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
      })),
      controlador.signal,
    )
      .then((opcoes) => {
        if (cancelado) return;
        setOpcoesDeFrete(opcoes);
        setModalidadeSelecionada(opcoes[0]?.modalidade ?? null);
        setCarregandoFrete(false);
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') return;
        setErroDeFrete(
          falha instanceof ApiError
            ? falha.message
            : 'Não foi possível calcular o frete agora.',
        );
        setCarregandoFrete(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, enderecoSelecionadoId, itens]);

  // Trocar o endereço ou a modalidade de frete é uma decisão nova sobre o
  // pedido, não um retry de rede: gerar outra chave evita que o backend
  // recuse o reenvio como conflito de payload (a chave antiga já reflete a
  // escolha anterior — o backend inclui os dois no hash de conferência).
  useEffect(() => {
    chaveDeIdempotenciaRef.current = null;
  }, [enderecoSelecionadoId, modalidadeSelecionada]);

  useEffect(() => {
    chaveDeIdempotenciaRef.current = null;

    if (itens.length === 0) {
      setLinhas([]);
      setCarregando(false);
      return;
    }

    const controlador = new AbortController();
    let cancelado = false;
    setCarregando(true);
    setErroDeCarga(null);

    Promise.allSettled(
      itens.map((item) =>
        buscarProduto(cliente, item.produtoId, controlador.signal).then(
          (produto) => ({ produto, quantidade: item.quantidade }),
        ),
      ),
    ).then((resultados) => {
      if (cancelado) return;
      const linhasCarregadas = resultados
        .filter(
          (resultado): resultado is PromiseFulfilledResult<LinhaDoCarrinho> =>
            resultado.status === 'fulfilled',
        )
        .map((resultado) => resultado.value);
      setLinhas(linhasCarregadas);
      setCarregando(false);
    });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, itens]);

  const subtotal = linhas.reduce(
    (soma, linha) => soma + linha.produto.precoEmCentavos * linha.quantidade,
    0,
  );
  const opcaoSelecionada = opcoesDeFrete.find(
    (opcao) => opcao.modalidade === modalidadeSelecionada,
  );
  const total = subtotal + (opcaoSelecionada?.custoEmCentavos ?? 0);

  async function finalizarPedido() {
    if (!enderecoSelecionadoId || !modalidadeSelecionada) return;
    setErroDeAcao(null);
    setFinalizando(true);
    try {
      if (!chaveDeIdempotenciaRef.current) {
        chaveDeIdempotenciaRef.current = crypto.randomUUID();
      }
      const pedido = await criarPedido(
        cliente,
        enderecoSelecionadoId,
        modalidadeSelecionada,
        itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
        })),
        chaveDeIdempotenciaRef.current,
      );
      limpar();
      navegar(`/pedidos/${pedido.id}`);
    } catch (falha) {
      setErroDeAcao(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível finalizar o pedido agora.',
      );
      setFinalizando(false);
    }
  }

  return (
    <>
      <Cabecalho links={<NavPrincipal />} />

      <main className="tela-carrinho">
        <h1>Carrinho</h1>

        {erroDeCarga ? <Aviso>{erroDeCarga}</Aviso> : null}

        {!erroDeCarga && carregando ? (
          <p role="status">Carregando carrinho…</p>
        ) : null}

        {!erroDeCarga && !carregando && linhas.length === 0 ? (
          <p className="tela-carrinho__vazio">
            Seu carrinho está vazio.{' '}
            <Link to="/produtos">Ver produtos</Link>
          </p>
        ) : null}

        {!erroDeCarga && !carregando && linhas.length > 0 ? (
          <>
            {erroDeAcao ? <Aviso>{erroDeAcao}</Aviso> : null}

            <table className="tela-carrinho__tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço</th>
                  <th>Quantidade</th>
                  <th>Subtotal</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.produto.id}>
                    <td>{linha.produto.nome}</td>
                    <td>{formatarCentavos(linha.produto.precoEmCentavos)}</td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={linha.produto.estoque}
                        value={linha.quantidade}
                        aria-label={`Quantidade de ${linha.produto.nome}`}
                        onChange={(evento) => {
                          const valor = Number(evento.target.value);
                          if (!Number.isInteger(valor)) return;
                          atualizarQuantidade(
                            linha.produto.id,
                            Math.min(Math.max(valor, 1), linha.produto.estoque),
                          );
                        }}
                      />
                    </td>
                    <td>
                      {formatarCentavos(
                        linha.produto.precoEmCentavos * linha.quantidade,
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Remover ${linha.produto.nome}`}
                        onClick={() => removerItem(linha.produto.id)}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="tela-carrinho__subtotal">
              Subtotal: {formatarCentavos(subtotal)}
            </p>

            <div className="tela-carrinho__endereco">
              <h2>Entregar em</h2>
              {carregandoEnderecos ? (
                <p role="status">Carregando endereços…</p>
              ) : enderecos.length === 0 ? (
                <p>
                  Você ainda não tem um endereço cadastrado.{' '}
                  <Link to="/enderecos">Cadastrar endereço</Link>
                </p>
              ) : (
                <div className="campo">
                  <label className="campo__rotulo" htmlFor="endereco-de-entrega">
                    Endereço
                  </label>
                  <select
                    id="endereco-de-entrega"
                    className="campo__entrada"
                    value={enderecoSelecionadoId ?? ''}
                    onChange={(evento) =>
                      setEnderecoSelecionadoId(Number(evento.target.value))
                    }
                  >
                    {enderecos.map((endereco) => (
                      <option key={endereco.id} value={endereco.id}>
                        {endereco.apelido} — {endereco.logradouro},{' '}
                        {endereco.numero}, {endereco.cidade}/{endereco.uf}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {enderecoSelecionadoId ? (
              <div className="tela-carrinho__frete">
                <h2>Frete</h2>
                {erroDeFrete ? <Aviso>{erroDeFrete}</Aviso> : null}
                {!erroDeFrete && carregandoFrete ? (
                  <p role="status">Calculando frete…</p>
                ) : null}
                {!erroDeFrete && !carregandoFrete && opcoesDeFrete.length > 0 ? (
                  <fieldset className="tela-carrinho__opcoes-de-frete">
                    <legend className="campo__rotulo">Modalidade</legend>
                    {opcoesDeFrete.map((opcao) => (
                      <label
                        key={opcao.modalidade}
                        className="tela-carrinho__opcao-de-frete"
                      >
                        <input
                          type="radio"
                          name="modalidade-de-frete"
                          value={opcao.modalidade}
                          checked={modalidadeSelecionada === opcao.modalidade}
                          onChange={() =>
                            setModalidadeSelecionada(opcao.modalidade)
                          }
                        />
                        {opcao.modalidade} —{' '}
                        {formatarCentavos(opcao.custoEmCentavos)} — até{' '}
                        {opcao.prazoEmDiasUteis} dias úteis
                      </label>
                    ))}
                  </fieldset>
                ) : null}
              </div>
            ) : null}

            <p className="tela-carrinho__total">
              Total: {formatarCentavos(total)}
            </p>

            <Botao
              carregando={finalizando}
              disabled={
                !enderecoSelecionadoId ||
                carregandoEnderecos ||
                !modalidadeSelecionada ||
                carregandoFrete
              }
              onClick={() => void finalizarPedido()}
            >
              {finalizando ? 'Finalizando…' : 'Finalizar pedido'}
            </Botao>
          </>
        ) : null}
      </main>
    </>
  );
}
