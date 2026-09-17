import { PERIODOS_DO_PAINEL, type PeriodoDoPainel } from '../../../api/metricas';

interface PropsDoSeletor {
  periodo: PeriodoDoPainel;
  aoMudar: (periodo: PeriodoDoPainel) => void;
}

// ---------------------------------------------
// Seletor de período
// Quatro botões com texto e aria-pressed, em vez de um select: o período
// atual fica visível sem abrir nada, e cada opção é um alvo grande. O
// selecionado muda fundo e peso da fonte, não só a cor.
// ---------------------------------------------
export function SeletorDePeriodo({ periodo, aoMudar }: PropsDoSeletor) {
  return (
    <div
      role="group"
      aria-label="Período dos indicadores"
      className="inline-flex flex-wrap gap-1 rounded-card border border-borda bg-superficie p-1 shadow-carta"
    >
      {PERIODOS_DO_PAINEL.map(({ valor, rotulo }) => {
        const selecionado = valor === periodo;
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={selecionado}
            onClick={() => aoMudar(valor)}
            className={`min-h-12 rounded-pequeno px-4 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca ${
              selecionado
                ? 'bg-marca font-semibold text-white'
                : 'font-medium text-tinta-media hover:bg-superficie-sutil hover:text-tinta'
            }`}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}
