import { formatarCentavos } from '../../utils/dinheiro';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { atualizarSituacaoDoPedido, buscarPedido } from '../../api/pedidos';
import type { Pedido, SituacaoDoPedido } from '../../api/pedidos';
import { Cabecalho } from '../../components/cabecalho';
import { NavPrincipal } from '../../components/nav-principal';
import { Aviso, Botao } from '../../components/primitivos';
import './tela-de-detalhe-do-pedido.css';

interface PropsDaTela {
  cliente: ApiClient;
  contexto?: 'cliente' | 'admin';
}

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
// Detalhe compartilhado pelo cliente e painel administrativo
// A rota administrativa já passa por RotaAdmin; o servidor é a autoridade
// sobre cada transição. A chave descarta estado ao mudar de pedido ou contexto,
// inclusive quando uma leitura ou escrita anterior ainda não respondeu.
// ---------------------------------------------
export function TelaDeDetalheDoPedido({
  cliente,
  contexto = 'cliente',
}: PropsDaTela) {
  const parametros = useParams<{ id: string }>();
  const local = useLocation();
  const id = Number(parametros.id);
  const retorno =
    contexto === 'admin' ? `/admin/pedidos${local.search}` : '/pedidos';
  const Conteiner = contexto === 'admin' ? 'section' : 'main';

  return (
    <>
      {contexto === 'cliente' ? <Cabecalho links={<NavPrincipal />} /> : null}
      <Conteiner
        className={`detalhe-pedido${contexto === 'admin' ? ' detalhe-pedido--admin' : ''}`}
      >
        <Link to={retorno} className="detalhe-pedido__voltar">
          {contexto === 'admin'
            ? '← Voltar para pedidos'
            : '← Voltar para meus pedidos'}
        </Link>
        {Number.isInteger(id) && id > 0 && id <= 2147483647 ? (
          <ConteudoDoPedido
            key={`${contexto}:${id}`}
            cliente={cliente}
            contexto={contexto}
            id={id}
          />
        ) : (
          <Aviso>Identificador de pedido inválido.</Aviso>
        )}
      </Conteiner>
    </>
  );
}

// ---------------------------------------------
// Leitura e transições de um único pedido
// Itens preservam nome e preço congelados na compra. Falha de escrita não
// esconde esses dados nem dispara retry: exige leitura antes da próxima ação,
// porque o servidor pode ter aplicado a transição mesmo sem resposta de rede.
// A trava síncrona protege cliques concorrentes; a referência de montagem
// impede que a resposta de uma escrita atinja outra tela após navegar.
// ---------------------------------------------
function ConteudoDoPedido({
  cliente,
  contexto,
  id,
}: PropsDaTela & { id: number }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);
  const [acaoEmCurso, setAcaoEmCurso] = useState<SituacaoDoPedido | null>(null);
  const [precisaAtualizar, setPrecisaAtualizar] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const escrevendo = useRef(false);
  const montado = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    buscarPedido(cliente, id, controlador.signal)
      .then((resultado) => {
        if (cancelado) return;
        setPedido(resultado);
        setErroDeCarga(null);
        setErroDeAcao(null);
        setPrecisaAtualizar(false);
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
  }, [cliente, id, tentativa]);

  async function alterarComConfirmacao(
    situacao: Exclude<SituacaoDoPedido, 'PENDENTE'>,
  ) {
    if (escrevendo.current || carregando || precisaAtualizar || !pedido) return;
    const mensagem =
      situacao === 'PAGO'
        ? `Confirmar que o pagamento do pedido #${id} foi recebido? Esta ação apenas registra o pagamento.`
        : `Cancelar o pedido #${id}? Os itens serão devolvidos ao estoque. Esta ação não pode ser desfeita.${pedido.situacao === 'PAGO' ? ' O reembolso financeiro deve ser realizado separadamente.' : ''}`;
    if (!window.confirm(mensagem)) return;
    escrevendo.current = true;
    setErroDeAcao(null);
    setSucesso(null);
    setAcaoEmCurso(situacao);
    try {
      const atualizado = await atualizarSituacaoDoPedido(cliente, id, situacao);
      if (!montado.current) return;
      setPedido(atualizado);
      setSucesso(
        situacao === 'PAGO'
          ? 'Pagamento registrado.'
          : 'Pedido cancelado. Estoque devolvido.',
      );
    } catch (falha) {
      if (!montado.current) return;
      setPrecisaAtualizar(true);
      setErroDeAcao(
        (falha instanceof ApiError
          ? falha.message
          : 'Não foi possível confirmar o resultado da alteração.') +
          ' Atualize o pedido para conferir a situação antes de tentar outra ação.',
      );
    } finally {
      escrevendo.current = false;
      if (montado.current) setAcaoEmCurso(null);
    }
  }

  const bloqueado =
    carregando || !!acaoEmCurso || precisaAtualizar || !!erroDeCarga;

  return (
    <>
      {erroDeCarga ? <Aviso>{erroDeCarga}</Aviso> : null}
      {erroDeAcao ? <Aviso>{erroDeAcao}</Aviso> : null}
      {sucesso ? <Aviso tipo="sucesso">{sucesso}</Aviso> : null}
      {erroDeCarga || precisaAtualizar ? (
        <Botao
          variante="secundario"
          carregando={carregando}
          onClick={() => {
            setCarregando(true);
            setErroDeCarga(null);
            setTentativa((atual) => atual + 1);
          }}
        >
          {pedido ? 'Atualizar pedido' : 'Tentar novamente'}
        </Botao>
      ) : null}

      {carregando ? <p role="status">Carregando pedido…</p> : null}

      {pedido ? (
        <>
          <h1>Pedido #{pedido.id}</h1>
          <p className="detalhe-pedido__meta">
            {FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))} ·{' '}
            {ROTULO_DA_SITUACAO[pedido.situacao] ?? pedido.situacao}
          </p>

          <div
            className="detalhe-pedido__rolagem"
            role="region"
            aria-label="Itens do pedido"
            tabIndex={0}
          >
            <table className="detalhe-pedido__tabela" aria-busy={carregando}>
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
                    <td>{formatarCentavos(item.precoUnitarioEmCentavos)}</td>
                    <td>{item.quantidade}</td>
                    <td>
                      {formatarCentavos(
                        item.precoUnitarioEmCentavos * item.quantidade,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="detalhe-pedido__total">
            Total: {formatarCentavos(pedido.totalEmCentavos)}
          </p>

          <div className="detalhe-pedido__acoes">
            {contexto === 'admin' && pedido.situacao === 'PENDENTE' ? (
              <Botao
                disabled={bloqueado}
                carregando={acaoEmCurso === 'PAGO'}
                onClick={() => void alterarComConfirmacao('PAGO')}
              >
                {acaoEmCurso === 'PAGO'
                  ? 'Registrando pagamento…'
                  : 'Marcar como pago'}
              </Botao>
            ) : null}
            {pedido.situacao === 'PENDENTE' ||
            (contexto === 'admin' && pedido.situacao === 'PAGO') ? (
              <Botao
                variante="secundario"
                disabled={bloqueado}
                carregando={acaoEmCurso === 'CANCELADO'}
                onClick={() => void alterarComConfirmacao('CANCELADO')}
              >
                {acaoEmCurso === 'CANCELADO'
                  ? 'Cancelando…'
                  : 'Cancelar pedido'}
              </Botao>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
