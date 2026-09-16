import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { filtroDaUrl, urlDoFiltro } from '../../api/produtos';
import { useCategorias } from '../../hooks/use-categorias';
import { useProdutos } from '../../hooks/use-produtos';
import { CabecalhoDaPagina } from '../../layout/cabecalho-da-pagina';
import { GradeDeProdutos } from '../../produtos/grade-de-produtos';
import { Aviso, Botao, Cartao, Selecao } from '../../ui/indice';
import { FiltroDeProdutosView } from './filtro-de-produtos';
import { Paginacao } from './paginacao';

interface PropsDaTela {
  cliente: ApiClient;
}

const ORDENACOES = [
  { valor: '', rotulo: 'Relevância', ordenarPor: null, direcao: 'asc' },
  {
    valor: 'preco-asc',
    rotulo: 'Menor preço',
    ordenarPor: 'preco',
    direcao: 'asc',
  },
  {
    valor: 'preco-desc',
    rotulo: 'Maior preço',
    ordenarPor: 'preco',
    direcao: 'desc',
  },
  {
    valor: 'nome-asc',
    rotulo: 'Nome (A-Z)',
    ordenarPor: 'nome',
    direcao: 'asc',
  },
] as const;

// ---------------------------------------------
// Catálogo compartilhável
// A URL é a fonte de categoria, busca e ordenação, inclusive ao voltar no
// histórico. A busca do cabeçalho é a única entrada de texto do catálogo.
// ---------------------------------------------
export function TelaDeProdutos({ cliente }: PropsDaTela) {
  const [parametros, setParametros] = useSearchParams();
  const filtro = filtroDaUrl(parametros);
  const { categorias } = useCategorias(cliente);
  const { produtos, carregando, erro, recarregar } = useProdutos(
    cliente,
    filtro,
  );
  const topoDaLista = useRef<HTMLDivElement>(null);
  const categoria = categorias.find((item) => item.id === filtro.categoria);
  const temFiltro =
    filtro.categoria !== null ||
    Boolean(filtro.busca) ||
    filtro.ordenarPor !== null;
  const ordenacao = filtro.ordenarPor
    ? `${filtro.ordenarPor}-${filtro.direcao}`
    : '';
  const totalDePaginas = produtos
    ? Math.max(1, Math.ceil(produtos.total / produtos.limite))
    : 1;
  const filtrosAplicados = [
    filtro.categoria !== null
      ? `categoria: ${categoria?.nome ?? filtro.categoria}`
      : '',
    filtro.busca ? `busca: “${filtro.busca}”` : '',
    filtro.ordenarPor
      ? `ordenação: ${ORDENACOES.find((item) => item.valor === ordenacao)?.rotulo ?? 'Nome (Z-A)'}`
      : '',
  ]
    .filter(Boolean)
    .join('; ');

  function limparFiltros() {
    setParametros(
      urlDoFiltro({
        categoria: null,
        busca: '',
        pagina: 1,
        ordenarPor: null,
        direcao: 'asc',
      }),
    );
  }

  function mudarPagina(pagina: number) {
    setParametros(urlDoFiltro({ ...filtro, pagina }));
    window.scrollTo({
      top:
        (topoDaLista.current?.getBoundingClientRect().top ?? 0) +
        window.scrollY,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <CabecalhoDaPagina
        trilha={[
          { rotulo: 'Início', para: '/' },
          { rotulo: 'Produtos', para: '/produtos' },
          ...(categoria ? [{ rotulo: categoria.nome }] : []),
        ]}
        titulo={categoria?.nome ?? 'Produtos'}
      />
      {filtro.busca ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-card border border-borda bg-superficie py-1 pl-4 pr-1">
          <p className="min-w-0 flex-1 text-lg text-tinta break-words">
            Resultados para “{filtro.busca}”
          </p>
          <Botao
            type="button"
            variante="fantasma"
            onClick={() => {
              const novos = new URLSearchParams(parametros);
              novos.delete('busca');
              novos.delete('pagina');
              setParametros(novos);
            }}
          >
            Remover busca
          </Botao>
        </div>
      ) : null}
      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:gap-10">
        <FiltroDeProdutosView
          categorias={categorias}
          filtro={filtro}
          aoMudar={(novo) => setParametros(urlDoFiltro(novo))}
        />
        <div ref={topoDaLista} className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-5">
            <p aria-live="polite" className="pb-3 text-lg font-medium text-tinta">
              {carregando
                ? 'Carregando…'
                : erro
                  ? 'Contagem indisponível'
                  : `${produtos?.total ?? 0} ${(produtos?.total ?? 0) === 1 ? 'produto' : 'produtos'}`}
            </p>
            <Selecao
              rotulo="Ordenar por"
              value={ordenacao}
              className="min-w-44 focus-visible:outline-acento"
              onChange={(evento) => {
                const escolha = ORDENACOES.find(
                  (item) => item.valor === evento.target.value,
                );
                if (!escolha) return;
                setParametros(
                  urlDoFiltro({
                    ...filtro,
                    ordenarPor: escolha.ordenarPor,
                    direcao: escolha.direcao,
                    pagina: 1,
                  }),
                );
              }}
            >
              {ORDENACOES.map((item) => (
                <option key={item.valor} value={item.valor}>
                  {item.rotulo}
                </option>
              ))}
              {ordenacao === 'nome-desc' ? (
                <option value="nome-desc">Nome (Z-A)</option>
              ) : null}
            </Selecao>
          </div>
          {erro ? (
            <div className="flex flex-col items-start gap-4 py-8">
              <Aviso tipo="erro">{erro}</Aviso>
              <Botao onClick={recarregar}>Tentar novamente</Botao>
            </div>
          ) : carregando ? (
            <div role="status" aria-label="Carregando produtos">
              <GradeDeProdutos produtos={[]} carregando />
            </div>
          ) : produtos?.dados.length === 0 ? (
            <Cartao className="flex flex-col items-start gap-4 text-lg text-tinta-media">
              <p className="max-w-full break-words">
                {temFiltro
                  ? `Nenhum produto encontrado com ${filtrosAplicados}.`
                  : 'Nenhum produto cadastrado ainda.'}
              </p>
              {temFiltro ? (
                <Botao variante="secundario" onClick={limparFiltros}>
                  Limpar filtros
                </Botao>
              ) : null}
            </Cartao>
          ) : (
            <GradeDeProdutos produtos={produtos?.dados ?? []} />
          )}
          {!erro && !carregando && produtos ? (
            <Paginacao
              pagina={produtos.pagina}
              totalDePaginas={totalDePaginas}
              aoMudar={mudarPagina}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
