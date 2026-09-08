import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { filtroDaUrl, urlDoFiltro } from '../../api/produtos';
import { NavPrincipal } from '../../components/nav-principal';
import { Cabecalho } from '../../components/cabecalho';
import { Botao } from '../../components/primitivos';
import { useProdutos } from '../../hooks/use-produtos';
import { listaContainer, listaItem } from '../../motion/tokens';
import { CartaoDeProduto } from './cartao-de-produto';
import { FiltroDeProdutosView } from './filtro-de-produtos';
import { Paginacao } from './paginacao';
import './tela-de-produtos.css';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Grade de produtos
// O filtro vive na URL para preservar busca, categoria e página ao navegar,
// voltar pelo histórico ou compartilhar o endereço da vitrine.
// ---------------------------------------------
export function TelaDeProdutos({ cliente }: PropsDaTela) {
  const [parametros, setParametros] = useSearchParams();
  const filtro = filtroDaUrl(parametros);
  const { produtos, carregando, erro, recarregar } = useProdutos(
    cliente,
    filtro,
  );
  const totalDePaginas = produtos
    ? Math.max(1, Math.ceil(produtos.total / produtos.limite))
    : 1;

  return (
    <>
      <Cabecalho links={<NavPrincipal />} />

      <main className="vitrine">
        <h1 className="vitrine__titulo">Produtos</h1>

        <FiltroDeProdutosView
          cliente={cliente}
          filtro={filtro}
          aoMudar={(novo) => setParametros(urlDoFiltro(novo))}
        />

        {erro ? (
          <div className="vitrine__estado">
            <p className="vitrine__erro" role="alert">
              {erro}
            </p>
            <Botao onClick={recarregar}>Tentar novamente</Botao>
          </div>
        ) : null}

        {!erro && carregando ? <EsqueletoDaVitrine /> : null}

        {!erro && !carregando && produtos?.dados.length === 0 ? (
          <div className="vitrine__estado vitrine__vazio">
            <p>Nenhum produto encontrado com esse filtro.</p>
            <Botao
              variante="secundario"
              onClick={() =>
                setParametros(
                  urlDoFiltro({ categoria: null, busca: '', pagina: 1 }),
                )
              }
            >
              Limpar filtros
            </Botao>
          </div>
        ) : null}

        {!erro && !carregando && produtos && produtos.dados.length > 0 ? (
          <motion.div
            className="vitrine__grade"
            variants={listaContainer}
            initial="oculto"
            animate="visivel"
          >
            {produtos.dados.map((produto) => (
              <motion.div key={produto.id} variants={listaItem}>
                <CartaoDeProduto produto={produto} />
              </motion.div>
            ))}
          </motion.div>
        ) : null}

        {!erro && !carregando && produtos ? (
          <Paginacao
            pagina={produtos.pagina}
            totalDePaginas={totalDePaginas}
            aoMudar={(pagina) =>
              setParametros(urlDoFiltro({ ...filtro, pagina }))
            }
          />
        ) : null}
      </main>
    </>
  );
}

function EsqueletoDaVitrine() {
  return (
    <div
      className="vitrine__grade vitrine__carregando"
      role="status"
      aria-label="Carregando produtos"
    >
      {[0, 1, 2, 3].map((indice) => (
        <div className="vitrine__esqueleto" key={indice} aria-hidden="true" />
      ))}
    </div>
  );
}
