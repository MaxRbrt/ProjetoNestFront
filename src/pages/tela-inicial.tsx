import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ApiClient } from '../api/cliente';
import { useGsap } from '../hooks/use-gsap';
import { Beneficios } from '../sections/beneficios';
import { FaixaDeCategorias } from '../sections/faixa-de-categorias';
import { Hero } from '../sections/hero';
import { Vitrine } from '../sections/vitrine';

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------
// Home pública
// Cada vitrine carrega por conta própria. O observador recalcula os pontos
// de entrada quando os esqueletos mudam de altura, inclusive em rede lenta.
// O contexto de useGsap desfaz animações e triggers ao sair da página.
// ---------------------------------------------
export function TelaInicial({ cliente }: { cliente: ApiClient }) {
  const escopo = useGsap((contexto) => {
    for (const secao of contexto.selector!('[data-secao-home]')) {
      gsap.from(secao, {
        opacity: 0,
        y: 20,
        duration: 0.35,
        ease: 'power2.out',
        scrollTrigger: { trigger: secao, start: 'clamp(top 90%)', once: true },
      });
    }
  });

  useEffect(() => {
    if (!escopo.current || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => ScrollTrigger.refresh());
    observador.observe(escopo.current);
    return () => observador.disconnect();
  }, [escopo]);

  return (
    <div className="flex w-full justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div
        ref={escopo}
        className="flex w-full min-w-0 max-w-7xl flex-col gap-10 lg:gap-12"
      >
        <Hero />
        <div data-secao-home>
          <FaixaDeCategorias cliente={cliente} />
        </div>
        <div data-secao-home>
          <Vitrine cliente={cliente} titulo="No catálogo" />
        </div>
        <div data-secao-home>
          <Vitrine
            cliente={cliente}
            titulo="Menores preços"
            ordenarPor="preco"
          />
        </div>
        <div data-secao-home>
          <Beneficios />
        </div>
      </div>
    </div>
  );
}
