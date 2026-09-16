import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { urlDaImagemDoProduto } from '../../api/produtos';
import type { Produto } from '../../api/produtos';
import { useCarrinho } from '../../auth/contexto-do-carrinho';
import { useSessao } from '../../auth/contexto-de-sessao';
import { useCategorias } from '../../hooks/use-categorias';
import { useProduto } from '../../hooks/use-produto';
import { Trilha } from '../../layout/trilha';
import { Relacionados } from '../../produtos/relacionados';
import { caminhoInternoSeguro } from '../../utils/caminho-seguro';
import {
  Aviso,
  Botao,
  Campo,
  Esqueleto,
  Etiqueta,
  Preco,
} from '../../ui/indice';

interface PropsDaTela {
  cliente: ApiClient;
}

interface EstadoDeNavegacao {
  retorno?: string;
}

// ---------------------------------------------
// Quantidade com teto reativo ao carrinho
// O teto muda quando o próprio carrinho muda (adicionar reduz o que ainda
// cabe); sem este ajuste, o campo continuaria mostrando um valor que a regra
// de negócio já não permite enviar de novo.
// ---------------------------------------------
function useQuantidadeComTeto(disponivel: number) {
  const [quantidade, setQuantidade] = useState(1);

  useEffect(() => {
    setQuantidade((atual) =>
      Math.min(Math.max(atual, 1), Math.max(disponivel, 1)),
    );
  }, [disponivel]);

  return [quantidade, setQuantidade] as const;
}

// ---------------------------------------------
// Página de produto
// Delegada inteira a ConteudoDoProduto, remontada por key a cada tentativa de
// novo carregamento: useProduto não expõe uma função de recarregar, então o
// botão "Tentar novamente" incrementa um contador que troca a key e força uma
// montagem nova do efeito de leitura, sem precisar duplicar a lógica de
// busca aqui nem alterar a assinatura do hook.
// ---------------------------------------------
export function TelaDeDetalheDoProduto({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id: string }>();
  const id = Number(parametros.id);
  const [tentativa, setTentativa] = useState(0);

  return (
    <ConteudoDoProduto
      key={`${id}:${tentativa}`}
      cliente={cliente}
      id={id}
      aoTentarNovamente={() => setTentativa((atual) => atual + 1)}
    />
  );
}

interface PropsDoConteudo {
  cliente: ApiClient;
  id: number;
  aoTentarNovamente: () => void;
}

