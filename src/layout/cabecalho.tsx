import { useRef, useState } from 'react';
import gsap from 'gsap';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../api/cliente';
import { useSessao } from '../auth/contexto-de-sessao';
import { useCarrinho } from '../auth/contexto-do-carrinho';
import { useGsap } from '../hooks/use-gsap';
import { Esqueleto } from '../ui/indice';
import { BarraDeCategorias } from './barra-de-categorias';
import { Busca } from './busca';
import { MenuMobile } from './menu-mobile';

interface PropsDoCabecalho {
  cliente: ApiClient;
}

// ---------------------------------------------
// Cabeçalho da loja
// Três faixas: a utilitária e a barra de categorias somem no mobile (o
// hambúrguer abre o mesmo conteúdo dentro de MenuMobile), só a faixa
// principal — com logo, busca e o bloco de conta/carrinho — fica sempre
// visível. O catálogo é público, então "verificando" e "anonimo" já mostram
// carrinho e ações de conta (entrar/cadastrar); só o texto que troca entre
// "entrar/cadastrar" e "email/sair" reserva o próprio espaço enquanto a
// sessão ainda está sendo verificada, para não piscar um conteúdo e depois o
// outro assim que a verificação terminar.
// ---------------------------------------------
export function Cabecalho({ cliente }: PropsDoCabecalho) {
  const { situacao, usuario, sair } = useSessao();
  const { totalDeItens } = useCarrinho();
  const [menuAberto, setMenuAberto] = useState(false);
  const refDoGatilho = useRef<HTMLButtonElement | null>(null);

  const escopo = useGsap(() => {
    if (totalDeItens === 0) return;
    gsap.fromTo(
      '[data-contador]',
      { scale: 1 },
      {
        scale: 1.25,
        duration: 0.18,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
      },
    );
  }, [totalDeItens]);

  return (
    <header>
      <div ref={escopo} className="contents">
        <div className="hidden bg-marca text-xs text-white/70 md:block">
          <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <span>
              Loja de demonstração — compre à vontade, é tudo simulado.
            </span>
            {usuario ? (
              <nav aria-label="Conta" className="flex items-center gap-4">
                <Link to="/pedidos" className="hover:text-white">
                  Meus pedidos
                </Link>
                <Link to="/enderecos" className="hover:text-white">
                  Meus endereços
                </Link>
              </nav>
            ) : null}
          </div>
        </div>

        <div className="sticky top-0 z-40 bg-marca">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <button
              ref={refDoGatilho}
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMenuAberto(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pequeno text-white lg:hidden"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ☰
              </span>
            </button>

            <Link
              to="/"
              className="flex min-h-11 shrink-0 items-center gap-2 text-white"
            >
              <span className="rounded-pequeno bg-acento px-2.5 py-1 text-sm font-extrabold">
                NX
              </span>
              <span className="hidden text-base font-bold sm:inline">
                Catálogo
              </span>
            </Link>

            <div className="flex min-w-0 flex-1 justify-center">
              <Busca />
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {situacao === 'verificando' ? (
                <Esqueleto className="h-9 w-40 bg-white/20" />
              ) : situacao === 'autenticado' ? (
                <div className="hidden items-center gap-3 sm:flex">
                  <span className="max-w-[10rem] truncate text-sm text-white/90">
                    {usuario?.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void sair()}
                    className="text-sm font-medium text-white/90 hover:text-white"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <div className="hidden items-center gap-3 sm:flex">
                  <Link
                    to="/entrar"
                    className="text-sm font-medium text-white/90 hover:text-white"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/cadastrar"
                    className="rounded-card bg-acento px-3.5 py-2 text-sm font-semibold text-white hover:bg-acento-escuro"
                  >
                    Criar conta
                  </Link>
                </div>
              )}

              <Link
                to="/carrinho"
                aria-label={`Carrinho, ${totalDeItens} ${totalDeItens === 1 ? 'item' : 'itens'}`}
                className="relative flex h-11 w-11 items-center justify-center rounded-pequeno text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                {totalDeItens > 0 ? (
                  <span
                    data-contador
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-pilula bg-acento px-1 text-xs font-bold text-white"
                  >
                    {totalDeItens}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
        </div>

        <BarraDeCategorias cliente={cliente} />

        <MenuMobile
          aberto={menuAberto}
          aoFechar={() => setMenuAberto(false)}
          cliente={cliente}
          refDoGatilho={refDoGatilho}
        />
      </div>
    </header>
  );
}
