import type { ApiClient } from '../../api/cliente';
import type { FiltroDeProdutos } from '../../api/produtos';
import { useCategorias } from '../../hooks/use-categorias';
import './filtro-de-produtos.css';

interface PropsDoFiltro {
  cliente: ApiClient;
  filtro: FiltroDeProdutos;
  aoMudar: (novo: FiltroDeProdutos) => void;
}

// ---------------------------------------------
// Filtro da vitrine por nome e categoria
// Uma mudança sempre volta à página 1, porque o novo conjunto pode ter menos
// páginas que o anterior e deixaria a grade vazia sem explicação.
// ---------------------------------------------
export function FiltroDeProdutosView({
  cliente,
  filtro,
  aoMudar,
}: PropsDoFiltro) {
  const { categorias } = useCategorias(cliente);

  return (
    <div className="filtro-produtos">
      <div className="filtro-produtos__campo">
        <label className="filtro-produtos__rotulo" htmlFor="filtro-busca">
          Buscar produto
        </label>
        <input
          id="filtro-busca"
          className="filtro-produtos__entrada"
          type="search"
          placeholder="Nome do produto"
          value={filtro.busca}
          onChange={(evento) =>
            aoMudar({ ...filtro, busca: evento.target.value, pagina: 1 })
          }
        />
      </div>

      <div className="filtro-produtos__campo">
        <label className="filtro-produtos__rotulo" htmlFor="filtro-categoria">
          Categoria
        </label>
        <select
          id="filtro-categoria"
          className="filtro-produtos__entrada"
          value={filtro.categoria ?? ''}
          onChange={(evento) =>
            aoMudar({
              ...filtro,
              categoria: evento.target.value
                ? Number(evento.target.value)
                : null,
              pagina: 1,
            })
          }
        >
          <option value="">Todas</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
