import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSessao } from '../auth/contexto-de-sessao';
import { useCarrinho } from '../auth/contexto-do-carrinho';
import { Botao, Esqueleto, classesDeBotao } from '../ui/indice';
import { Busca } from './busca';

// ---------------------------------------------
// Cabeçalho da loja
// A navegação permanece visível também no celular: nenhuma ação de conta
// depende de abrir um menu ou de reconhecer um ícone sem texto. As
// categorias não ficam aqui — a tela inicial e a lateral do catálogo já as
// listam, e uma terceira faixa deixava o topo pesado sem acrescentar caminho.
// ---------------------------------------------
export function Cabecalho() {
  const { situacao, usuario, sair } = useSessao();
  const { totalDeItens } = useCarrinho();
  const local = useLocation();
  const links = [
    { para: '/produtos', rotulo: 'Catálogo' },
    ...(usuario
      ? [
          { para: '/pedidos', rotulo: 'Meus pedidos' },
          { para: '/perfil', rotulo: 'Meu perfil' },
          { para: '/enderecos', rotulo: 'Meus endereços' },
        ]
      : [{ para: '/cadastrar', rotulo: 'Criar conta' }]),
    ...(usuario?.papel === 'ADMIN'
      ? [{ para: '/admin', rotulo: 'Painel admin' }]
      : []),
  ];

  return (
    <header>
      <div className="bg-superficie-sutil px-4 py-2 text-center text-base text-tinta-media">
        Loja de demonstração — compras simuladas
      </div>

      <div className="bg-marca text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-8 lg:px-8">
          <Link
            to="/"
            aria-label="NX Catálogo — início"
            className="flex min-h-12 w-fit items-center gap-3 rounded-pequeno font-bold hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span className="rounded-pequeno bg-acento px-3 py-2 text-xl">
              NX
            </span>
            <span className="text-xl">Catálogo</span>
          </Link>

          <Busca key={local.pathname + local.search} />

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:flex">
            {situacao === 'verificando' ? (
              <div role="status" aria-label="Verificando conta">
                <Esqueleto className="h-13 w-full bg-white/20 lg:w-36" />
              </div>
            ) : (
              <Link
                to={usuario ? '/perfil' : '/entrar'}
                className="flex min-h-13 items-center justify-center gap-1.5 whitespace-nowrap rounded-card border border-white/60 px-2 py-2 sm:gap-2 sm:px-3 text-base font-semibold hover:bg-marca-clara focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {usuario ? 'Minha conta' : 'Entrar na conta'}
              </Link>
            )}
            <Link
              to="/carrinho"
              aria-label={`Carrinho, ${totalDeItens} ${totalDeItens === 1 ? 'item' : 'itens'}`}
              className="flex min-h-13 items-center justify-center gap-1.5 whitespace-nowrap rounded-card border border-white/60 px-2 py-2 sm:gap-2 sm:px-3 text-base font-semibold hover:bg-marca-clara focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="shrink-0"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <span>
                Carrinho{totalDeItens > 0 ? ` (${totalDeItens})` : ''}
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-borda bg-superficie">
        <nav
          aria-label="Navegação principal"
          className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:px-6 lg:px-8"
        >
          {links.map(({ para, rotulo }) => (
            <NavLink
              key={para}
              to={para}
              className={classesDeBotao({
                variante: 'fantasma',
                tamanho: 'pequeno',
                className:
                  'aria-[current=page]:bg-acento-suave aria-[current=page]:text-acento-escuro aria-[current=page]:underline decoration-2 underline-offset-8',
              })}
            >
              {rotulo}
            </NavLink>
          ))}
          {usuario ? (
            <Botao
              type="button"
              variante="fantasma"
              tamanho="pequeno"
              className="sm:ml-auto"
              onClick={() => void sair()}
            >
              Sair da conta
            </Botao>
          ) : null}
        </nav>
      </div>

    </header>
  );
}
