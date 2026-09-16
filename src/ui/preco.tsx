import { formatarCentavos } from '../utils/dinheiro';

const TAMANHOS = {
  pequeno: 'text-lg',
  medio: 'text-2xl',
  grande: 'text-3xl',
} as const;

interface PropsDoPreco {
  centavos: number;
  tamanho?: keyof typeof TAMANHOS;
}

// ---------------------------------------------
// Preço
// tabular-nums mantém a largura dos dígitos constante: sem isso, preços
// alinhados numa grade dançam horizontalmente entre cartões vizinhos.
// ---------------------------------------------
export function Preco({ centavos, tamanho = 'medio' }: PropsDoPreco) {
  return (
    <span
      className={`font-bold tabular-nums text-tinta ${TAMANHOS[tamanho]}`}
    >
      {formatarCentavos(centavos)}
    </span>
  );
}
