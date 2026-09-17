import { describe, expect, it } from 'vitest';
import { calcularVariacao } from './variacao';

// ---------------------------------------------
// Variação contra o período anterior
// O texto é a informação (a seta e a cor só reforçam), por isso o teste
// confere a frase inteira. Taxas comparam em pontos percentuais: "de 10%
// para 15%" é 5 pontos, não "50% acima", que confunde quem lê.
// ---------------------------------------------
describe('calcularVariacao', () => {
  it('alta relativa arredondada ao inteiro', () => {
    expect(calcularVariacao(112, 100)).toEqual({
      sentido: 'alta',
      texto: '12% acima do período anterior',
    });
  });

  it('baixa relativa', () => {
    expect(calcularVariacao(75, 100)).toEqual({
      sentido: 'baixa',
      texto: '25% abaixo do período anterior',
    });
  });

  it('igual quando os valores coincidem', () => {
    expect(calcularVariacao(40, 40)).toEqual({
      sentido: 'igual',
      texto: 'Igual ao período anterior',
    });
  });

  it('variação menor que 1% não vira "0% acima"', () => {
    expect(calcularVariacao(1001, 1000)).toEqual({
      sentido: 'alta',
      texto: 'Menos de 1% acima do período anterior',
    });
  });

  it('sem base quando o anterior é zero', () => {
    expect(calcularVariacao(500, 0)).toEqual({
      sentido: 'sem-base',
      texto: 'Sem base de comparação',
    });
  });

  it('zero contra zero é igual, não sem base', () => {
    expect(calcularVariacao(0, 0).sentido).toBe('igual');
  });

  it('taxas comparam em pontos percentuais', () => {
    expect(calcularVariacao(0.15, 0.1, 'pontos')).toEqual({
      sentido: 'alta',
      texto: '5 pontos percentuais acima do período anterior',
    });
    expect(calcularVariacao(0.1, 0.125, 'pontos')).toEqual({
      sentido: 'baixa',
      texto: '2,5 pontos percentuais abaixo do período anterior',
    });
  });

  it('taxa sem valor em algum dos lados fica sem base', () => {
    expect(calcularVariacao(0.2, null, 'pontos').sentido).toBe('sem-base');
    expect(calcularVariacao(null, 0.2, 'pontos').sentido).toBe('sem-base');
  });
});
