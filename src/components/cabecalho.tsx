import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSessao } from '../auth/contexto-de-sessao';
import { useCarrinho } from '../auth/contexto-do-carrinho';
import { Botao } from './primitivos';
import './cabecalho.css';

interface PropsDoCabecalho {
  links?: ReactNode;
}

// ---------------------------------------------
// Cabeçalho da aplicação autenticada
// A identidade e o acesso à conta ficam consistentes em todas as telas.
// `links` recebe a navegação específica de cada página. O contador do
// carrinho soma quantidade, não linhas — dois produtos com quantidade 3 cada
// mostram "6", não "2".
// ---------------------------------------------
export function Cabecalho({ links }: PropsDoCabecalho) {
  const { usuario, sair } = useSessao();
  const { totalDeItens } = useCarrinho();

  return (
    <header className="cabecalho">
      <div className="cabecalho__conteudo">
        <Link to="/" className="cabecalho__logo">
          <span className="cabecalho__logo-marca">NX</span>
          <span className="cabecalho__logo-texto">Catálogo</span>
        </Link>

        {links ? (
          <nav className="cabecalho__links" aria-label="Navegação principal">
            {links}
          </nav>
        ) : null}

        {usuario ? (
          <div className="cabecalho__conta">
            <Link
              to="/carrinho"
              className="cabecalho__carrinho"
              aria-label={`Carrinho, ${totalDeItens} ${totalDeItens === 1 ? 'item' : 'itens'}`}
            >
              Carrinho
              {totalDeItens > 0 ? (
                <span className="cabecalho__carrinho-contador">
                  {totalDeItens}
                </span>
              ) : null}
            </Link>
            <span className="cabecalho__usuario">{usuario.email}</span>
            <Botao variante="secundario" onClick={() => void sair()}>
              Sair
            </Botao>
          </div>
        ) : null}
      </div>
    </header>
  );
}