function ConteudoDoProduto({
  cliente,
  id,
  aoTentarNovamente,
}: PropsDoConteudo) {
  const local = useLocation();
  const navegar = useNavigate();
  const { produto, carregando, erro } = useProduto(cliente, id);
  const { itens, adicionar } = useCarrinho();
  const { situacao } = useSessao();
  const { categorias } = useCategorias(cliente);
  const [confirmacao, setConfirmacao] = useState(false);

  const estado = local.state as EstadoDeNavegacao | null;
  const retornoValidado = caminhoInternoSeguro(estado?.retorno);
  const retornoAoCatalogo =
    retornoValidado && retornoValidado.startsWith('/produtos')
      ? retornoValidado
      : '/produtos';
  const categoria = produto
    ? categorias.find((item) => item.id === produto.categoriaId)
    : undefined;

  const jaNoCarrinho = produto
    ? (itens.find((item) => item.produtoId === produto.id)?.quantidade ?? 0)
    : 0;
  const disponivel = produto ? Math.max(produto.estoque - jaNoCarrinho, 0) : 0;
  const [quantidade, setQuantidade] = useQuantidadeComTeto(disponivel);

  const naoEncontrado = produtoNaoEncontrado(erro);
  const urlDaImagemPrincipal = produto ? urlDaImagemDoProduto(produto) : null;

  function aoAdicionar() {
    if (!produto || disponivel <= 0 || situacao === 'verificando') return;
    if (situacao === 'anonimo') {
      const parametrosDeRetorno = new URLSearchParams({
        retorno: `${local.pathname}${local.search}`,
      });
      navegar(`/entrar?${parametrosDeRetorno.toString()}`);
      return;
    }
    adicionar(produto.id, Math.min(quantidade, disponivel));
    setQuantidade(1);
    setConfirmacao(true);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Trilha
        itens={[
          { rotulo: 'Início', para: '/' },
          { rotulo: 'Produtos', para: retornoAoCatalogo },
          ...(categoria
            ? [
                {
                  rotulo: categoria.nome,
                  para: `/produtos?categoria=${categoria.id}`,
                },
              ]
            : []),
          ...(produto ? [{ rotulo: produto.nome }] : []),
        ]}
      />

      {erro ? (
        <div className="mt-8 flex flex-col items-start gap-4">
          <Aviso tipo="erro">{erro}</Aviso>
          {naoEncontrado ? (
            <Link
              to="/produtos"
              className="text-sm font-semibold text-acento underline underline-offset-4 hover:text-acento-escuro"
            >
              Voltar para o catálogo
            </Link>
          ) : (
            <Botao onClick={aoTentarNovamente}>Tentar novamente</Botao>
          )}
        </div>
      ) : carregando ? (
        <EsqueletoDoProduto />
      ) : produto ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              {urlDaImagemPrincipal ? (
                <img
                  src={urlDaImagemPrincipal}
                  alt=""
                  width={600}
                  height={600}
                  loading="eager"
                  className="aspect-square w-full rounded-card border border-borda bg-superficie-sutil object-contain p-6"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex aspect-square w-full items-center justify-center rounded-card border border-borda bg-superficie-sutil text-7xl font-extrabold text-marca"
                >
                  {produto.nome.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="lg:col-span-5">
              <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                <h1 className="text-2xl font-bold tracking-tight text-tinta break-words sm:text-3xl">
                  {produto.nome}
                </h1>

                <DisponibilidadeDoProduto produto={produto} />

                <Preco centavos={produto.precoEmCentavos} tamanho="grande" />

                {produto.estoque > 0 ? (
                  <Campo
                    rotulo="Quantidade"
                    type="number"
                    min={1}
                    max={Math.max(disponivel, 1)}
                    value={Math.min(quantidade, Math.max(disponivel, 1))}
                    disabled={disponivel <= 0}
                    onChange={(evento) => {
                      const valor = Number(evento.target.value);
                      setQuantidade(
                        Number.isInteger(valor)
                          ? Math.min(
                              Math.max(valor, 1),
                              Math.max(disponivel, 1),
                            )
                          : 1,
                      );
                    }}
                  />
                ) : null}

                <Botao
                  bloco
                  tamanho="grande"
                  disabled={disponivel <= 0}
                  carregando={situacao === 'verificando'}
                  onClick={aoAdicionar}
                >
                  Adicionar ao carrinho
                </Botao>

                {disponivel <= 0 ? (
                  <p className="text-sm text-tinta-media">
                    {produto.estoque === 0
                      ? 'Este produto está esgotado.'
                      : `Você já tem no carrinho todo o estoque disponível (${produto.estoque} unidades).`}
                  </p>
                ) : null}

                {confirmacao ? (
                  <Aviso tipo="sucesso">
                    Adicionado ao carrinho.{' '}
                    <Link to="/carrinho" className="font-semibold underline">
                      Ver carrinho
                    </Link>
                  </Aviso>
                ) : null}

                <p className="text-sm text-tinta-suave">
                  O frete é calculado no carrinho, a partir do endereço
                  cadastrado — o valor depende do endereço de entrega, não só do
                  CEP.
                </p>
              </div>
            </div>
          </div>

          <Relacionados
            cliente={cliente}
            categoriaId={produto.categoriaId}
            produtoAtualId={produto.id}
          />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------
// Distinção entre "não encontrado" e erro genérico
// Sem status separado do hook (useProduto só expõe uma mensagem), o critério
// aqui é o id fora do domínio válido (mesma checagem de useProduto) ou o
// texto que o backend usa para o recurso ausente (ver
// ProdutosService.buscarPorId, "Produto {id} não encontrado"). Um produto
// que não existe não vale a pena tentar de novo — daí o link ao catálogo em
// vez do botão de nova tentativa.
// ---------------------------------------------
function produtoNaoEncontrado(erro: string | null): boolean {
  return (
    erro !== null &&
    (erro === 'Produto inválido.' || /não encontrado/i.test(erro))
  );
}

interface PropsDaDisponibilidade {
  produto: Produto;
}

function DisponibilidadeDoProduto({ produto }: PropsDaDisponibilidade) {
  if (produto.estoque === 0) {
    return (
      <span className="self-start">
        <Etiqueta tom="erro">Esgotado</Etiqueta>
      </span>
    );
  }
  if (produto.estoque <= 3) {
    return (
      <span className="self-start">
        <Etiqueta tom="aviso">Últimas unidades</Etiqueta>
      </span>
    );
  }
  return (
    <p className="text-sm text-tinta-media">
      {produto.estoque} unidades em estoque
    </p>
  );
}

// ---------------------------------------------
// Esqueleto do detalhe
// Espelha as duas colunas do layout real para a página não saltar de altura
// quando os dados chegam.
// ---------------------------------------------
function EsqueletoDoProduto() {
  return (
    <div
      role="status"
      aria-label="Carregando produto"
      className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12"
    >
      <div className="lg:col-span-7">
        <Esqueleto className="aspect-square w-full" />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-5">
        <Esqueleto className="h-8 w-3/4" />
        <Esqueleto className="h-6 w-1/3" />
        <Esqueleto className="h-9 w-1/2" />
        <Esqueleto className="h-11 w-full" />
        <Esqueleto className="h-13 w-full" />
      </div>
    </div>
  );
}
