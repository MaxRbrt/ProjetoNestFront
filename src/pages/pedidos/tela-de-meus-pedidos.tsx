import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import type { Pedido } from '../../api/pedidos';
import { useMeusPedidos } from '../../hooks/use-meus-pedidos';
import { Paginacao } from '../products/paginacao';
import { Aviso, EtiquetaDeSituacao } from '../../ui/indice';
import { formatarCentavos } from '../../utils/dinheiro';

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
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
};

// ---------------------------------------------
// Listagem de pedidos do cliente
// Ao trocar de página, a lista da página anterior fica visível e esmaecida
// (aria-busy) em vez de sumir — sem isso o usuário veria a lista piscar
// para o texto de carregamento a cada clique de paginação.
// ---------------------------------------------
export function TelaDeMeusPedidos({ cliente }: PropsDaTela) {
  const [pagina, setPagina] = useState(1);
  const { pedidos, carregando, erro } = useMeusPedidos(cliente, pagina);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
        Meus pedidos
      </h1>

      {erro ? (
        <div className="mt-6">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      ) : null}

      {!erro && carregando && !pedidos ? (
        <p role="status" className="mt-6 text-tinta-media">
          Carregando pedidos…
        </p>
      ) : null}

      {!erro && !carregando && pedidos && pedidos.dados.length === 0 ? (
        <p className="mt-6 text-tinta-media">
          Você ainda não fez nenhum pedido.{' '}
          <Link to="/produtos" className="font-semibold text-acento underline">
            Ver produtos
          </Link>
        </p>
      ) : null}

      {!erro && pedidos && pedidos.dados.length > 0 ? (
        <ul
          aria-busy={carregando}
          className={`mt-6 flex flex-col gap-3 ${carregando ? 'opacity-60' : ''}`}
        >
          {pedidos.dados.map((pedido) => (
            <CartaoDePedido key={pedido.id} pedido={pedido} />
          ))}
        </ul>
      ) : null}

      {pedidos ? (
        <Paginacao
          pagina={pedidos.pagina}
          totalDePaginas={Math.ceil(pedidos.total / pedidos.limite) || 1}
          aoMudar={setPagina}
        />
      ) : null}
    </div>
  );
}

interface PropsDoCartao {
  pedido: Pedido;
}

function CartaoDePedido({ pedido }: PropsDoCartao) {
  return (
    <li>
      <Link
        to={`/pedidos/${pedido.id}`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-borda bg-superficie p-4 shadow-carta hover:border-borda-forte"
      >
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-tinta">#{pedido.id}</span>
          <span className="text-sm text-tinta-media">
            {FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-tinta">
            {formatarCentavos(pedido.totalEmCentavos)}
          </span>
          <EtiquetaDeSituacao
            situacao={pedido.situacao}
            rotulo={ROTULO_DA_SITUACAO[pedido.situacao] ?? pedido.situacao}
          />
        </div>
      </Link>
    </li>
  );
}
