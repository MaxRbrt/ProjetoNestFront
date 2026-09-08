import { motion, useReducedMotion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import type { Produto } from '../../api/produtos';
import { cartaoInterativo } from '../../motion/tokens';
import './cartao-de-produto.css';

interface PropsDoCartao {
  produto: Produto;
}

const FORMATADOR_DE_PRECO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// ---------------------------------------------
// Cartão de produto na grade
// O layoutId mantém a continuidade espacial com o detalhe. Como o backend
// não tem imagem, a inicial do nome se torna a âncora visual da transição.
// ---------------------------------------------
export function CartaoDeProduto({ produto }: PropsDoCartao) {
  const local = useLocation();
  const reduzirMovimento = useReducedMotion();
  const retorno = `${local.pathname}${local.search}`;

  return (
    <Link
      to={`/produtos/${produto.id}`}
      state={{ retorno }}
      className="cartao-produto__link"
    >
      <motion.article
        className="cartao-produto"
        layoutId={reduzirMovimento ? undefined : `produto-${produto.id}`}
        variants={cartaoInterativo}
        initial="repouso"
        whileHover={reduzirMovimento ? 'repouso' : 'apontado'}
      >
        <div className="cartao-produto__imagem" aria-hidden="true">
          {produto.nome.charAt(0).toUpperCase()}
        </div>
        <div className="cartao-produto__corpo">
          <h3 className="cartao-produto__nome">{produto.nome}</h3>
          <p className="cartao-produto__preco">
            {FORMATADOR_DE_PRECO.format(produto.preco)}
          </p>
          <p className="cartao-produto__estoque">
            {produto.estoque > 0 ? `${produto.estoque} em estoque` : 'Esgotado'}
          </p>
        </div>
      </motion.article>
    </Link>
  );
}
