import { formatarCentavos } from '../../utils/dinheiro';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { useMeusPedidos } from '../../hooks/use-meus-pedidos';
import { Cabecalho } from '../../components/cabecalho';
import { NavPrincipal } from '../../components/nav-principal';
import { Aviso } from '../../components/primitivos';
import { Paginacao } from '../products/paginacao';
import './tela-de-meus-pedidos.css';

interface PropsDaTela {
  cliente: ApiClient;
}

const FORMATADOR_DE_DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const ROTULO_DA_SITUACAO: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
};

// ---------------------------------------------
// Listagem de pedidos do cliente
// Ao trocar de página, a tabela da página anterior fica visível e
// esmaecida (aria-busy) em vez de sumir — sem isso o usuário veria a lista
// piscar para o texto de carregamento a cada clique de paginação.
// ---------------------------------------------
export function TelaDeMeusPedidos({ cliente }: PropsDaTela) {
  const [pagina, setPagina] = useState(1);
  const { pedidos, carregando, erro } = useMeusPedidos(cliente, pagina);

  return (
    <>
      <Cabecalho links={<NavPrincipal />} />

      <main className="tela-meus-pedidos">
        <h1>Meus pedidos</h1>

        {erro ? <Aviso>{erro}</Aviso> : null}

        {!erro && carregando && !pedidos ? (
          <p role="status">Carregando pedidos…</p>
        ) : null}

        {!erro && !carregando && pedidos && pedidos.dados.length === 0 ? (
          <p>
            Você ainda não fez nenhum pedido.{' '}
            <Link to="/produtos">Ver produtos</Link>
          </p>
        ) : null}

        {!erro && pedidos && pedidos.dados.length > 0 ? (
          <table
            className="tela-meus-pedidos__tabela"
            aria-busy={carregando}>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Total</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.dados.map((pedido) => (
                <tr key={pedido.id}>
                  <td>
                    <Link to={`/pedidos/${pedido.id}`}>#{pedido.id}</Link>
                  </td>
                  <td>{FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))}</td>
                  <td>{formatarCentavos(pedido.totalEmCentavos)}</td>
                  <td>{ROTULO_DA_SITUACAO[pedido.situacao] ?? pedido.situacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {pedidos ? (
          <Paginacao
            pagina={pedidos.pagina}
            totalDePaginas={Math.ceil(pedidos.total / pedidos.limite) || 1}
            aoMudar={setPagina}
          />
        ) : null}
      </main>
    </>
  );
}
