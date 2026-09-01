import { Botao } from '../../components/ui';
import './pagination.css';

interface PropsDaPaginacao {
  pagina: number;
  totalDePaginas: number;
  aoMudar: (pagina: number) => void;
}

// ---------------------------------------------
// Paginação da grade
// O controle some quando não existe outra página para visitar.
// ---------------------------------------------
export function Paginacao({
  pagina,
  totalDePaginas,
  aoMudar,
}: PropsDaPaginacao) {
  if (totalDePaginas <= 1) {
    return null;
  }

  return (
    <nav className="paginacao" aria-label="Paginação de produtos">
      <Botao
        variante="secundario"
        disabled={pagina <= 1}
        onClick={() => aoMudar(pagina - 1)}
      >
        Anterior
      </Botao>
      <span className="paginacao__texto">
        Página {pagina} de {totalDePaginas}
      </span>
      <Botao
        variante="secundario"
        disabled={pagina >= totalDePaginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
      </Botao>
    </nav>
  );
}
