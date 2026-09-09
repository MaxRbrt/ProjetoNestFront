const FORMATADOR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// ---------------------------------------------
// Dinheiro
// A API fala em centavos inteiros, e a tela fala em reais. Toda a conversão
// entre os dois vive aqui: espalhar divisão por 100 pelos componentes é como
// o erro de arredondamento volta, um lugar de cada vez. Antes desta unificação
// havia sete cópias do mesmo Intl.NumberFormat pelas telas.
// ---------------------------------------------
export function formatarCentavos(centavos: number): string {
  return FORMATADOR.format(centavos / 100);
}

// ---------------------------------------------
// Entrada digitada pela pessoa
// Aceita "19,90" e "19.90": em teclado brasileiro a vírgula é o separador
// natural, e um formulário que recusa vírgula silenciosamente vira preço
// errado. Devolve null quando não dá para interpretar, para o formulário
// avisar em vez de enviar NaN para a API.
//
// O arredondamento é obrigatório: 19.90 * 100 dá 1989.9999999999998 em ponto
// flutuante, e truncar tiraria um centavo de cada produto cadastrado.
// ---------------------------------------------
export function reaisParaCentavos(texto: string): number | null {
  const normalizado = texto.trim().replace(',', '.');
  if (normalizado === '') return null;

  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor < 0) return null;

  return Math.round(valor * 100);
}

// ---------------------------------------------
// Preenchimento do formulário a partir do dado salvo
// Sem símbolo de moeda: o valor vai para dentro de um <input>, onde "R$" seria
// reenviado como texto na próxima gravação.
// ---------------------------------------------
export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2);
}
