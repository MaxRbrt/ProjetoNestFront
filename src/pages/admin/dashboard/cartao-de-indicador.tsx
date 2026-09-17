import { useId } from 'react';
import { Cartao } from '../../../ui/indice';
import type { SentidoDaVariacao, Variacao } from '../../../utils/variacao';

interface PropsDoIndicador {
  titulo: string;
  valor: string;
  variacao: Variacao;
  altaEhBoa?: boolean;
}

const SETAS: Record<SentidoDaVariacao, string> = {
  alta: '↑',
  baixa: '↓',
  igual: '→',
  'sem-base': '',
};

// ---------------------------------------------
// Cartão de indicador
// Número grande, rótulo e a frase de variação. A seta é decorativa e a cor
// só reforça o que a frase já diz; altaEhBoa inverte o tom para métricas em
// que subir é ruim (pagamentos recusados). O cartão é um grupo nomeado pelo
// título para o leitor de tela anunciar número e variação juntos.
// ---------------------------------------------
export function CartaoDeIndicador({
  titulo,
  valor,
  variacao,
  altaEhBoa = true,
}: PropsDoIndicador) {
  const idDoTitulo = useId();
  const positiva =
    variacao.sentido === 'alta' ? altaEhBoa : variacao.sentido === 'baixa' ? !altaEhBoa : null;
  const tom =
    positiva === null
      ? 'text-tinta-media'
      : positiva
        ? 'text-sucesso'
        : 'text-erro';

  return (
    <Cartao
      role="group"
      aria-labelledby={idDoTitulo}
      className="flex flex-col gap-2"
    >
      <h2 id={idDoTitulo} className="text-base font-semibold text-tinta-media">
        {titulo}
      </h2>
      <p className="text-3xl font-bold tabular-nums tracking-tight text-tinta">
        {valor}
      </p>
      <p className={`flex items-start gap-1.5 text-base font-medium ${tom}`}>
        {SETAS[variacao.sentido] ? (
          <span aria-hidden="true">{SETAS[variacao.sentido]}</span>
        ) : null}
        <span>{variacao.texto}</span>
      </p>
    </Cartao>
  );
}
