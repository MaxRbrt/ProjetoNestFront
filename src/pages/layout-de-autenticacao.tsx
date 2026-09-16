import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { listaContainer, listaItem, transicaoEntrada } from '../motion/tokens';

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
// a tela inteira de uma vez (respeita prefers-reduced-motion via o
// MotionConfig reducedMotion="user" de App.tsx). O título recebido em
// `titulo` é o único <h1> da página; o slogan da marca é texto corrido, não
// heading, para não duplicar o nível 1 da hierarquia. No mobile a faixa de
// marca vira só um cabeçalho compacto acima do formulário, para não empurrar
// o formulário para fora da primeira dobra.
// ---------------------------------------------
export function LayoutDeAutenticacao({
  titulo,
  subtitulo,
  children,
}: PropsDoLayout) {
  return (
    <div className="grid min-h-screen bg-fundo lg:grid-cols-[1.1fr_1fr]">
      <motion.aside
        className="hidden flex-col justify-center gap-6 bg-linear-to-br from-marca to-marca-clara px-12 py-12 text-white lg:flex"
        variants={listaContainer}
        initial="oculto"
        animate="visivel"
      >
        <motion.div variants={listaItem}>
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <span className="rounded-pequeno bg-acento px-2.5 py-1 text-sm font-extrabold">
              NX
            </span>
            <span className="text-base font-bold">Catálogo</span>
          </Link>
        </motion.div>

        <motion.p
          variants={listaItem}
          className="max-w-[18ch] text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.1] font-extrabold tracking-tight"
        >
          Tudo que você precisa, em um só lugar
        </motion.p>

        <motion.ul variants={listaItem} className="flex flex-col gap-3">
          {DESTAQUES.map((destaque) => (
            <li
              key={destaque}
              className="flex items-start gap-3 text-[0.95rem] text-white/85"
            >
              <span
                aria-hidden="true"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-pilula bg-acento/20 text-[0.8rem] font-bold text-acento"
              >
                ✓
              </span>
              {destaque}
            </li>
          ))}
        </motion.ul>
      </motion.aside>

      <main className="flex flex-col items-center justify-center gap-6 px-6 py-10 sm:px-8">
        <Link to="/" className="flex items-center gap-2 text-tinta lg:hidden">
          <span className="rounded-pequeno bg-acento px-2.5 py-1 text-sm font-extrabold text-white">
            NX
          </span>
          <span className="text-base font-bold">Catálogo</span>
        </Link>

        <motion.div
          className="flex w-full max-w-md flex-col gap-5 rounded-grande border border-borda bg-superficie p-8 shadow-carta-media"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transicaoEntrada}
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-tinta">
              {titulo}
            </h1>
            {subtitulo ? (
              <p className="text-sm text-tinta-suave">{subtitulo}</p>
            ) : null}
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
