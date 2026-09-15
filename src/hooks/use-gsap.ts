import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

// ---------------------------------------------
// Animação com GSAP presa ao ciclo de vida do componente
// gsap.context() registra tudo o que a animação criou e o revert() do
// cleanup desfaz de uma vez — sem isso, uma tela remontada (o StrictMode
// remonta de propósito) acumula timelines sobre os mesmos elementos.
// matchMedia respeita prefers-reduced-motion: quem pediu menos movimento
// recebe o estado final, não uma versão mais lenta da animação.
// ---------------------------------------------
export function useGsap(
  callback: (contexto: gsap.Context) => void,
  dependencias: unknown[] = [],
) {
  const escopo = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!escopo.current) return;

    const contexto = gsap.context((self) => {
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        callback(self);
      });
    }, escopo);

    return () => contexto.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return escopo;
}
