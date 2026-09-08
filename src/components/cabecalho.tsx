import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSessao } from '../auth/contexto-de-sessao';
import { Botao } from './primitivos';
import './cabecalho.css';

interface PropsDoCabecalho {
  links?: ReactNode;
}

// ---------------------------------------------
// Cabeçalho da aplicação autenticada
// A identidade e o acesso à conta ficam consistentes em todas as telas.
// `links` recebe a navegação específica de cada página.
// ---------------------------------------------
export function Cabecalho({ links }: PropsDoCabecalho) {
  const { usuario, sair } = useSessao();

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

        <div className="cabecalho__conta">
          <span className="cabecalho__usuario">{usuario?.email}</span>
          <Botao variante="secundario" onClick={() => void sair()}>
            Sair
          </Botao>
        </div>
      </div>
    </header>
  );
}
