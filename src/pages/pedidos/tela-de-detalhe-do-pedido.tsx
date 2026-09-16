import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { atualizarSituacaoDoPedido, buscarPedido } from '../../api/pedidos';
import type { Pedido, SituacaoDoPedido } from '../../api/pedidos';
import { iniciarPagamento } from '../../api/pagamentos';
import { Trilha } from '../../layout/trilha';
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Esqueleto,
  EtiquetaDeSituacao,
} from '../../ui/indice';
import { formatarCentavos } from '../../utils/dinheiro';

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
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
};

// ---------------------------------------------
// Situações alcançáveis por PATCH de situação
// PAGO fica de fora de propósito: desde a Fase 4 essa transição pertence
// exclusivamente ao webhook assinado do módulo de pagamento, e o backend
// recusa o PATCH mesmo vindo de ADMIN. Ter o tipo aqui faz o compilador
// impedir que um botão de "marcar como pago" volte por engano.
// ---------------------------------------------
type SituacaoAlteravel = Exclude<SituacaoDoPedido, 'PENDENTE' | 'PAGO'>;

// ---------------------------------------------
// Detalhe compartilhado pelo cliente e painel administrativo
// A rota administrativa já passa por RotaAdmin; o servidor é a autoridade
// sobre cada transição. A chave descarta estado ao mudar de pedido ou contexto,
// inclusive quando uma leitura ou escrita anterior ainda não respondeu. A
// trilha é decorativa; o link "Voltar para..." abaixo dela continua sendo o
// alvo estável que os testes localizam pelo nome acessível.
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
  const rotuloDeVoltar =
    contexto === 'admin'
      ? '← Voltar para pedidos'
      : '← Voltar para meus pedidos';

  return (
    <div
      className={
        contexto === 'admin'
          ? ''
          : 'mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8'
      }
    >
      {contexto === 'cliente' ? (
        <Trilha
          itens={[
            { rotulo: 'Início', para: '/' },
            { rotulo: 'Meus pedidos', para: '/pedidos' },
            ...(Number.isInteger(id) && id > 0
              ? [{ rotulo: `Pedido #${id}` }]
              : []),
          ]}
        />
      ) : null}

      <Link
        to={retorno}
        className="mt-2 inline-flex min-h-12 items-center rounded-pequeno text-base font-semibold text-tinta-media underline decoration-borda-forte underline-offset-4 hover:text-tinta hover:decoration-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
      >
        {rotuloDeVoltar}
      </Link>

      {Number.isInteger(id) && id > 0 && id <= 2147483647 ? (
        <ConteudoDoPedido
          key={`${contexto}:${id}`}
          cliente={cliente}
          contexto={contexto}
          id={id}
        />
      ) : (
        <div className="mt-6">
          <Aviso tipo="erro">Identificador de pedido inválido.</Aviso>
        </div>
      )}
    </div>
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

  async function alterarComConfirmacao(situacao: SituacaoAlteravel) {
    if (escrevendo.current || carregando || precisaAtualizar || !pedido) return;
    const mensagens: Record<SituacaoAlteravel, string> = {
      CANCELADO: `Cancelar o pedido #${id}? Os itens serão devolvidos ao estoque. Esta ação não pode ser desfeita.${pedido.situacao === 'PAGO' ? ' O reembolso financeiro deve ser realizado separadamente.' : ''}`,
      ENVIADO: `Marcar o pedido #${id} como enviado?`,
      ENTREGUE: `Marcar o pedido #${id} como entregue?`,
    };
    if (!window.confirm(mensagens[situacao])) return;
    escrevendo.current = true;
    setErroDeAcao(null);
    setSucesso(null);
    setAcaoEmCurso(situacao);
    try {
      const atualizado = await atualizarSituacaoDoPedido(cliente, id, situacao);
      if (!montado.current) return;
      setPedido(atualizado);
      const mensagensDeSucesso: Record<SituacaoAlteravel, string> = {
        CANCELADO: 'Pedido cancelado. Estoque devolvido.',
        ENVIADO: 'Pedido marcado como enviado.',
        ENTREGUE: 'Pedido marcado como entregue.',
      };
      setSucesso(mensagensDeSucesso[situacao]);
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
    <div className="mt-4 flex flex-col gap-6">
      {erroDeCarga ? <Aviso tipo="erro">{erroDeCarga}</Aviso> : null}
      {erroDeAcao ? <Aviso tipo="erro">{erroDeAcao}</Aviso> : null}
      {sucesso ? <Aviso tipo="sucesso">{sucesso}</Aviso> : null}
      {erroDeCarga || precisaAtualizar ? (
        <div>
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
        </div>
      ) : null}

      {carregando && !pedido ? <EsqueletoDoPedido /> : null}

      {pedido ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-balance text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
                Pedido #{pedido.id}
              </h1>
              <p className="text-lg text-tinta-media">
                Realizado em{' '}
                {FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))}
              </p>
            </div>
            <EtiquetaDeSituacao
              situacao={pedido.situacao}
              rotulo={ROTULO_DA_SITUACAO[pedido.situacao] ?? pedido.situacao}
            />
          </div>

          <Cartao como="section">
            <h2 className="mb-3 text-xl font-bold text-tinta">
              Endereço de entrega
            </h2>
            <div className="break-words text-lg leading-relaxed text-tinta-media">
              <p>{pedido.enderecoDestinatario}</p>
              <p>
                {pedido.enderecoLogradouro}, {pedido.enderecoNumero}
              </p>
              {pedido.enderecoComplemento ? (
                <p>{pedido.enderecoComplemento}</p>
              ) : null}
              <p>
                {pedido.enderecoBairro} — {pedido.enderecoCidade}/
                {pedido.enderecoUf}
              </p>
              <p>CEP {pedido.enderecoCep}</p>
            </div>
          </Cartao>

          <Cartao espaco="nenhum">
            <div
              role="region"
              aria-label="Itens do pedido"
              aria-busy={carregando}
              className="flex flex-col"
            >
              <h2 className="border-b border-borda px-5 py-4 text-xl font-bold text-tinta sm:px-7">
                Itens
              </h2>
              {pedido.itens.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4 sm:px-7"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-tinta">
                      {item.nomeDoProduto}
                    </p>
                    <p className="text-base text-tinta-media">
                      Quantidade: {item.quantidade} · Preço por unidade:{' '}
                      {formatarCentavos(item.precoUnitarioEmCentavos)}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-tinta">
                    {formatarCentavos(
                      item.precoUnitarioEmCentavos * item.quantidade,
                    )}
                  </p>
                </div>
              ))}
            </div>

            <dl className="flex flex-col gap-3 bg-superficie-sutil px-5 py-5 text-lg sm:px-7">
              <div className="flex flex-wrap justify-between gap-3">
                <dt className="text-tinta-media">Subtotal</dt>
                <dd>{formatarCentavos(pedido.subtotalEmCentavos)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <dt className="text-tinta-media">
                  Frete ({pedido.modalidadeDeFrete}, até {pedido.prazoEmDiasUteis}{' '}
                  dias úteis)
                </dt>
                <dd>{formatarCentavos(pedido.freteEmCentavos)}</dd>
              </div>
              <div className="mt-1 flex flex-wrap justify-between gap-3 border-t border-borda pt-4 text-2xl font-bold text-tinta">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {formatarCentavos(pedido.totalEmCentavos)}
                </dd>
              </div>
            </dl>
          </Cartao>

          {contexto === 'cliente' && pedido.situacao === 'PENDENTE' ? (
            <FormularioDePagamento
              cliente={cliente}
              pedidoId={id}
              bloqueado={bloqueado}
              aoConfirmar={(atualizado) => {
                setPedido(atualizado);
                setSucesso(null);
              }}
              aoFalhaAmbigua={() => {
                setPrecisaAtualizar(true);
                setErroDeAcao(
                  'Não foi possível confirmar o resultado do pagamento. Atualize o pedido para conferir a situação antes de tentar de novo.',
                );
              }}
            />
          ) : null}

          <div className="flex flex-wrap gap-3 empty:hidden">
            {contexto === 'admin' && pedido.situacao === 'PAGO' ? (
              <Botao
                disabled={bloqueado}
                carregando={acaoEmCurso === 'ENVIADO'}
                onClick={() => void alterarComConfirmacao('ENVIADO')}
              >
                {acaoEmCurso === 'ENVIADO'
                  ? 'Marcando…'
                  : 'Marcar como enviado'}
              </Botao>
            ) : null}
            {contexto === 'admin' && pedido.situacao === 'ENVIADO' ? (
              <Botao
                disabled={bloqueado}
                carregando={acaoEmCurso === 'ENTREGUE'}
                onClick={() => void alterarComConfirmacao('ENTREGUE')}
              >
                {acaoEmCurso === 'ENTREGUE'
                  ? 'Marcando…'
                  : 'Marcar como entregue'}
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
    </div>
  );
}

// ---------------------------------------------
// Formulário de pagamento
// Só aparece para o cliente com pedido PENDENTE. O provedor simulado
// resolve na mesma chamada — não existe "aguardando confirmação assíncrona"
// do lado da interface, então o resultado (aprovado ou recusado) já volta
// no retorno de iniciarPagamento. Recusado mantém o formulário visível para
// tentar de novo com outro cartão, mesmo padrão de erro recuperável já
// usado em TelaDeRedefinirSenha.
//
// Uma exceção é diferente de uma recusa: não dá para saber daqui se o
// pagamento foi processado no servidor e só a confirmação local (a resposta
// do POST ou o GET seguinte) se perdeu. Seguir mostrando o pedido como
// PENDENTE seria enganoso, e liberar nova tentativa às cegas esbarraria num
// 409 sem explicação — por isso o catch delega ao mecanismo de "Atualizar
// pedido" do componente pai, o mesmo que alterarComConfirmacao já usa para
// esta classe de falha.
// ---------------------------------------------
function FormularioDePagamento({
  cliente,
  pedidoId,
  bloqueado,
  aoConfirmar,
  aoFalhaAmbigua,
}: {
  cliente: ApiClient;
  pedidoId: number;
  bloqueado: boolean;
  aoConfirmar: (pedidoAtualizado: Pedido) => void;
  aoFalhaAmbigua: () => void;
}) {
  const [numeroDoCartao, setNumeroDoCartao] = useState('');
  const [pagando, setPagando] = useState(false);
  const [recusado, setRecusado] = useState<string | null>(null);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setRecusado(null);
    setPagando(true);
    try {
      const pagamento = await iniciarPagamento(
        cliente,
        pedidoId,
        numeroDoCartao,
      );
      if (pagamento.status === 'RECUSADO') {
        setRecusado(
          pagamento.motivoDeRecusa ?? 'Cartão recusado. Tente outro cartão.',
        );
        return;
      }
      const pedidoAtualizado = await buscarPedido(
        cliente,
        pedidoId,
        new AbortController().signal,
      );
      aoConfirmar(pedidoAtualizado);
    } catch {
      aoFalhaAmbigua();
    } finally {
      setPagando(false);
    }
  }

  return (
    <Cartao como="section" className="border-t-4 border-t-acento">
      <h2 className="text-xl font-bold text-tinta">Pagamento</h2>
      <p className="mb-5 mt-1 text-lg text-tinta-media">
        Informe o cartão para concluir a compra.
      </p>
      {recusado ? (
        <div className="mb-5">
          <Aviso tipo="erro">{recusado}</Aviso>
        </div>
      ) : null}
      <form onSubmit={aoEnviar} className="flex max-w-xl flex-col gap-6">
        <Campo
          rotulo="Número do cartão"
          placeholder="0000000000000000"
          inputMode="numeric"
          maxLength={16}
          value={numeroDoCartao}
          onChange={(e) => setNumeroDoCartao(e.target.value.replace(/\D/g, ''))}
          ajuda="Simulado: qualquer número de 16 dígitos aprova, exceto terminado em 0002."
          required
        />
        <Botao
          type="submit"
          tamanho="grande"
          disabled={bloqueado}
          carregando={pagando}
        >
          {pagando ? 'Processando…' : 'Pagar'}
        </Botao>
      </form>
    </Cartao>
  );
}

// ---------------------------------------------
// Esqueleto do detalhe
// Exibido só na primeira carga (sem pedido ainda em memória); uma releitura
// via "Atualizar pedido" mantém os dados antigos visíveis em vez de voltar a
// este estado, mesmo padrão de carrinho e produto.
// ---------------------------------------------
function EsqueletoDoPedido() {
  return (
    <div
      role="status"
      aria-label="Carregando pedido"
      className="flex flex-col gap-4"
    >
      <Esqueleto className="h-8 w-1/3" />
      <Esqueleto className="h-20 w-full" />
      <Esqueleto className="h-20 w-full" />
      <Esqueleto className="h-32 w-full max-w-sm" />
    </div>
  );
}
