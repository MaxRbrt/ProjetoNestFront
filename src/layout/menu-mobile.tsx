import { useEffect, useRef, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../api/cliente';
import { useCategorias } from '../hooks/use-categorias';
import { useSessao } from '../auth/contexto-de-sessao';

interface PropsDoMenuMobile {
  aberto: boolean;
  aoFechar: () => void;
  cliente: ApiClient;
  refDoGatilho: RefObject<HTMLButtonElement | null>;
}

// ---------------------------------------------
// Menu mobile
// Substitui, em telas estreitas, a faixa utilitária e a barra de categorias
// que somem — sem ele o visitante mobile perderia acesso a categorias, conta,
// pedidos e endereços. Foco vai para o botão de fechar assim que o painel
// abre e volta para o botão que abriu ao fechar, para quem navega por teclado
// não perder o lugar na página. Escape e clique no fundo fecham do mesmo
// jeito que clicar no X. overscroll-behavior: contain evita que rolar o
// conteúdo do painel role a página por trás dele no iOS/Android.
// ---------------------------------------------
export function MenuMobile({
  aberto,
  aoFechar,
  cliente,
  refDoGatilho,
}: PropsDoMenuMobile) {
  const { usuario, sair } = useSessao();
  const { categorias } = useCategorias(cliente);
  const refDoBotaoFechar = useRef<HTMLButtonElement | null>(null);
  const foiAbertoAntes = useRef(false);

  useEffect(() => {
    if (aberto) {
      foiAbertoAntes.current = true;
      refDoBotaoFechar.current?.focus();
      return;
    }
    if (foiAbertoAntes.current) {
      refDoGatilho.current?.focus();
    }
  }, [aberto, refDoGatilho]);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        aoFechar();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={aoFechar}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-carta-media"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-center justify-between border-b border-borda px-4 py-3.5">
          <span className="text-sm font-semibold text-tinta">Menu</span>
          <button
            ref={refDoBotaoFechar}
            type="button"
            aria-label="Fechar menu"
            onClick={aoFechar}
            className="flex h-9 w-9 items-center justify-center rounded-pequeno text-tinta-media hover:bg-superficie-sutil hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-2 py-3" aria-label="Categorias">
          <span className="px-2 py-1 text-xs font-semibold uppercase text-tinta-media">
            Categorias
          </span>
          {categorias.map((categoria) => (
            <Link
              key={categoria.id}
              to={`/produtos?categoria=${categoria.id}`}
              onClick={aoFechar}
              className="rounded-pequeno px-2 py-2 text-sm text-tinta hover:bg-superficie-sutil"
            >
              {categoria.nome}
            </Link>
          ))}
        </nav>

        <nav
          className="mt-auto flex flex-col gap-1 border-t border-borda px-2 py-3"
          aria-label="Conta"
        >
          {usuario ? (
            <>
              <span className="px-2 py-1 text-xs text-tinta-media">
                {usuario.email}
              </span>
              <Link
                to="/pedidos"
                onClick={aoFechar}
                className="rounded-pequeno px-2 py-2 text-sm text-tinta hover:bg-superficie-sutil"
              >
                Meus pedidos
              </Link>
              <Link
                to="/enderecos"
                onClick={aoFechar}
                className="rounded-pequeno px-2 py-2 text-sm text-tinta hover:bg-superficie-sutil"
              >
                Meus endereços
              </Link>
              {usuario.papel === 'ADMIN' ? (
                <Link
                  to="/admin"
                  onClick={aoFechar}
                  className="rounded-pequeno px-2 py-2 text-sm text-tinta hover:bg-superficie-sutil"
                >
                  Painel admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  aoFechar();
                  void sair();
                }}
                className="rounded-pequeno px-2 py-2 text-left text-sm text-tinta hover:bg-superficie-sutil"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                to="/entrar"
                onClick={aoFechar}
                className="rounded-pequeno px-2 py-2 text-sm text-tinta hover:bg-superficie-sutil"
              >
                Entrar
              </Link>
              <Link
                to="/cadastrar"
                onClick={aoFechar}
                className="rounded-pequeno px-2 py-2 text-sm text-tinta hover:bg-superficie-sutil"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
