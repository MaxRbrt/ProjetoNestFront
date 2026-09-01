import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { listaContainer, listaItem, transicaoEntrada } from '../motion/tokens';
import './auth.css';

interface PropsDoLayout {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}

const DESTAQUES = [
  'Catálogo com busca e filtro por categoria',
  'Pedidos vinculados à sua conta, visíveis só para você',
  'Sessão protegida com renovação automática',
];

// ---------------------------------------------
// Moldura das telas de autenticação
// A faixa de marca entra escalonada na ordem de leitura e o cartão do
// formulário sobe logo depois: o olho acompanha a montagem em vez de receber
// a tela inteira de uma vez.
// ---------------------------------------------
export function LayoutDeAutenticacao({
  titulo,
  subtitulo,
  children,
}: PropsDoLayout) {
  return (
    <div className="autenticacao">
      <motion.aside
        className="autenticacao__marca"
        variants={listaContainer}
        initial="oculto"
        animate="visivel"
      >
        <motion.span className="autenticacao__logo" variants={listaItem}>
          <span className="autenticacao__logo-marca">NX</span>
          Catálogo
        </motion.span>

        <motion.h1 className="autenticacao__titulo" variants={listaItem}>
          Tudo que você precisa, em um só lugar
        </motion.h1>

        <motion.ul className="autenticacao__lista" variants={listaItem}>
          {DESTAQUES.map((destaque) => (
            <li className="autenticacao__item" key={destaque}>
              <span className="autenticacao__marcador" aria-hidden="true">
                ✓
              </span>
              {destaque}
            </li>
          ))}
        </motion.ul>
      </motion.aside>

      <main className="autenticacao__painel">
        <motion.div
          className="formulario"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transicaoEntrada}
        >
          <div className="formulario__cabecalho">
            <h2 className="formulario__titulo">{titulo}</h2>
            {subtitulo ? (
              <p className="formulario__subtitulo">{subtitulo}</p>
            ) : null}
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
