import { describe, expect, it } from 'vitest';
import { centavosParaReais, formatarCentavos, reaisParaCentavos } from './dinheiro';

// ---------------------------------------------
// Conversão de dinheiro
// O caso que justifica o arquivo inteiro é "19,90": em ponto flutuante,
// 19.90 * 100 dá 1989.9999999999998, e truncar tiraria um centavo de cada
// produto cadastrado. Se alguém trocar o Math.round por Math.trunc ou por
// um cast, é aqui que quebra.
// ---------------------------------------------
describe('reaisParaCentavos', () => {
  it('converte o caso que quebra em ponto flutuante', () => {
    expect(19.9 * 100).not.toBe(1990); // a razão de o arredondamento existir
    expect(reaisParaCentavos('19.90')).toBe(1990);
  });

  it('aceita vírgula, que é o separador do teclado brasileiro', () => {
    expect(reaisParaCentavos('19,90')).toBe(1990);
  });

  it('converte valores inteiros e zero', () => {
    expect(reaisParaCentavos('20')).toBe(2000);
    expect(reaisParaCentavos('0')).toBe(0);
  });

  it('arredonda a terceira casa em vez de truncar', () => {
    expect(reaisParaCentavos('0.999')).toBe(100);
    expect(reaisParaCentavos('0.994')).toBe(99);
  });

  it('recusa entrada inválida em vez de devolver NaN', () => {
    expect(reaisParaCentavos('')).toBeNull();
    expect(reaisParaCentavos('   ')).toBeNull();
    expect(reaisParaCentavos('dezenove reais')).toBeNull();
    expect(reaisParaCentavos('-5')).toBeNull();
  });
});

// ---------------------------------------------
// Formatação de moeda
// O replace troca o espaço não separável que o Intl coloca entre símbolo e
// número por um espaço comum, para a asserção continuar legível.
// ---------------------------------------------
describe('formatarCentavos', () => {
  it('formata centavos como moeda brasileira', () => {
    expect(formatarCentavos(1990).replace(/ /g, ' ')).toBe('R$ 19,90');
    expect(formatarCentavos(0).replace(/ /g, ' ')).toBe('R$ 0,00');
    expect(formatarCentavos(100000).replace(/ /g, ' ')).toBe('R$ 1.000,00');
  });
});

describe('ida e volta', () => {
  it('reais -> centavos -> reais preserva o valor digitado', () => {
    for (const entrada of ['0.01', '19.90', '1000.00', '7.35']) {
      const centavos = reaisParaCentavos(entrada);
      expect(centavos).not.toBeNull();
      expect(centavosParaReais(centavos as number)).toBe(
        Number(entrada).toFixed(2),
      );
    }
  });

  it('somar centavos não acumula erro, que é o motivo da mudança', () => {
    const somaEmCentavos = 10 + 10 + 10;
    expect(somaEmCentavos).toBe(30);
    expect(0.1 + 0.1 + 0.1).not.toBe(0.3); // o comportamento que ficou para trás
  });
});
