import { motion, useReducedMotion } from 'motion/react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/client';
import { NavPrincipal } from '../../components/nav-principal';
import { Cabecalho } from '../../components/header';
import { Botao } from '../../components/ui';
import { useProduct } from '../../hooks/use-product';
import './product-detail-page.css';

interface PropsDaTela {
  cliente: ApiClient;
}

const FORMATADOR_DE_PRECO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// ---------------------------------------------
// Detalhe do produto
// O layoutId repete o identificador do cartão e deixa o Motion interpolar a
// posição e o tamanho entre a grade e esta ficha.
// ---------------------------------------------
export function TelaDeDetalheDoProduto({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id: string }>();
  const local = useLocation();
  const navegar = useNavigate();
  const reduzirMovimento = useReducedMotion();
  const id = Number(parametros.id);
  const { produto, carregando, erro } = useProduct(cliente, id);
  const estado = local.state as { retorno?: string } | null;
  const retorno = estado?.retorno?.startsWith('/produtos')
    ? estado.retorno
    : '/produtos';

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
            <div className="detalhe-produto__imagem" aria-hidden="true">
              {produto.name.charAt(0).toUpperCase()}
            </div>
            <div className="detalhe-produto__corpo">
              <h1 className="detalhe-produto__nome">{produto.name}</h1>
              <p className="detalhe-produto__preco">
                {FORMATADOR_DE_PRECO.format(produto.price)}
              </p>
              <p className="detalhe-produto__estoque">
                {produto.stock > 0
                  ? `${produto.stock} unidades em estoque`
                  : 'Produto esgotado'}
              </p>
              <Botao disabled>Adicionar ao carrinho (em breve)</Botao>
            </div>
          </motion.article>
        ) : null}
      </main>
    </>
  );
}
