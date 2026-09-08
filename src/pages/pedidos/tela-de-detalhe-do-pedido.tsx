import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { buscarPedido, cancelarPedido } from '../../api/pedidos';
import type { Pedido } from '../../api/pedidos';
import { Cabecalho } from '../../components/cabecalho';
import { NavPrincipal } from '../../components/nav-principal';
import { Aviso, Botao } from '../../components/primitivos';
import './tela-de-detalhe-do-pedido.css';

interface PropsDaTela {
  cliente: ApiClient;
}

const FORMATADOR_DE_PRECO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const FORMATADOR_DE_DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const ROTULO_DA_SITUACAO: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
};

// ---------------------------------------------
// Detalhe de um pedido
// Os itens mostram o snapshot congelado no momento da compra
// (nomeDoProduto/precoUnitario), não o produto atual — o pedido antigo
// precisa continuar mostrando o que foi de fato comprado e pago, mesmo que o
// produto mude de nome ou preço depois. Cancelar só aparece em PENDENTE,
// mesma regra que o backend já aplica. Erro de carga (buscar o pedido) e
// erro de ação (cancelar) ficam em estados separados: uma falha ao cancelar
// não pode apagar o pedido já carregado da tela.
// ---------------------------------------------
export function TelaDeDetalheDoPedido({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id: string }>();
  const id = Number(parametros.id);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;
    setCarregando(true);

    buscarPedido(cliente, id, controlador.signal)
      .then((resultado) => {
        if (cancelado) return;
        setPedido(resultado);
        setErroDeCarga(null);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') {
          return;
        }
        setErroDeCarga(
          falha instanceof ApiError
            ? falha.message
            : 'Não foi possível carregar o pedido.',
        );
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, id]);

  async function cancelarComConfirmacao() {
    if (!window.confirm('Cancelar este pedido?')) {
      return;
    }
    setErroDeAcao(null);
    setCancelando(true);
    try {
      const atualizado = await cancelarPedido(cliente, id);
      setPedido(atualizado);
    } catch (falha) {
      setErroDeAcao(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível cancelar o pedido.',
      );
    } finally {
      setCancelando(false);
    }
  }

  return (
    <>
      <Cabecalho links={<NavPrincipal />} />

      <main className="detalhe-pedido">
        <Link to="/pedidos" className="detalhe-pedido__voltar">
          ← Voltar para meus pedidos
        </Link>

        {erroDeCarga ? <Aviso>{erroDeCarga}</Aviso> : null}

        {!erroDeCarga && carregando ? (
          <p role="status">Carregando pedido…</p>
        ) : null}

        {!erroDeCarga && pedido ? (
          <>
            {erroDeAcao ? <Aviso>{erroDeAcao}</Aviso> : null}

            <h1>Pedido #{pedido.id}</h1>
            <p className="detalhe-pedido__meta">
              {FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))} ·{' '}
              {ROTULO_DA_SITUACAO[pedido.situacao] ?? pedido.situacao}
            </p>

            <table className="detalhe-pedido__tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço unitário</th>
                  <th>Quantidade</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {pedido.itens.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nomeDoProduto}</td>
                    <td>{FORMATADOR_DE_PRECO.format(item.precoUnitario)}</td>
                    <td>{item.quantidade}</td>
                    <td>
                      {FORMATADOR_DE_PRECO.format(
                        item.precoUnitario * item.quantidade,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="detalhe-pedido__total">
              Total: {FORMATADOR_DE_PRECO.format(pedido.total)}
            </p>

            {pedido.situacao === 'PENDENTE' ? (
              <Botao
                variante="secundario"
                carregando={cancelando}
                onClick={() => void cancelarComConfirmacao()}
              >
                {cancelando ? 'Cancelando…' : 'Cancelar pedido'}
              </Botao>
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}
