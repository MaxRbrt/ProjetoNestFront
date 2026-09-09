import { formatarCentavos } from '../../utils/dinheiro';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { buscarProduto } from '../../api/produtos';
import type { Produto } from '../../api/produtos';
import { criarPedido } from '../../api/pedidos';
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
  const chaveDeIdempotenciaRef = useRef<string | null>(null);

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

  const total = linhas.reduce(
    (soma, linha) => soma + linha.produto.precoEmCentavos * linha.quantidade,
    0,
  );

  async function finalizarPedido() {
    setErroDeAcao(null);
    setFinalizando(true);
    try {
      if (!chaveDeIdempotenciaRef.current) {
        chaveDeIdempotenciaRef.current = crypto.randomUUID();
      }
      const pedido = await criarPedido(
        cliente,
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

            <p className="tela-carrinho__total">
              Total: {formatarCentavos(total)}
            </p>

            <Botao
              carregando={finalizando}
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
