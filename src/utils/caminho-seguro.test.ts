import { describe, expect, it } from 'vitest';
import { caminhoInternoSeguro } from './caminho-seguro';

const ORIGEM = 'http://localhost:3001';

// ---------------------------------------------
// Validação de caminho interno
// O caso que justifica o arquivo inteiro é "/\t/evil.com": o construtor URL
// (mesmo parser do navegador) descarta o tab antes de resolver e o resultado
// vira "http://evil.com/" — uma checagem textual como startsWith('/') nunca
// veria isso. Se alguém trocar a resolução por URL de volta para inspeção de
// string, é aqui que quebra.
// ---------------------------------------------
describe('caminhoInternoSeguro', () => {
  it('aceita um caminho interno comum', () => {
    expect(caminhoInternoSeguro('/produtos/9', ORIGEM)).toBe('/produtos/9');
  });

  it('aceita a raiz', () => {
    expect(caminhoInternoSeguro('/', ORIGEM)).toBe('/');
  });

  it('recusa URL absoluta com esquema', () => {
    expect(caminhoInternoSeguro('https://evil.com', ORIGEM)).toBeNull();
  });

  it('recusa protocol-relative com duas barras', () => {
    expect(caminhoInternoSeguro('//evil.com', ORIGEM)).toBeNull();
  });

  it('recusa barra invertida, que o navegador também trata como host', () => {
    expect(caminhoInternoSeguro('/\\evil.com', ORIGEM)).toBeNull();
  });

  it('recusa tab, que o parser remove antes de resolver a origem', () => {
    expect(caminhoInternoSeguro('/\t/evil.com', ORIGEM)).toBeNull();
  });

  it('recusa quebra de linha (LF), pelo mesmo motivo do tab', () => {
    expect(caminhoInternoSeguro('/\n/evil.com', ORIGEM)).toBeNull();
  });

  it('recusa retorno de carro (CR), pelo mesmo motivo do tab', () => {
    expect(caminhoInternoSeguro('/\r/evil.com', ORIGEM)).toBeNull();
  });

  it('recusa string vazia, nulo e indefinido', () => {
    expect(caminhoInternoSeguro('', ORIGEM)).toBeNull();
    expect(caminhoInternoSeguro(null, ORIGEM)).toBeNull();
    expect(caminhoInternoSeguro(undefined, ORIGEM)).toBeNull();
  });

  it('recusa caminho relativo sem barra inicial', () => {
    expect(caminhoInternoSeguro('produtos/9', ORIGEM)).toBeNull();
  });
});
