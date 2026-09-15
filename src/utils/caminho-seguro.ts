// ---------------------------------------------
// Validação de caminho interno de retorno
// Usada por qualquer redirecionamento que aceite um destino vindo de fora
// (query string, state de navegação). A garantia vem de resolver o valor com
// o mesmo parser de URL do navegador (o construtor URL implementa o
// algoritmo do WHATWG) e comparar a origem resultante, não de inspecionar a
// string: um caractere de controle (tab, LF, CR) é removido pelo próprio
// parser antes da resolução, então "/\t/evil.com" passa por qualquer checagem
// textual baseada em startsWith mas ainda resolve para "http://evil.com/".
// Só depois de resolver é que dá para saber a origem de verdade.
// ---------------------------------------------
export function caminhoInternoSeguro(
  valor: string | null | undefined,
  origem: string = window.location.origin,
): string | null {
  if (!valor || !valor.startsWith('/')) return null;

  let url: URL;
  try {
    url = new URL(valor, origem);
  } catch {
    return null;
  }

  if (url.origin !== origem) return null;
  return url.pathname + url.search + url.hash;
}
