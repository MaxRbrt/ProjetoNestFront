import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { urlDaImagemDoProduto } from '../../api/produtos';
import type { Produto } from '../../api/produtos';
import { criarPedido } from '../../api/pedidos';
import { useCarrinho } from '../../auth/contexto-do-carrinho';
import {
  useLinhasDoCarrinho,
  type LinhaDoCarrinho,
} from '../../hooks/use-linhas-do-carrinho';
import { useEnderecosDoCheckout } from '../../hooks/use-enderecos-do-checkout';
import { useCotacaoDeFrete } from '../../hooks/use-cotacao-de-frete';
import { CabecalhoDaPagina } from '../../layout/cabecalho-da-pagina';
import {
  Aviso,
  Botao,
  Cartao,
  classesDeBotao,
  Esqueleto,
  Preco,
  Selecao,
} from '../../ui/indice';
import { formatarCentavos } from '../../utils/dinheiro';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Tela do carrinho
// Erro de carga (buscar produtos) e erro de ação (finalizar pedido) ficam em
// estados separados: um erro ao finalizar não pode esconder os itens que o
// usuário precisa ver para corrigir o carrinho. A chave de idempotência é
// gerada uma vez por conteúdo de carrinho e reaproveitada entre tentativas —
// se a resposta do checkout se perder na rede, o retry manual do usuário
// reenvia a mesma chave em vez de criar um pedido duplicado; só um carrinho
// realmente diferente (efeito com [itens] como dependência), ou a troca de
// endereço/modalidade de frete (decisão nova sobre o pedido, não um retry de
// rede — o backend inclui os dois no hash de conferência), gera uma chave
// nova. Este é o único lugar do arquivo que mexe na chave; os hooks de
// endereço, frete e linhas do carrinho só expõem estado, sem tocar nela.
// ---------------------------------------------
export function TelaDeCarrinho({ cliente }: PropsDaTela) {
  const { itens, atualizarQuantidade, removerItem, limpar } = useCarrinho();
  const navegar = useNavigate();
  const { linhas, carregando, erroDeCarga, recarregar } = useLinhasDoCarrinho(
    cliente,
    itens,
  );
  const {
    enderecos,
    carregando: carregandoEnderecos,
    enderecoSelecionadoId,
    selecionarEndereco,
  } = useEnderecosDoCheckout(cliente);
  const {
    opcoesDeFrete,
    carregandoFrete,
    erroDeFrete,
    modalidadeSelecionada,
    selecionarModalidade,
  } = useCotacaoDeFrete(cliente, enderecoSelecionadoId, itens);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const chaveDeIdempotenciaRef = useRef<string | null>(null);

  useEffect(() => {
    chaveDeIdempotenciaRef.current = null;
  }, [itens]);

  useEffect(() => {
    chaveDeIdempotenciaRef.current = null;
  }, [enderecoSelecionadoId, modalidadeSelecionada]);

  const subtotal = linhas.reduce(
    (soma, linha) => soma + linha.produto.precoEmCentavos * linha.quantidade,
    0,
  );
  const opcaoSelecionada = opcoesDeFrete.find(
    (opcao) => opcao.modalidade === modalidadeSelecionada,
  );
  const total = subtotal + (opcaoSelecionada?.custoEmCentavos ?? 0);

  const semEndereco = !carregandoEnderecos && enderecos.length === 0;
  const motivoDoBloqueio = carregandoEnderecos
    ? 'Carregando endereços…'
    : semEndereco
      ? 'Cadastre um endereço de entrega para finalizar.'
      : !enderecoSelecionadoId
        ? 'Escolha um endereço de entrega.'
        : carregandoFrete
          ? 'Aguarde o cálculo do frete.'
          : erroDeFrete
            ? 'Não foi possível calcular o frete.'
            : !modalidadeSelecionada
              ? 'Escolha uma modalidade de frete.'
              : null;

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

  const carrinhoVazio = !erroDeCarga && !carregando && linhas.length === 0;
  const podeFinalizar = !motivoDoBloqueio;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <CabecalhoDaPagina
        trilha={[{ rotulo: 'Início', para: '/' }, { rotulo: 'Carrinho' }]}
        titulo="Carrinho"
        descricao="Confira os produtos, escolha a entrega e revise o total do pedido."
      />

      {erroDeCarga ? (
        <div className="mt-8">
          <Aviso tipo="erro">{erroDeCarga}</Aviso>
          <Botao
            type="button"
            variante="secundario"
            className="mt-4"
            carregando={carregando}
            onClick={recarregar}
          >
            Tentar novamente
          </Botao>
        </div>
      ) : null}

      {!erroDeCarga && carregando ? <EsqueletoDoCarrinho /> : null}

      {carrinhoVazio ? (
        <Cartao className="mt-8 flex flex-col items-start gap-4">
          <h2 className="text-xl font-bold text-tinta">
            Seu carrinho está vazio.
          </h2>
          <p className="text-lg text-tinta-media">
            Escolha um produto no catálogo para começar.
          </p>
          <Link
            to="/produtos"
            className={classesDeBotao({ className: 'mt-2' })}
          >
            Ver catálogo
          </Link>
        </Cartao>
      ) : null}

      {!erroDeCarga && !carregando && linhas.length > 0 ? (
        <>
          <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="flex flex-col gap-4 lg:col-span-7">
              {erroDeAcao ? <Aviso tipo="erro">{erroDeAcao}</Aviso> : null}

              <Cartao
                como="section"
                espaco="nenhum"
                aria-labelledby="produtos-do-carrinho"
              >
                <h2
                  id="produtos-do-carrinho"
                  className="border-b border-borda px-5 py-4 text-xl font-bold text-tinta sm:px-7"
                >
                  Produtos no carrinho
                </h2>
                <ul className="divide-y divide-borda">
                  {linhas.map((linha) => (
                    <ItemDoCarrinhoCartao
                      key={linha.produto.id}
                      linha={linha}
                      aoAlterarQuantidade={(quantidade) =>
                        atualizarQuantidade(linha.produto.id, quantidade)
                      }
                      aoRemover={() => removerItem(linha.produto.id)}
                    />
                  ))}
                </ul>
              </Cartao>
            </div>

            <div className="lg:sticky lg:top-6 lg:col-span-5">
              <Cartao como="section" className="flex flex-col gap-6">
                <ResumoDoCheckout
                  subtotal={subtotal}
                  total={total}
                  enderecos={enderecos}
                  carregandoEnderecos={carregandoEnderecos}
                  enderecoSelecionadoId={enderecoSelecionadoId}
                  selecionarEndereco={selecionarEndereco}
                  opcoesDeFrete={opcoesDeFrete}
                  carregandoFrete={carregandoFrete}
                  erroDeFrete={erroDeFrete}
                  modalidadeSelecionada={modalidadeSelecionada}
                  selecionarModalidade={selecionarModalidade}
                />
                <Botao
                  bloco
                  tamanho="grande"
                  carregando={finalizando}
                  disabled={!podeFinalizar}
                  onClick={() => void finalizarPedido()}
                >
                  {finalizando ? 'Finalizando…' : 'Finalizar pedido'}
                </Botao>
                {motivoDoBloqueio ? (
                  <p className="text-base text-tinta-media">
                    {motivoDoBloqueio}
                  </p>
                ) : null}
              </Cartao>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

interface PropsDoItem {
  linha: LinhaDoCarrinho;
  aoAlterarQuantidade: (quantidade: number) => void;
  aoRemover: () => void;
}

// ---------------------------------------------
// Cartão de item do carrinho
// Substitui a antiga linha de tabela: em telas estreitas, cinco colunas
// forçavam rolagem horizontal ou espremimento. Quantidade limitada a
// 1..estoque antes de repassar ao contexto — a mesma regra que já existia na
// tela antiga, preservada aqui no ponto de entrada do campo.
// ---------------------------------------------
function ItemDoCarrinhoCartao({
  linha,
  aoAlterarQuantidade,
  aoRemover,
}: PropsDoItem) {
  const { produto, quantidade } = linha;
  const url = urlDaImagemDoProduto(produto);

  return (
    <li className="flex min-w-0 gap-4 px-5 py-5 sm:gap-5 sm:px-7">
      <Miniatura produto={produto} url={url} />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Link
          to={`/produtos/${produto.id}`}
          className="inline-flex min-h-12 items-center break-words text-lg font-semibold leading-snug text-tinta hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca"
        >
          {produto.nome}
        </Link>
        <p className="text-base text-tinta-media">
          Preço por unidade:{' '}
          <span className="font-semibold tabular-nums text-tinta">
            {formatarCentavos(produto.precoEmCentavos)}
          </span>
        </p>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`quantidade-${produto.id}`}
              className="text-base text-tinta-media"
            >
              Quantidade
              <span className="sr-only"> de {produto.nome}</span>
            </label>
            <input
              id={`quantidade-${produto.id}`}
              type="number"
              min={1}
              max={produto.estoque}
              value={quantidade}
              className="h-13 w-24 rounded-card border border-borda-forte bg-superficie px-3 text-lg text-tinta focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca"
              onChange={(evento) => {
                const valor = Number(evento.target.value);
                if (!Number.isInteger(valor)) return;
                aoAlterarQuantidade(
                  Math.min(Math.max(valor, 1), produto.estoque),
                );
              }}
            />
          </div>

          <div className="ml-auto text-right">
            <p className="text-base text-tinta-media">Subtotal do produto</p>
            <Preco
              centavos={produto.precoEmCentavos * quantidade}
              tamanho="pequeno"
            />
          </div>
        </div>

        <div>
          <Botao
            variante="perigo"
            tamanho="pequeno"
            className="-ml-3"
            aria-label={`Remover ${produto.nome}`}
            onClick={aoRemover}
          >
            Remover
          </Botao>
        </div>
      </div>
    </li>
  );
}

interface PropsDaMiniatura {
  produto: Produto;
  url: string | null;
}

function Miniatura({ produto, url }: PropsDaMiniatura) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={80}
        height={80}
        loading="lazy"
        className="size-16 shrink-0 rounded-pequeno border border-borda bg-superficie-sutil object-cover sm:size-24"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex size-16 shrink-0 items-center justify-center rounded-pequeno border border-borda bg-superficie-sutil text-2xl font-bold text-marca/70 sm:size-24"
    >
      {produto.nome.charAt(0).toUpperCase()}
    </div>
  );
}

