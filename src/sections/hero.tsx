import gsap from 'gsap';
import { Link } from 'react-router-dom';
import { useGsap } from '../hooks/use-gsap';

// ---------------------------------------------
// Entrada da loja
// Composição tipográfica sem campanha ou oferta fictícia. O conteúdo nasce
// visível; useGsap só aplica a entrada quando movimento é permitido.
// ---------------------------------------------
export function Hero() {
  const escopo = useGsap((contexto) => {
    gsap.timeline().from(contexto.selector!('[data-entrada-hero]'), {
      opacity: 0,
      y: 16,
      duration: 0.24,
      stagger: 0.08,
      ease: 'power2.out',
    });
  });

  return (
    <div
      ref={escopo}
      className="relative isolate flex min-h-[22rem] items-center overflow-hidden rounded-grande bg-linear-to-br from-marca to-marca-clara px-6 py-10 text-white sm:px-10 lg:px-14"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 bottom-0 -z-10 select-none text-[16rem] leading-none font-extrabold text-white/5 sm:right-6 sm:text-[23rem]"
      >
        N
      </span>
      <div className="flex max-w-2xl flex-col gap-6">
        <h1
          data-entrada-hero
          className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl"
        >
          Seu próximo produto começa aqui.
        </h1>
        <p
          data-entrada-hero
          className="max-w-lg text-base leading-relaxed text-white/80 sm:text-lg"
        >
          Explore o catálogo, compare preços e encontre o que procura por
          categoria.
        </p>
        <div data-entrada-hero className="flex flex-wrap gap-3">
          <Link
            to="/produtos"
            className="inline-flex min-h-11 items-center justify-center rounded-card bg-acento px-6 py-3 font-semibold hover:bg-acento-escuro focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento"
          >
            Ver catálogo
          </Link>
          <a
            href="#categorias"
            className="inline-flex min-h-11 items-center justify-center rounded-card border border-white/40 px-6 py-3 font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento"
          >
            Ver por categoria
          </a>
        </div>
      </div>
    </div>
  );
}
