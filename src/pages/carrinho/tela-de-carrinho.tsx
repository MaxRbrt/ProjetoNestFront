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
import { Trilha } from '../../layout/trilha';
import { Aviso, Botao, Esqueleto, Preco, Selecao } from '../../ui/indice';
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
  const { linhas, carregando, erroDeCarga } = useLinhasDoCarrinho(
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Trilha
        itens={[{ rotulo: 'Início', para: '/' }, { rotulo: 'Carrinho' }]}
      />

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
        Carrinho
      </h1>

      {erroDeCarga ? (
        <div className="mt-6">
          <Aviso tipo="erro">{erroDeCarga}</Aviso>
        </div>
      ) : null}

      {!erroDeCarga && carregando ? <EsqueletoDoCarrinho /> : null}

      {carrinhoVazio ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-card border border-borda bg-superficie-sutil py-16 text-center">
          <p className="text-tinta-media">Seu carrinho está vazio.</p>
          <Link
            to="/produtos"
            className="inline-flex min-h-11 items-center justify-center rounded-card bg-acento px-6 py-3 font-semibold text-white hover:bg-acento-escuro focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento"
          >
            Ver catálogo
          </Link>
        </div>
      ) : null}

      {!erroDeCarga && !carregando && linhas.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-7">
              {erroDeAcao ? <Aviso tipo="erro">{erroDeAcao}</Aviso> : null}

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
            </div>

            <div className="lg:col-span-5">
              <div className="flex flex-col gap-5 rounded-card border border-borda bg-superficie p-5 shadow-carta lg:sticky lg:top-24">
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
                  className="hidden lg:flex"
                  carregando={finalizando}
                  disabled={!podeFinalizar}
                  onClick={() => void finalizarPedido()}
                >
                  {finalizando ? 'Finalizando…' : 'Finalizar pedido'}
                </Botao>
                {motivoDoBloqueio ? (
                  <p className="text-sm text-tinta-media">{motivoDoBloqueio}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-between gap-4 border-t border-borda bg-superficie px-4 py-3 shadow-carta-media sm:-mx-6 sm:px-6 lg:hidden">
            <div>
              <p className="text-xs text-tinta-media">Total</p>
              <Preco centavos={total} tamanho="medio" />
            </div>
            <Botao
              tamanho="grande"
              carregando={finalizando}
              disabled={!podeFinalizar}
              onClick={() => void finalizarPedido()}
            >
              {finalizando ? 'Finalizando…' : 'Finalizar pedido'}
            </Botao>
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
    <div className="flex gap-4 rounded-card border border-borda bg-superficie p-4 shadow-carta">
      <Miniatura produto={produto} url={url} />

      <div className="flex flex-1 flex-col gap-2">
        <Link
          to={`/produtos/${produto.id}`}
          className="font-semibold text-tinta hover:underline"
        >
          {produto.nome}
        </Link>
        <Preco centavos={produto.precoEmCentavos} tamanho="pequeno" />

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor={`quantidade-${produto.id}`}
              className="text-sm text-tinta-media"
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
              className="h-9 w-16 rounded-card border border-borda-forte bg-superficie px-2 text-sm text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
              onChange={(evento) => {
                const valor = Number(evento.target.value);
                if (!Number.isInteger(valor)) return;
                aoAlterarQuantidade(
                  Math.min(Math.max(valor, 1), produto.estoque),
                );
              }}
            />
          </div>

          <Preco
            centavos={produto.precoEmCentavos * quantidade}
            tamanho="pequeno"
          />
        </div>

        <div>
          <Botao
            variante="perigo"
            tamanho="pequeno"
            aria-label={`Remover ${produto.nome}`}
            onClick={aoRemover}
          >
            Remover
          </Botao>
        </div>
      </div>
    </div>
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
        className="h-20 w-20 flex-shrink-0 rounded-pequeno border border-borda bg-superficie-sutil object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-pequeno border border-borda bg-superficie-sutil text-2xl font-extrabold text-marca"
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
// abaixo dos itens no mobile) — o botão "Finalizar pedido" fica escondido
// aqui em telas estreitas porque a barra fixa no rodapé (fora deste
// componente) já oferece a mesma ação sem duplicar o alvo para leitores de
// tela.
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
      <h2 className="text-lg font-semibold text-tinta">Resumo</h2>

      <div>
        <h3 className="mb-2 text-sm font-medium text-tinta">Entregar em</h3>
        {carregandoEnderecos ? (
          <p role="status">Carregando endereços…</p>
        ) : enderecos.length === 0 ? (
          <p className="text-sm text-tinta-media">
            Você ainda não tem um endereço cadastrado.{' '}
            <Link
              to="/enderecos"
              className="font-semibold text-acento underline"
            >
              Cadastrar endereço
            </Link>
          </p>
        ) : (
          <Selecao
            rotulo="Endereço"
            value={enderecoSelecionadoId ?? ''}
            onChange={(evento) =>
              selecionarEndereco(Number(evento.target.value))
            }
            className="focus-visible:outline-acento"
          >
            {enderecos.map((endereco) => (
              <option key={endereco.id} value={endereco.id}>
                {endereco.apelido} — {endereco.logradouro}, {endereco.numero},{' '}
                {endereco.cidade}/{endereco.uf}
              </option>
            ))}
          </Selecao>
        )}
      </div>

      {enderecoSelecionadoId ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-tinta">Frete</h3>
          {erroDeFrete ? <Aviso tipo="erro">{erroDeFrete}</Aviso> : null}
          {!erroDeFrete && carregandoFrete ? (
            <p role="status">Calculando frete…</p>
          ) : null}
          {!erroDeFrete && !carregandoFrete && opcoesDeFrete.length > 0 ? (
            <fieldset className="flex flex-col gap-2 border-none p-0 m-0">
              <legend className="mb-1 text-sm font-medium text-tinta">
                Modalidade
              </legend>
              {opcoesDeFrete.map((opcao) => (
                <label
                  key={opcao.modalidade}
                  className="flex cursor-pointer items-center gap-2 text-sm text-tinta"
                >
                  <input
                    type="radio"
                    name="modalidade-de-frete"
                    value={opcao.modalidade}
                    checked={modalidadeSelecionada === opcao.modalidade}
                    onChange={() => selecionarModalidade(opcao.modalidade)}
                    className="accent-acento focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
                  />
                  {opcao.modalidade} — {formatarCentavos(opcao.custoEmCentavos)}{' '}
                  — até {opcao.prazoEmDiasUteis} dias úteis
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-tinta-media">
          Frete calculado após escolher o endereço.
        </p>
      )}

      <dl className="flex flex-col gap-1 border-t border-borda pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-tinta-media">Subtotal</dt>
          <dd>
            <Preco centavos={subtotal} tamanho="pequeno" />
          </dd>
        </div>
        <div className="flex justify-between">
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
        <div className="flex justify-between text-base font-semibold text-tinta">
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
      className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12"
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
