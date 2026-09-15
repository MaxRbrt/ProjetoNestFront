import type { Produto } from '../api/produtos';
import { Esqueleto } from '../ui/indice';
import { CartaoDeProduto } from './cartao-de-produto';

interface PropsDaGrade {
  produtos: Produto[];
  carregando?: boolean;
  quantidadeDeEsqueletos?: number;
}

const QUANTIDADE_DE_ESQUELETOS_PADRAO = 10;

// ---------------------------------------------
// Grade de vitrine
// Duas colunas já no menor telefone dá densidade de loja; uma coluna por
// tela parece lista de administração. Durante o carregamento, o esqueleto
// repete a mesma moldura (aspect-square, padding, borda) do cartão real para
// que a grade não salte de altura quando os dados chegam. O corpo do
// esqueleto também espelha a altura do corpo real, linha por linha, porque
// o line-height por si só não bate: nome `min-h-[2.5rem]` + `mb-1` (0,25rem)
// + gap (0,25rem) + preço `text-base` (1,5rem de line-height) + gap
// (0,25rem) + estoque `text-xs` (1rem) somam 5,75rem no cartão real; um bloco
// de barras genéricas com gap uniforme fica mais baixo e a grade salta 24px
// quando os dados chegam. Lista vazia sem carregar não renderiza nada — o
// estado vazio é responsabilidade da tela.
// ---------------------------------------------
export function GradeDeProdutos({
  produtos,
  carregando = false,
  quantidadeDeEsqueletos = QUANTIDADE_DE_ESQUELETOS_PADRAO,
}: PropsDaGrade) {
  if (carregando) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: quantidadeDeEsqueletos }).map((_, indice) => (
          <div
            key={indice}
            className="flex h-full flex-col overflow-hidden rounded-card border border-borda bg-superficie shadow-carta"
          >
            <div className="aspect-square p-4">
              <Esqueleto className="h-full w-full" />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <div className="mb-1 flex min-h-[2.5rem] flex-col justify-center gap-1.5">
                <Esqueleto className="h-3.5 w-full" />
                <Esqueleto className="h-3.5 w-2/3" />
              </div>
              <Esqueleto className="h-6 w-1/3" />
              <Esqueleto className="h-4 w-1/4" />
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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {produtos.map((produto) => (
        <CartaoDeProduto key={produto.id} produto={produto} />
      ))}
    </div>
  );
}
