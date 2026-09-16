import { formatarCentavos } from '../../utils/dinheiro';
import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ApiError, type ApiClient } from '../../api/cliente';
import {
  listarPedidos,
  type Pedido,
  type SituacaoDoPedido,
} from '../../api/pedidos';
import type { Paginado } from '../../api/produtos';
import { Aviso, Botao, EtiquetaDeSituacao, Selecao } from '../../ui/indice';
import { Paginacao } from '../produtos/paginacao';

const SITUACOES: Record<SituacaoDoPedido, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
};
const FORMATADOR_DE_DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

// ---------------------------------------------
// Listagem administrativa com filtros na URL
// A consulta compartilhável é a única fonte da página e situação. Alterar
// o filtro reinicia a página; a chave remonta apenas os resultados para não
// exibir linhas antigas sob um filtro novo. A API aplica o papel da sessão.
// ---------------------------------------------
export function TelaDePedidosAdmin({ cliente }: { cliente: ApiClient }) {
  const [consulta, setConsulta] = useSearchParams();
  const valor = consulta.get('situacao');
  const situacao =
    valor === 'PENDENTE' ||
    valor === 'PAGO' ||
    valor === 'CANCELADO' ||
    valor === 'ENVIADO' ||
    valor === 'ENTREGUE'
      ? valor
      : undefined;
  const numero = Number(consulta.get('pagina') ?? 1);
  const pagina =
    Number.isInteger(numero) && numero >= 1 && numero <= 10000 ? numero : 1;
  const normalizada = new URLSearchParams(consulta);
  if (valor !== null && !situacao) normalizada.delete('situacao');
  if (consulta.has('pagina') && consulta.get('pagina') !== String(pagina))
    normalizada.set('pagina', String(pagina));
  if (consulta.getAll('situacao').length > 1 && situacao)
    normalizada.set('situacao', situacao);
  if (consulta.getAll('pagina').length > 1)
    normalizada.set('pagina', String(pagina));

  if (normalizada.toString() !== consulta.toString()) {
    return (
      <Navigate
        to={{ pathname: '/admin/pedidos', search: normalizada.toString() }}
        replace
      />
    );
  }

  function mudarPagina(proxima: number) {
    const nova = new URLSearchParams(consulta);
    nova.set('pagina', String(proxima));
    setConsulta(nova);
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance text-2xl font-bold text-tinta">Pedidos</h1>
          <p className="mt-1 text-sm text-tinta-media">
            Acompanhe os pedidos e registre pagamentos ou cancelamentos.
          </p>
        </div>
        <div className="w-48">
          <Selecao
            rotulo="Situação"
            value={situacao ?? ''}
            onChange={(evento) => {
              const nova = new URLSearchParams(consulta);
              if (evento.target.value)
                nova.set('situacao', evento.target.value);
              else nova.delete('situacao');
              nova.set('pagina', '1');
              setConsulta(nova);
            }}
          >
            <option value="">Todas</option>
            {Object.entries(SITUACOES).map(([chave, rotulo]) => (
              <option key={chave} value={chave}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        </div>
      </div>
      <ListaDePedidos
        key={`${pagina}:${situacao ?? ''}`}
        cliente={cliente}
        pagina={pagina}
        situacao={situacao}
        consulta={consulta.toString()}
        aoMudarPagina={mudarPagina}
      />
    </section>
  );
}

// ---------------------------------------------
// Resultados de uma única consulta
// Cleanup cancela a leitura e descarta sua resposta mesmo se o transporte
// ignorar AbortSignal. Erro e vazio são distintos, com recuperação explícita.
// Página vazia oferece retorno mesmo se o total diminuiu em outra sessão.
// ---------------------------------------------
function ListaDePedidos({
  cliente,
  pagina,
  situacao,
  consulta,
  aoMudarPagina,
}: {
  cliente: ApiClient;
  pagina: number;
  situacao?: SituacaoDoPedido;
  consulta: string;
  aoMudarPagina: (pagina: number) => void;
}) {
  const [pedidos, setPedidos] = useState<Paginado<Pedido> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;
    listarPedidos(cliente, pagina, controlador.signal, situacao)
      .then((resultado) => {
        if (cancelado) return;
        setPedidos(resultado);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        if (cancelado) return;
        setErro(
          falha instanceof ApiError
            ? falha.message
            : 'Não foi possível carregar os pedidos.',
        );
        setCarregando(false);
      });
    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, pagina, situacao, tentativa]);

  if (carregando)
    return (
      <p role="status" className="mt-6 text-sm text-tinta-media">
        Carregando pedidos…
      </p>
    );
  if (erro)
    return (
      <div className="mt-6 flex flex-col items-start gap-3">
        <Aviso>{erro}</Aviso>
        <Botao
          variante="secundario"
          tamanho="pequeno"
          onClick={() => {
            setCarregando(true);
            setErro(null);
            setTentativa((atual) => atual + 1);
          }}
        >
          Tentar novamente
        </Botao>
      </div>
    );
  if (!pedidos) return null;
  if (pedidos.dados.length === 0)
    return (
      <div className="mt-6 flex flex-col items-start gap-3">
        <p className="text-sm text-tinta-media">
          {situacao
            ? 'Nenhum pedido encontrado nesta situação.'
            : 'Nenhum pedido encontrado.'}
        </p>
        {pagina > 1 ? (
          <Botao
            variante="secundario"
            tamanho="pequeno"
            onClick={() => aoMudarPagina(1)}
          >
            Voltar à primeira página
          </Botao>
        ) : null}
      </div>
    );

  return (
    <>
      <p className="mt-6 text-sm text-tinta-media" role="status">
        {pedidos.total}{' '}
        {pedidos.total === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
      </p>
      <div
        className="mt-3 overflow-x-auto rounded-card border border-borda"
        role="region"
        aria-label="Lista de pedidos"
        tabIndex={0}
      >
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 bg-superficie">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Pedido
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Data
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Total
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {pedidos.dados.map((pedido) => (
              <tr key={pedido.id} className="odd:bg-superficie-sutil">
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/pedidos/${pedido.id}${consulta ? `?${consulta}` : ''}`}
                    className="font-medium text-acento-escuro hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
                  >
                    #{pedido.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-tinta">
                  {FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-tinta">
                  {formatarCentavos(pedido.totalEmCentavos)}
                </td>
                <td className="px-4 py-3">
                  <EtiquetaDeSituacao
                    situacao={pedido.situacao}
                    rotulo={SITUACOES[pedido.situacao]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacao
        pagina={pagina}
        totalDePaginas={Math.min(
          10000,
          Math.ceil(pedidos.total / pedidos.limite),
        )}
        aoMudar={aoMudarPagina}
        rotulo="Paginação de pedidos"
      />
    </>
  );
}
