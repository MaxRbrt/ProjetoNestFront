import { formatarCentavos } from '../../utils/dinheiro';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { useCarrinho } from '../../auth/contexto-do-carrinho';
import { NavPrincipal } from '../../components/nav-principal';
import { Cabecalho } from '../../components/cabecalho';
import { Botao, Campo } from '../../components/primitivos';
import { useProduto } from '../../hooks/use-produto';
import { urlDaImagemDoProduto } from '../../api/produtos';
import './tela-de-detalhe-do-produto.css';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Detalhe do produto
// O layoutId repete o identificador do cartão e deixa o Motion interpolar a
// posição e o tamanho entre a grade e esta ficha. A quantidade tem teto no
// estoque conhecido — validação de conforto, a autoridade real é o backend
// no checkout, que pode recusar se o estoque mudar nesse meio-tempo.
// ---------------------------------------------
export function TelaDeDetalheDoProduto({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id: string }>();
  const local = useLocation();
  const navegar = useNavigate();
  const reduzirMovimento = useReducedMotion();
  const id = Number(parametros.id);
  const { produto, carregando, erro } = useProduto(cliente, id);
  const { itens, adicionar } = useCarrinho();
  const [quantidade, setQuantidade] = useState(1);
  const [adicionado, setAdicionado] = useState(false);
  const estado = local.state as { retorno?: string } | null;
  const retorno = estado?.retorno?.startsWith('/produtos')
    ? estado.retorno
    : '/produtos';

  function aoAdicionar() {
    if (!produto) return;
    const jaNoCarrinho =
      itens.find((item) => item.produtoId === produto.id)?.quantidade ?? 0;
    const disponivel = Math.max(produto.estoque - jaNoCarrinho, 0);
    if (disponivel <= 0) return;
    adicionar(produto.id, Math.min(quantidade, disponivel));
    setAdicionado(true);
  }

  return (
    <>
      <Cabecalho links={<NavPrincipal />} />

      <main className="detalhe-produto">
        <button
          className="detalhe-produto__voltar"
          type="button"
          onClick={() => navegar(retorno)}
        >
          ← Voltar para produtos
        </button>

        {erro ? (
          <p className="detalhe-produto__erro" role="alert">
            {erro}
          </p>
        ) : null}

        {!erro && carregando ? (
          <p className="detalhe-produto__carregando" role="status">
            Carregando produto…
          </p>
        ) : null}

        {!erro && produto ? (
          <motion.article
            className="detalhe-produto__cartao"
            layoutId={
              reduzirMovimento ? undefined : `produto-${produto.id}`
            }
          >
            {urlDaImagemDoProduto(produto) ? (
              <img
                className="detalhe-produto__imagem"
                src={urlDaImagemDoProduto(produto)!}
                alt=""
              />
            ) : (
              <div className="detalhe-produto__imagem" aria-hidden="true">
                {produto.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="detalhe-produto__corpo">
              <h1 className="detalhe-produto__nome">{produto.nome}</h1>
              <p className="detalhe-produto__preco">
                {formatarCentavos(produto.precoEmCentavos)}
              </p>
              <p className="detalhe-produto__estoque">
                {produto.estoque > 0
                  ? `${produto.estoque} unidades em estoque`
                  : 'Produto esgotado'}
              </p>

              {produto.estoque > 0 ? (
                <div className="detalhe-produto__acao">
                  <Campo
                    rotulo="Quantidade"
                    type="number"
                    min={1}
                    max={produto.estoque}
                    value={quantidade}
                    onChange={(evento) => {
                      const valor = Number(evento.target.value);
                      setQuantidade(
                        Number.isInteger(valor)
                          ? Math.min(Math.max(valor, 1), produto.estoque)
                          : 1,
                      );
                    }}
                  />
                  <Botao onClick={aoAdicionar}>
                    {adicionado ? 'Adicionado ✓' : 'Adicionar ao carrinho'}
                  </Botao>
                </div>
              ) : (
                <Botao disabled>Produto esgotado</Botao>
              )}
            </div>
          </motion.article>
        ) : null}
      </main>
    </>
  );
}
