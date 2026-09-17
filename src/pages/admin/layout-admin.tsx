import { NavLink, Outlet, Link } from 'react-router-dom';
import { useSessao } from '../../auth/contexto-de-sessao';

const LINKS = [
  { para: '/admin', rotulo: 'Dashboard', fim: true },
  { para: '/admin/produtos', rotulo: 'Produtos', fim: false },
  { para: '/admin/categorias', rotulo: 'Categorias', fim: false },
  { para: '/admin/pedidos', rotulo: 'Pedidos', fim: false },
] as const;

// ---------------------------------------------
// Casca do painel administrativo
// Não monta o Cabecalho da loja: o painel tem topo e navegação próprios, sem
// busca de catálogo nem link de conta. Barra lateral fixa em lg; no mobile a
// mesma navegação vira uma faixa que quebra linha abaixo do topo. Único
// <main id="conteudo"> do painel, com o mesmo link "Pular para o conteúdo"
// que o LayoutDaLoja oferece na loja.
// ---------------------------------------------
export function LayoutAdmin() {
  const { usuario, sair } = useSessao();

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-white focus:px-4 focus:py-2 focus:text-tinta focus:shadow-carta-media focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
      >
        Pular para o conteúdo
      </a>

      <header className="flex items-center justify-between gap-4 border-b border-borda bg-superficie px-4 py-2 lg:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-pequeno bg-acento text-base font-bold text-white">
            NX
          </span>
          <span className="text-lg font-semibold text-tinta">Painel</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/"
            className="flex min-h-12 items-center rounded-pequeno px-2 text-base font-medium text-tinta-media underline decoration-borda-forte underline-offset-4 hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            Ver loja
          </Link>
          {usuario ? (
            <span className="hidden text-base text-tinta-media md:inline">
              {usuario.email}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void sair()}
            className="flex min-h-12 items-center rounded-card border border-borda-forte px-4 text-base font-semibold text-tinta hover:bg-superficie-sutil focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Navegação do painel admin"
          className="flex flex-wrap gap-1 border-b border-borda bg-superficie px-4 py-2 lg:w-60 lg:flex-nowrap lg:shrink-0 lg:flex-col lg:gap-1 lg:border-b-0 lg:border-r lg:p-3"
        >
          {LINKS.map((link) => (
            <NavLink
              key={link.para}
              to={link.para}
              end={link.fim}
              className={({ isActive }) =>
                `flex min-h-12 shrink-0 items-center rounded-pequeno border-l-4 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca ${
                  isActive
                    ? 'border-acento bg-acento-suave font-semibold text-acento-escuro'
                    : 'border-transparent font-medium text-tinta-media hover:bg-superficie-sutil hover:text-tinta'
                }`
              }
            >
              {link.rotulo}
            </NavLink>
          ))}
        </nav>

        <main id="conteudo" className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
