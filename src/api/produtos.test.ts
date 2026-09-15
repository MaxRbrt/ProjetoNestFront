import { describe, expect, it } from 'vitest';
import { filtroDaUrl, urlDoFiltro } from './produtos';

// ---------------------------------------------
// Filtros compartilháveis do catálogo
// A URL pode ser editada à mão; valores inválidos não devem chegar à API,
// e compartilhar um filtro precisa preservar a ordenação escolhida.
// ---------------------------------------------
describe('Filtros de produtos na URL', () => {
  it.each(['preco', 'nome'] as const)('lê ordenação por %s', (ordenarPor) => {
    expect(
      filtroDaUrl(new URLSearchParams({ ordenarPor, direcao: 'desc' })),
    ).toMatchObject({ ordenarPor, direcao: 'desc' });
  });

  it('normaliza ordenação e direção inválidas', () => {
    expect(
      filtroDaUrl(new URLSearchParams('ordenarPor=xyz&direcao=xyz')),
    ).toMatchObject({ ordenarPor: null, direcao: 'asc' });
    expect(
      filtroDaUrl(new URLSearchParams('ordenarPor=preco&direcao=xyz')),
    ).toMatchObject({ ordenarPor: 'preco', direcao: 'asc' });
  });

  it('ignora direção sem ordenação', () => {
    expect(filtroDaUrl(new URLSearchParams('direcao=desc'))).toMatchObject({
      ordenarPor: null,
      direcao: 'asc',
    });
  });

  it.each(['0', '-1', 'abc', '1.5'])('normaliza página %s', (pagina) => {
    expect(filtroDaUrl(new URLSearchParams({ pagina })).pagina).toBe(1);
  });

  it('omite ordenação e direção no padrão', () => {
    const parametros = urlDoFiltro({
      categoria: null,
      busca: '',
      pagina: 1,
      ordenarPor: null,
      direcao: 'desc',
    });
    expect(parametros.has('ordenarPor')).toBe(false);
    expect(parametros.has('direcao')).toBe(false);
  });

  it('preserva o filtro na ida e volta, inclusive busca com caracteres especiais', () => {
    const filtro = {
      categoria: 2,
      busca: 'Mouse & teclado',
      pagina: 3,
      ordenarPor: 'preco' as const,
      direcao: 'desc' as const,
    };
    expect(filtroDaUrl(urlDoFiltro(filtro))).toEqual(filtro);
  });
});
