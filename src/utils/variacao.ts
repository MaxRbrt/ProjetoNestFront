export type SentidoDaVariacao = 'alta' | 'baixa' | 'igual' | 'sem-base';

export interface Variacao {
  sentido: SentidoDaVariacao;
  texto: string;
}

const PONTOS = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const SEM_BASE: Variacao = {
  sentido: 'sem-base',
  texto: 'Sem base de comparação',
};

// ---------------------------------------------
// Variação contra o período anterior
// "relativo" compara quantidades (faturamento, pedidos, ticket) em
// porcentagem do valor anterior; "pontos" compara taxas pela diferença em
// pontos percentuais. Anterior zero não tem porcentagem possível — vira
// "sem base", nunca infinito. A frase é o dado principal para quem usa
// leitor de tela; seta e cor na tela apenas repetem o sentido.
// ---------------------------------------------
export function calcularVariacao(
  atual: number | null,
  anterior: number | null,
  modo: 'relativo' | 'pontos' = 'relativo',
): Variacao {
  if (atual === null || anterior === null) return SEM_BASE;
  if (atual === anterior) {
    return { sentido: 'igual', texto: 'Igual ao período anterior' };
  }

  const sentido = atual > anterior ? 'alta' : 'baixa';
  const direcao = sentido === 'alta' ? 'acima' : 'abaixo';

  if (modo === 'pontos') {
    const pontos = PONTOS.format(Math.abs(atual - anterior) * 100);
    return {
      sentido,
      texto: `${pontos} pontos percentuais ${direcao} do período anterior`,
    };
  }

  if (anterior === 0) return SEM_BASE;

  const percentual = Math.round(
    (Math.abs(atual - anterior) / Math.abs(anterior)) * 100,
  );
  return {
    sentido,
    texto:
      percentual < 1
        ? `Menos de 1% ${direcao} do período anterior`
        : `${percentual}% ${direcao} do período anterior`,
  };
}
