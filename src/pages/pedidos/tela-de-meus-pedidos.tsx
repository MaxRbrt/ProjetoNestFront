import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import type { Pedido } from '../../api/pedidos';
import { useMeusPedidos } from '../../hooks/use-meus-pedidos';
import { CabecalhoDaPagina } from '../../layout/cabecalho-da-pagina';
import { Paginacao } from '../produtos/paginacao';
import {
  Aviso,
  Botao,
  Cartao,
  Esqueleto,
  EtiquetaDeSituacao,
  classesDeBotao,
} from '../../ui/indice';
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
// Ao trocar de página, a lista da página anterior fica visível
// (aria-busy) em vez de sumir — sem isso o usuário veria a lista piscar
// para o texto de carregamento a cada clique de paginação.
// ---------------------------------------------
export function TelaDeMeusPedidos({ cliente }: PropsDaTela) {
  const [pagina, setPagina] = useState(1);
  const { pedidos, carregando, erro, recarregar } = useMeusPedidos(
    cliente,
    pagina,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <CabecalhoDaPagina
        trilha={[{ rotulo: 'Início', para: '/' }, { rotulo: 'Meus pedidos' }]}
        titulo="Meus pedidos"
        descricao="Acompanhe a situação e consulte os detalhes de cada compra."
      />

      {erro ? (
        <div className="mt-8">
          <Aviso tipo="erro">{erro}</Aviso>
          <Botao
            type="button"
            variante="secundario"
            className="mt-4"
            carregando={carregando}
            onClick={recarregar}
          >
            Tentar novamente
          </Botao>
        </div>
      ) : null}

      {!erro && carregando && !pedidos ? (
        <div role="status" className="mt-8 flex flex-col gap-4 text-tinta-media">
          <p>Carregando pedidos…</p>
          <Esqueleto className="h-36 w-full" />
          <Esqueleto className="h-36 w-full" />
        </div>
      ) : null}

      {!erro && !carregando && pedidos && pedidos.dados.length === 0 ? (
        <Cartao como="section" className="mt-8">
          <h2 className="text-xl font-bold text-tinta">
            {pedidos.total === 0
              ? 'Você ainda não fez nenhum pedido.'
              : 'Nenhum pedido nesta página.'}
          </h2>
          <p className="mt-3 text-lg text-tinta-media">
            {pedidos.total === 0
              ? 'Após a compra, você poderá acompanhar seu pedido aqui.'
              : 'Volte à primeira página para consultar seus pedidos.'}
          </p>
          {pedidos.total === 0 ? (
            <Link
              to="/produtos"
              className={classesDeBotao({ className: 'mt-6' })}
            >
              Voltar ao catálogo
            </Link>
          ) : (
            <Botao type="button" className="mt-6" onClick={() => setPagina(1)}>
              Voltar à primeira página
            </Botao>
          )}
        </Cartao>
      ) : null}

      {!erro && pedidos && pedidos.dados.length > 0 ? (
        <ul aria-busy={carregando} className="mt-8 flex flex-col gap-4">
          {pedidos.dados.map((pedido) => (
            <CartaoDePedido key={pedido.id} pedido={pedido} />
          ))}
        </ul>
      ) : null}

      {!erro && pedidos ? (
        <Paginacao
          rotulo="Paginação de pedidos"
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
    <Cartao
      como="li"
      className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-xl font-bold text-tinta">
          Pedido #{pedido.id}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-base text-tinta-media">Realizado em</dt>
            <dd className="mt-1 text-lg text-tinta">
              <time dateTime={pedido.criadoEm}>
                {FORMATADOR_DE_DATA.format(new Date(pedido.criadoEm))}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-base text-tinta-media">Situação</dt>
            <dd className="mt-1">
              <EtiquetaDeSituacao
                situacao={pedido.situacao}
                rotulo={ROTULO_DA_SITUACAO[pedido.situacao] ?? pedido.situacao}
              />
            </dd>
          </div>
          <div>
            <dt className="text-base text-tinta-media">Total</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-tinta">
              {formatarCentavos(pedido.totalEmCentavos)}
            </dd>
          </div>
        </dl>
      </div>
      <Link
        to={`/pedidos/${pedido.id}`}
        aria-label={`Ver detalhes do pedido #${pedido.id}`}
        className={classesDeBotao({
          variante: 'secundario',
          className: 'w-full shrink-0 md:w-auto',
        })}
      >
        Ver detalhes
      </Link>
    </Cartao>
  );
}
