export interface PropsDoEsqueleto {
  className?: string;
}

// ---------------------------------------------
// Esqueleto
// aria-hidden impede o leitor de tela de anunciar o bloco cinza como se fosse
// conteúdo real: quem usa leitor de tela deve ouvir o estado de carregamento
// da tela, não um retângulo vazio lido como texto.
// ---------------------------------------------
export function Esqueleto({ className = '' }: PropsDoEsqueleto) {
  return <div aria-hidden="true" className={`animate-pulse rounded-card bg-borda ${className}`} />;
}
