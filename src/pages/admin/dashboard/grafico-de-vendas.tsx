import { useEffect, useRef, useState } from 'react';
import type { VendasDoDia } from '../../../api/metricas';
import { formatarCentavos } from '../../../utils/dinheiro';

interface PropsDoGrafico {
  vendas: VendasDoDia[];
}

const ALTURA = 280;
const MARGEM = { topo: 28, direita: 8, base: 36, esquerda: 84 };
const LARGURA_MAXIMA_DA_BARRA = 24;
const VAO_ENTRE_BARRAS = 2;
const LARGURA_MINIMA_DA_FATIA = 6;
const LARGURA_PADRAO = 720;
const LARGURA_DE_UM_ROTULO = 56;

const REAIS_COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function diaCurto(dia: string): string {
  const [, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes}`;
}

// Teto "redondo" do eixo: 1, 2 ou 5 vezes uma potência de 10, dividido em
// quatro faixas iguais.
function tetoDoEixo(maximo: number): number {
  if (maximo <= 0) return 1;
  const quarto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(quarto));
  const passo =
    [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= quarto) ??
    10 * potencia;
  return passo * 4;
}

function useLarguraDoElemento<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(LARGURA_PADRAO);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setLargura(Math.floor(entrada.contentRect.width));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return { ref, largura };
}

// ---------------------------------------------
// Gráfico de faturamento por dia
// SVG próprio, sem biblioteca (o node_modules do frontend vive num volume do
// Docker; dependência nova quebra o container). O desenho usa a largura real
// do contêiner em pixels, então o texto dos eixos não encolhe no celular;
// em 90 dias, se as barras não couberem, a área rola dentro do cartão.
// Série única: sem legenda, barras em marca-clara, hoje em acento com o
// rótulo "Hoje" no eixo (cor nunca sozinha). Só o maior valor recebe rótulo;
// os demais ficam na dica ao passar o mouse e na tabela equivalente.
// ---------------------------------------------
export function GraficoDeVendas({ vendas }: PropsDoGrafico) {
  const { ref, largura } = useLarguraDoElemento<HTMLDivElement>();
  const [destacado, setDestacado] = useState<number | null>(null);

  const quantidade = vendas.length;
  const larguraDoPlot = Math.max(
    largura - MARGEM.esquerda - MARGEM.direita,
    quantidade * LARGURA_MINIMA_DA_FATIA,
  );
  const larguraTotal = larguraDoPlot + MARGEM.esquerda + MARGEM.direita;
  const alturaDoPlot = ALTURA - MARGEM.topo - MARGEM.base;
  const fatia = larguraDoPlot / quantidade;
  const larguraDaBarra = Math.max(
    Math.min(LARGURA_MAXIMA_DA_BARRA, fatia - VAO_ENTRE_BARRAS),
    1,
  );

  const maiorValor = Math.max(...vendas.map((v) => v.faturamentoEmCentavos));
  const teto = tetoDoEixo(maiorValor);
  const indiceDoMaior = vendas.findIndex(
    (v) => v.faturamentoEmCentavos === maiorValor,
  );
  const ultimo = quantidade - 1;
  const passoDosRotulos = Math.max(
    1,
    Math.ceil((quantidade * LARGURA_DE_UM_ROTULO) / larguraDoPlot),
  );
  const total = vendas.reduce((soma, v) => soma + v.faturamentoEmCentavos, 0);

  const y = (valor: number) =>
    MARGEM.topo + alturaDoPlot - (valor / teto) * alturaDoPlot;
  const xCentro = (indice: number) =>
    MARGEM.esquerda + fatia * indice + fatia / 2;

  const descricao = `Faturamento por dia, de ${diaCurto(vendas[0].dia)} a ${diaCurto(
    vendas[ultimo].dia,
  )}. Total ${formatarCentavos(total)}. Maior venda: ${formatarCentavos(
    maiorValor,
  )} em ${diaCurto(vendas[indiceDoMaior].dia)}.`;

  const itemDestacado = destacado === null ? null : vendas[destacado];

  // Quando o período não cabe e a área rola, começa mostrando o fim (hoje).
  useEffect(() => {
    const elemento = ref.current;
    if (elemento) elemento.scrollLeft = elemento.scrollWidth;
  }, [ref, quantidade, largura]);

  return (
    <div className="flex flex-col gap-4">
      <div ref={ref} className="relative overflow-x-auto">
        <svg
          role="img"
          aria-label={descricao}
          width={larguraTotal}
          height={ALTURA}
          viewBox={`0 0 ${larguraTotal} ${ALTURA}`}
          className="block"
          onMouseLeave={() => setDestacado(null)}
        >
          {[0, 1, 2, 3, 4].map((faixa) => {
            const valor = (teto / 4) * faixa;
            return (
              <g key={faixa}>
                <line
                  x1={MARGEM.esquerda}
                  x2={larguraTotal - MARGEM.direita}
                  y1={y(valor)}
                  y2={y(valor)}
                  stroke="var(--color-borda)"
                  strokeWidth={1}
                />
                <text
                  x={MARGEM.esquerda - 10}
                  y={y(valor)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={16}
                  fill="var(--color-tinta-media)"
                >
                  {REAIS_COMPACTO.format(valor / 100)}
                </text>
              </g>
            );
          })}

          {vendas.map((venda, indice) => {
            const altura = y(0) - y(venda.faturamentoEmCentavos);
            const x = xCentro(indice) - larguraDaBarra / 2;
            const raio = Math.min(4, larguraDaBarra / 2, altura);
            const hoje = indice === ultimo;
            const mostraRotulo =
              indice % passoDosRotulos === 0 || hoje;
            return (
              <g key={venda.dia}>
                {altura > 0 ? (
                  <path
                    d={`M${x},${y(0)} V${y(0) - altura + raio} Q${x},${y(0) - altura} ${x + raio},${y(0) - altura} H${x + larguraDaBarra - raio} Q${x + larguraDaBarra},${y(0) - altura} ${x + larguraDaBarra},${y(0) - altura + raio} V${y(0)} Z`}
                    fill={hoje ? 'var(--color-acento)' : 'var(--color-marca-clara)'}
                    opacity={destacado === null || destacado === indice ? 1 : 0.55}
                  />
                ) : null}
                {indice === indiceDoMaior && maiorValor > 0 ? (
                  <text
                    x={xCentro(indice)}
                    y={y(venda.faturamentoEmCentavos) - 8}
                    textAnchor="middle"
                    fontSize={16}
                    fontWeight={600}
                    fill="var(--color-tinta)"
                  >
                    {REAIS_COMPACTO.format(venda.faturamentoEmCentavos / 100)}
                  </text>
                ) : null}
                {mostraRotulo &&
                (hoje || ultimo - indice >= passoDosRotulos) ? (
                  <text
                    x={xCentro(indice)}
                    y={ALTURA - 10}
                    textAnchor={hoje && quantidade > 1 ? 'end' : 'middle'}
                    fontSize={16}
                    fontWeight={hoje ? 600 : 400}
                    fill={hoje ? 'var(--color-tinta)' : 'var(--color-tinta-media)'}
                  >
                    {hoje ? 'Hoje' : diaCurto(venda.dia)}
                  </text>
                ) : null}
                <rect
                  x={MARGEM.esquerda + fatia * indice}
                  y={MARGEM.topo}
                  width={fatia}
                  height={alturaDoPlot}
                  fill="transparent"
                  onMouseEnter={() => setDestacado(indice)}
                />
              </g>
            );
          })}
        </svg>

        {itemDestacado && destacado !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 rounded-pequeno border border-borda bg-superficie px-3 py-2 text-base shadow-carta-media"
            style={{
              left: Math.min(
                Math.max(xCentro(destacado) - 90, 0),
                larguraTotal - 180,
              ),
              width: 180,
            }}
          >
            <p className="font-semibold text-tinta">
              {destacado === ultimo ? 'Hoje' : diaCurto(itemDestacado.dia)}
            </p>
            <p className="tabular-nums text-tinta">
              {formatarCentavos(itemDestacado.faturamentoEmCentavos)}
            </p>
            <p className="text-tinta-media">
              {itemDestacado.pedidos}{' '}
              {itemDestacado.pedidos === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
        ) : null}
      </div>

      <details className="group">
        <summary className="inline-flex min-h-12 cursor-pointer items-center rounded-pequeno text-base font-semibold text-marca underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca">
          Ver dados em tabela
        </summary>
        <div className="mt-3 max-h-96 overflow-auto rounded-pequeno border border-borda">
          <table className="w-full text-left text-base">
            <thead className="sticky top-0 bg-superficie-sutil">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Dia
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
                  Faturamento
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
                  Pedidos faturados
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {vendas.map((venda) => (
                <tr key={venda.dia}>
                  <td className="px-4 py-2">{diaCurto(venda.dia)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatarCentavos(venda.faturamentoEmCentavos)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {venda.pedidos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