interface PropsDoResumo {
  subtotal: number;
  total: number;
  enderecos: ReturnType<typeof useEnderecosDoCheckout>['enderecos'];
  carregandoEnderecos: boolean;
  enderecoSelecionadoId: number | null;
  selecionarEndereco: (id: number) => void;
  opcoesDeFrete: ReturnType<typeof useCotacaoDeFrete>['opcoesDeFrete'];
  carregandoFrete: boolean;
  erroDeFrete: string | null;
  modalidadeSelecionada: string | null;
  selecionarModalidade: (modalidade: string) => void;
}

// ---------------------------------------------
// Resumo do checkout
// Uma única instância na coluna lateral (sticky no desktop, em fluxo logo
// abaixo dos itens no mobile). O total e a ação de finalizar ficam juntos,
// no fluxo do documento, sem uma barra fixa cobrindo campos ou mensagens.
// ---------------------------------------------
function ResumoDoCheckout({
  subtotal,
  total,
  enderecos,
  carregandoEnderecos,
  enderecoSelecionadoId,
  selecionarEndereco,
  opcoesDeFrete,
  carregandoFrete,
  erroDeFrete,
  modalidadeSelecionada,
  selecionarModalidade,
}: PropsDoResumo) {
  const opcaoSelecionada = opcoesDeFrete.find(
    (opcao) => opcao.modalidade === modalidadeSelecionada,
  );

  return (
    <>
      <h2 className="text-2xl font-bold text-tinta">Resumo do pedido</h2>

      <div className="min-w-0">
        {carregandoEnderecos ? (
          <p role="status">Carregando endereços…</p>
        ) : enderecos.length === 0 ? (
          <p className="text-base text-tinta-media">
            Você ainda não tem um endereço cadastrado.{' '}
            <Link
              to="/enderecos"
              className="font-semibold text-marca underline underline-offset-4 hover:text-acento-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              Cadastrar endereço
            </Link>
          </p>
        ) : (
          <>
            <Selecao
              rotulo="Endereço de entrega"
              value={enderecoSelecionadoId ?? ''}
              onChange={(evento) =>
                selecionarEndereco(Number(evento.target.value))
              }
            >
              {enderecos.map((endereco) => (
                <option key={endereco.id} value={endereco.id}>
                  {endereco.apelido}
                </option>
              ))}
            </Selecao>
            {enderecos
              .filter((endereco) => endereco.id === enderecoSelecionadoId)
              .map((endereco) => (
                <div
                  key={endereco.id}
                  className="mt-3 break-words rounded-pequeno bg-superficie-sutil px-4 py-3 text-base leading-relaxed text-tinta-media"
                >
                  <p>{endereco.destinatario}</p>
                  <p>
                    {endereco.logradouro}, {endereco.numero}
                    {endereco.complemento ? `, ${endereco.complemento}` : ''}
                  </p>
                  <p>
                    {endereco.bairro} — {endereco.cidade}/{endereco.uf}
                  </p>
                  <p>CEP {endereco.cep}</p>
                </div>
              ))}
          </>
        )}
      </div>

      {enderecoSelecionadoId ? (
        <div>
          {erroDeFrete ? <Aviso tipo="erro">{erroDeFrete}</Aviso> : null}
          {!erroDeFrete && carregandoFrete ? (
            <p role="status">Calculando frete…</p>
          ) : null}
          {!erroDeFrete && !carregandoFrete && opcoesDeFrete.length > 0 ? (
            <fieldset className="flex flex-col gap-2 border-none p-0 m-0">
              <legend className="mb-2 text-lg font-semibold text-tinta">
                Forma de entrega
              </legend>
              {opcoesDeFrete.map((opcao) => (
                <label
                  key={opcao.modalidade}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-card border border-borda-forte px-4 py-3 text-base text-tinta transition-colors hover:bg-superficie-sutil has-checked:border-acento has-checked:bg-acento-suave has-checked:ring-1 has-checked:ring-acento has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marca"
                >
                  <input
                    type="radio"
                    name="modalidade-de-frete"
                    value={opcao.modalidade}
                    checked={modalidadeSelecionada === opcao.modalidade}
                    onChange={() => selecionarModalidade(opcao.modalidade)}
                    className="size-5 shrink-0 accent-acento focus-visible:outline-none"
                  />
                  <span>
                    <strong>
                      {opcao.modalidade} —{' '}
                      {formatarCentavos(opcao.custoEmCentavos)}
                    </strong>
                    <br />
                    Até {opcao.prazoEmDiasUteis} dias úteis
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : (
        <p className="text-base text-tinta-media">
          Frete calculado após escolher o endereço.
        </p>
      )}

      <dl className="flex flex-col gap-3 border-t border-borda pt-5 text-lg">
        <div className="flex flex-wrap justify-between gap-3">
          <dt className="text-tinta-media">Subtotal</dt>
          <dd>
            <Preco centavos={subtotal} tamanho="pequeno" />
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-3">
          <dt className="text-tinta-media">Frete</dt>
          <dd>
            {opcaoSelecionada ? (
              <Preco
                centavos={opcaoSelecionada.custoEmCentavos}
                tamanho="pequeno"
              />
            ) : (
              <span className="text-tinta-media">—</span>
            )}
          </dd>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-5 text-2xl font-bold text-tinta">
          <dt>Total</dt>
          <dd>
            <Preco centavos={total} tamanho="medio" />
          </dd>
        </div>
      </dl>
    </>
  );
}

// ---------------------------------------------
// Esqueleto do carrinho
// Espelha as duas colunas do layout real para a página não saltar de altura
// quando os dados chegam.
// ---------------------------------------------
function EsqueletoDoCarrinho() {
  return (
    <div
      role="status"
      aria-label="Carregando carrinho"
      className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10"
    >
      <div className="flex flex-col gap-4 lg:col-span-7">
        <Esqueleto className="h-28 w-full" />
        <Esqueleto className="h-28 w-full" />
      </div>
      <div className="lg:col-span-5">
        <Esqueleto className="h-64 w-full" />
      </div>
    </div>
  );
}
