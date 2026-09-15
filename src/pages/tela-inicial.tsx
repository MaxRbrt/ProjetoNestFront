import { motion } from 'motion/react';
import { useSessao } from '../auth/contexto-de-sessao';
import { listaContainer, listaItem } from '../motion/tokens';
import './tela-inicial.css';

// ---------------------------------------------
// Tela inicial autenticada
// Nasceu como confirmação de que a sessão e o papel do usuário chegavam
// certos do backend, antes de catálogo e painel admin existirem. Os dois já
// estão prontos; esta tela virar uma home de verdade fica para o bloco de
// carrinho e pedidos.
// ---------------------------------------------
export function TelaInicial() {
  const { usuario } = useSessao();

  return (
    <motion.section
      className="inicio"
      variants={listaContainer}
      initial="oculto"
      animate="visivel"
    >
      <motion.h1 className="inicio__titulo" variants={listaItem}>
        Sua conta
      </motion.h1>

      <motion.div className="inicio__cartoes" variants={listaItem}>
        <div className="cartao">
          <span className="cartao__rotulo">Email</span>
          <span className="cartao__valor">{usuario?.email}</span>
        </div>

        <div className="cartao">
          <span className="cartao__rotulo">Papel de acesso</span>
          <span className="selo">{usuario?.papel}</span>
        </div>

        <div className="cartao">
          <span className="cartao__rotulo">Email verificado</span>
          <span
            className={`selo ${usuario?.emailVerificado ? 'selo--sucesso' : ''}`}
          >
            {usuario?.emailVerificado ? 'Confirmado' : 'Pendente'}
          </span>
        </div>
      </motion.div>

      <motion.p className="inicio__nota" variants={listaItem}>
        Catálogo e busca já estão disponíveis em Produtos. Pedidos entram no
        próximo bloco.
      </motion.p>
    </motion.section>
  );
}
