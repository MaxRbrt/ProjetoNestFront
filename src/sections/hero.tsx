import gsap from 'gsap';
import { Link } from 'react-router-dom';
import { useGsap } from '../hooks/use-gsap';
import { classesDeBotao } from '../ui/indice';

// ---------------------------------------------
// Entrada da loja
// Composição tipográfica sem campanha ou oferta fictícia. O conteúdo nasce
// visível; useGsap só aplica a entrada quando movimento é permitido. A
// ilustração é uma caixa de encomenda em SVG nas cores da marca (a imagem
// anterior era a do template do Vite). Sobre o fundo azul-marinho o contorno
// de foco é branco: o laranja não chega a 3:1 contra marca-clara.
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
      className="relative isolate grid min-h-[22rem] gap-8 overflow-hidden rounded-grande bg-linear-to-br from-marca to-marca-clara px-6 py-10 text-white sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-14"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 bottom-0 -z-10 select-none text-[16rem] leading-none font-extrabold text-white/5 sm:right-6 sm:text-[23rem]"
      >
        N
      </span>
      <div className="relative z-0 order-first hidden min-h-48 items-center justify-center rounded-card border border-white/15 bg-white/5 p-6 sm:flex lg:order-last lg:min-h-64">
        <svg
          viewBox="0 0 240 220"
          aria-hidden="true"
          className="pointer-events-none h-auto w-44 sm:w-52 lg:w-60"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path
            d="M120 30 210 72v96l-90 42-90-42V72z"
            fill="rgb(255 255 255 / 0.06)"
            stroke="rgb(255 255 255 / 0.85)"
            strokeWidth="3"
          />
          <path
            d="M30 72l90 42 90-42M120 114v96"
            stroke="rgb(255 255 255 / 0.85)"
            strokeWidth="3"
          />
          <path
            d="M75 51l90 42v34"
            stroke="var(--color-acento)"
            strokeWidth="14"
          />
          <path
            d="M146 150l40-19M146 164l28-13"
            stroke="rgb(255 255 255 / 0.55)"
            strokeWidth="3"
          />
        </svg>
      </div>
      <div className="relative z-0 flex max-w-2xl flex-col gap-6">
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
            className={classesDeBotao({
              variante: 'primario',
              tamanho: 'medio',
              className: 'focus-visible:outline-white',
            })}
          >
            Ver catálogo
          </Link>
          <a
            href="#categorias"
            className={classesDeBotao({
              variante: 'fantasma',
              tamanho: 'medio',
              className:
                'text-white hover:bg-white/10 hover:text-white focus-visible:outline-white',
            })}
          >
            Ver por categoria
          </a>
        </div>
      </div>
    </div>
  );
}
