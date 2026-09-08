import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ApiError, type ApiClient } from '../../api/cliente';
import {
  listarPedidos,
  type Pedido,
  type SituacaoDoPedido,
} from '../../api/pedidos';
import type { Paginado } from '../../api/produtos';
import { Aviso, Botao } from '../../components/primitivos';
import { Paginacao } from '../products/paginacao';
import './tela-de-produtos-admin.css';
import './tela-de-pedidos-admin.css';

const SITUACOES: Record<SituacaoDoPedido, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
};
const FORMATADOR_DE_PRECO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
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
    valor === 'PENDENTE' || valor === 'PAGO' || valor === 'CANCELADO'
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
    <section className="admin-pedidos">
      <div className="admin-pedidos__cabecalho">
        <div>
          <h1>Pedidos</h1>
          <p>Acompanhe os pedidos e registre pagamentos ou cancelamentos.</p>
        </div>
        <div className="admin-pedidos__filtro">
          <label htmlFor="situacao-dos-pedidos">Situação</label>
          <select
            id="situacao-dos-pedidos"
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
          </select>
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

  if (carregando) return <p role="status">Carregando pedidos…</p>;
  if (erro)
    return (
      <>
        <Aviso>{erro}</Aviso>
        <Botao
          variante="secundario"
          onClick={() => {
            setCarregando(true);
            setErro(null);
            setTentativa((atual) => atual + 1);
          }}
        >
          Tentar novamente
        </Botao>
      </>
    );
  if (!pedidos) return null;
  if (pedidos.dados.length === 0)
    return (
      <>
        <p>
          {situacao
            ? 'Nenhum pedido encontrado nesta situação.'
            : 'Nenhum pedido encontrado.'}
        </p>
        {pagina > 1 ? (
          <Botao variante="secundario" onClick={() => aoMudarPagina(1)}>
            Voltar à primeira página
          </Botao>
        ) : null}
      </>
    );

  return (
    <>
      <p className="admin-pedidos__contagem" role="status">
        {pedidos.total}{' '}
        {pedidos.total === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
      </p>
      <div
        className="admin-pedidos__rolagem"
        role="region"
        aria-label="Lista de pedidos"
        tabIndex={0}
      >
        <table className="admin-tabela">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Data</th>
              <th scope="col">Total</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.dados.map((pedido) => (
              <tr key={pedido.id}>
                <td>
                  <Link
                    to={`/admin/pedidos/${pedido.id}${consulta ? `?${consulta}` : ''}`}
                  >
                    #{pedido.id}
                  </Link>
                </td>
                <td>{FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))}</td>
                <td>{FORMATADOR_DE_PRECO.format(pedido.total)}</td>
                <td>
                  <span
                    className={`admin-pedidos__situacao admin-pedidos__situacao--${pedido.situacao.toLowerCase()}`}
                  >
                    {SITUACOES[pedido.situacao]}
                  </span>
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
