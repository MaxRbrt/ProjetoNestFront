import type { Produto } from '../api/produtos';
import { Esqueleto } from '../ui/indice';
import { CartaoDeProduto } from './cartao-de-produto';

interface PropsDaGrade {
  produtos: Produto[];
  carregando?: boolean;
  quantidadeDeEsqueletos?: number;
  largura?: 'com-lateral' | 'total';
}

const COLUNAS = {
  'com-lateral': 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3',
  total: 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
} as const;

const QUANTIDADE_DE_ESQUELETOS_PADRAO = 10;

// ---------------------------------------------
// Grade de vitrine
// Uma coluna no celular preserva a leitura de nome, preço e ação. A grade
// ganha colunas conforme há espaço — uma a mais quando não divide a largura
// com a lateral de filtros; o carregamento usa a mesma moldura.
// O estado vazio é responsabilidade da tela.
// ---------------------------------------------
export function GradeDeProdutos({
  produtos,
  carregando = false,
  quantidadeDeEsqueletos = QUANTIDADE_DE_ESQUELETOS_PADRAO,
  largura = 'com-lateral',
}: PropsDaGrade) {
  if (carregando) {
    return (
      <div className={COLUNAS[largura]}>
        {Array.from({ length: quantidadeDeEsqueletos }).map((_, indice) => (
          <div
            key={indice}
            className="flex h-full flex-col overflow-hidden rounded-card border border-borda bg-superficie shadow-carta"
          >
            <div className="aspect-[4/3] p-4 sm:aspect-square">
              <Esqueleto className="h-full w-full" />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="mb-1 flex min-h-[2.5rem] flex-col justify-center gap-1.5">
                <Esqueleto className="h-3.5 w-full" />
                <Esqueleto className="h-3.5 w-2/3" />
              </div>
              <Esqueleto className="h-6 w-1/3" />
              <Esqueleto className="h-6 w-1/4" />
              <Esqueleto className="mt-auto h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (produtos.length === 0) {
    return null;
  }

  return (
    <div className={COLUNAS[largura]}>
      {produtos.map((produto) => (
        <CartaoDeProduto key={produto.id} produto={produto} />
      ))}
    </div>
  );
}
