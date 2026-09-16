const BENEFICIOS = [
  {
    titulo: 'Entrega por região',
    texto: 'Consulte prazo e valor do frete para seu endereço no checkout.',
    desenho:
      'M3 6h11v11H3z M14 10h4l3 4v3h-7 M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  },
  {
    titulo: 'Pagamento simulado',
    texto: 'Experimente o fluxo de compra sem cobrança real.',
    desenho: 'M3 5h18v14H3z M3 9h18 M7 15h4',
  },
  {
    titulo: 'Acompanhe seu pedido',
    texto: 'Veja a situação e os detalhes da compra na sua conta.',
    desenho: 'M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4',
  },
];

// ---------------------------------------------
// Recursos disponíveis
// Descreve apenas capacidades implementadas, sem garantias comerciais ou
// promessas de prazo que o catálogo não pode sustentar.
// ---------------------------------------------
export function Beneficios() {
  return (
    <section
      aria-label="Como funciona a loja"
      className="grid gap-6 rounded-grande border border-borda bg-superficie p-6 md:grid-cols-3 lg:p-8"
    >
      {BENEFICIOS.map((item) => (
        <div key={item.titulo} className="flex items-start gap-4">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 shrink-0 text-marca"
          >
            <path d={item.desenho} />
          </svg>
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="text-base font-semibold text-tinta">
              {item.titulo}
            </h2>
            <p className="text-base leading-relaxed text-tinta-media">
              {item.texto}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
