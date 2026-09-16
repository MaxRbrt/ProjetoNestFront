import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import { listarProdutos } from '../api/produtos';
import type { Produto } from '../api/produtos';
import { GradeDeProdutos } from './grade-de-produtos';

interface PropsDeRelacionados {
  cliente: ApiClient;
  categoriaId: number;
  produtoAtualId: number;
}

const LIMITE_DE_BUSCA = 6;
const LIMITE_EXIBIDO = 4;

// ---------------------------------------------
// Relacionados por categoria
// O critério é literal — mesma categoria, ordem do backend — por isso o
// título fala "Da mesma categoria" em vez de sugerir uma recomendação
// personalizada que este catálogo não calcula. Busca 6 para sobrar margem
// depois de remover o próprio produto e corta em 4 — uma linha cheia da
// grade em largura total; se não sobrar nenhum
// (categoria com um produto só) ou a leitura falhar, a seção inteira some —
// nenhuma vitrine secundária vazia ou quebrada tem valor para quem só quer
// comprar o produto principal.
// ---------------------------------------------
export function Relacionados({
  cliente,
  categoriaId,
  produtoAtualId,
}: PropsDeRelacionados) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;
    setCarregando(true);
    setErro(false);

    listarProdutos(
      cliente,
      {
        categoria: categoriaId,
        busca: '',
        pagina: 1,
        ordenarPor: null,
        direcao: 'asc',
        limite: LIMITE_DE_BUSCA,
      },
      controlador.signal,
    )
      .then((pagina) => {
        if (cancelado) return;
        setProdutos(
          pagina.dados
            .filter((produto) => produto.id !== produtoAtualId)
            .slice(0, LIMITE_EXIBIDO),
        );
        setCarregando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErro(true);
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, categoriaId, produtoAtualId]);

  if (erro || (!carregando && produtos.length === 0)) {
    return null;
  }

  return (
    <section aria-labelledby="relacionados-titulo" className="mt-14 border-t border-borda pt-10">
      <h2
        id="relacionados-titulo"
        className="mb-5 text-xl font-bold tracking-tight text-tinta sm:text-2xl"
      >
        Da mesma categoria
      </h2>
      <GradeDeProdutos
        produtos={produtos}
        carregando={carregando}
        quantidadeDeEsqueletos={LIMITE_EXIBIDO}
        largura="total"
      />
    </section>
  );
}
