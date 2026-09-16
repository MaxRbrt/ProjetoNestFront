import type { Transition, Variants } from 'motion/react';

// ---------------------------------------------
// Durações e curvas do movimento
// Espelham as curvas do tema (--ease-saida/--ease-entrada em
// src/styles/tema.css) de propósito: componentes animados pelo Motion e
// elementos animados por transição de CSS precisam ter o mesmo tempo, senão a
// interface parece ter duas personalidades. A curva desacelera até parar,
// acompanhando as superfícies arredondadas — nenhum movimento trava seco.
// ---------------------------------------------
export const DURACAO = {
  instantanea: 0.12,
  feedback: 0.18,
  transicao: 0.26,
} as const;

export const CURVA = {
  saida: [0.22, 1, 0.36, 1],
  entrada: [0.4, 0, 0.2, 1],
} as const;

export const transicaoEntrada: Transition = {
  duration: DURACAO.transicao,
  ease: CURVA.saida,
};

// ---------------------------------------------
// Entrada escalonada de listas
// O atraso entre itens comunica que o conteúdo chegou em bloco, em vez de
// cada item pipocar isolado. O intervalo é curto: numa grade de produtos, um
// escalonamento longo faria a última linha demorar a aparecer.
// ---------------------------------------------
export const listaContainer: Variants = {
  oculto: {},
  visivel: {
    transition: { staggerChildren: 0.04 },
  },
};

export const listaItem: Variants = {
  oculto: { opacity: 0, y: 12 },
  visivel: {
    opacity: 1,
    y: 0,
    transition: transicaoEntrada,
  },
};

// ---------------------------------------------
// Erro de formulário
// Deslocamento lateral curto: o usuário percebe a recusa fisicamente, antes
// de ler a mensagem. A amplitude é pequena de propósito — sacudir muito vira
// ruído e atrapalha quem tem sensibilidade a movimento.
// ---------------------------------------------
export const sacudir: Variants = {
  parado: { x: 0 },
  erro: {
    x: [0, -8, 8, -5, 0],
    transition: { duration: DURACAO.transicao, ease: CURVA.entrada },
  },
};
