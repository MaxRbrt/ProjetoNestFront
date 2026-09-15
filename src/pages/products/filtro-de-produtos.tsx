import { useEffect, useRef, useState } from 'react';
import type { Categoria, FiltroDeProdutos } from '../../api/produtos';
import { Botao } from '../../ui/indice';

interface PropsDoFiltro {
  categorias: Categoria[];
  filtro: FiltroDeProdutos;
  aoMudar: (novo: FiltroDeProdutos) => void;
}

// ---------------------------------------------
// Categorias do catálogo
// O mesmo conteúdo atende desktop e mobile. O dialog mantém o foco dentro
// do painel e torna o restante da página inerte enquanto os filtros abrem.
// ---------------------------------------------
export function FiltroDeProdutosView({
  categorias,
  filtro,
  aoMudar,
}: PropsDoFiltro) {
  const [aberto, setAberto] = useState(false);
  const painel = useRef<HTMLDialogElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const temFiltro =
    filtro.categoria !== null ||
    Boolean(filtro.busca) ||
    filtro.ordenarPor !== null;

  useEffect(() => {
    if (!aberto) return;
    const dialogo = painel.current;
    dialogo?.showModal();
    botaoFechar.current?.focus();
    return () => dialogo?.close();
  }, [aberto]);

  function fechar() {
    setAberto(false);
    gatilho.current?.focus();
  }

  function aplicar(novo: FiltroDeProdutos) {
    aoMudar(novo);
    if (aberto) fechar();
  }

  const conteudo = (
    <div className="flex flex-col gap-2">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-tinta-media">
        Categorias
      </h2>
      {[{ id: null, nome: 'Todas' }, ...categorias].map((categoria) => (
        <button
          key={categoria.id ?? 'todas'}
          type="button"
          aria-pressed={filtro.categoria === categoria.id}
          className={`min-h-11 rounded-card px-3 py-2 text-left text-sm break-words focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento ${filtro.categoria === categoria.id ? 'bg-marca text-white font-semibold' : 'text-tinta hover:bg-superficie-sutil'}`}
          onClick={() =>
            aplicar({ ...filtro, categoria: categoria.id, pagina: 1 })
          }
        >
          {categoria.nome}
        </button>
      ))}
      {temFiltro ? (
        <Botao
          type="button"
          variante="fantasma"
          className="mt-4"
          onClick={() =>
            aplicar({
              categoria: null,
              busca: '',
              pagina: 1,
              ordenarPor: null,
              direcao: 'asc',
            })
          }
        >
          Limpar filtros
        </Botao>
      ) : null}
    </div>
  );

  return (
    <>
      <aside
        aria-label="Filtros de produtos"
        className="hidden w-64 shrink-0 lg:block"
      >
        {conteudo}
      </aside>
      <div className="lg:hidden">
        <button
          ref={gatilho}
          type="button"
          className="min-h-11 rounded-card border border-borda-forte bg-superficie px-6 font-semibold text-tinta focus-visible:outline-2 focus-visible:outline-acento"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          onClick={() => setAberto(true)}
        >
          Filtrar
        </button>
        <dialog
          ref={painel}
          aria-label="Filtros de produtos"
          aria-modal="true"
          className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/40"
          onCancel={(evento) => {
            evento.preventDefault();
            fechar();
          }}
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) fechar();
          }}
        >
          <div
            className="flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-superficie p-4 shadow-carta-media"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-tinta">Filtros</span>
              <button
                ref={botaoFechar}
                type="button"
                className="min-h-11 rounded-card px-3 text-tinta focus-visible:outline-2 focus-visible:outline-acento"
                onClick={fechar}
                aria-label="Fechar filtros"
              >
                Fechar
              </button>
            </div>
            {conteudo}
          </div>
        </dialog>
      </div>
    </>
  );
}
