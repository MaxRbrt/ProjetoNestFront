import { Botao } from '../../ui/indice';

interface PropsDaPaginacao {
  pagina: number;
  totalDePaginas: number;
  aoMudar: (pagina: number) => void;
  rotulo?: string;
}

// ---------------------------------------------
// Paginação da grade
// O controle some quando não existe outra página para visitar.
// ---------------------------------------------
export function Paginacao({
  pagina,
  totalDePaginas,
  aoMudar,
  rotulo = 'Paginação de produtos',
}: PropsDaPaginacao) {
  if (totalDePaginas <= 1) {
    return null;
  }

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-center gap-3"
      aria-label={rotulo}
    >
      <Botao
        variante="secundario"
        tamanho="pequeno"
        className="focus-visible:outline-acento"
        disabled={pagina <= 1}
        onClick={() => aoMudar(pagina - 1)}
      >
        Anterior
      </Botao>
      <span className="text-base text-tinta-media">
        Página {pagina} de {totalDePaginas}
      </span>
      <Botao
        variante="secundario"
        tamanho="pequeno"
        className="focus-visible:outline-acento"
        disabled={pagina >= totalDePaginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
      </Botao>
    </nav>
  );
}
