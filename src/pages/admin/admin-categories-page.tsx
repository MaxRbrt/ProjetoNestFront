import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/client';
import { removerCategoria } from '../../api/catalog-admin';
import { Aviso, Botao } from '../../components/ui';
import { useAdminCategoriesList } from '../../hooks/use-admin-categories-list';
import { Paginacao } from '../products/pagination';
// Reaproveita as classes .admin-produtos__cabecalho, .admin-tabela e
// .admin-tabela__acoes já definidas para a listagem de produtos (Task 7) —
// mesmo layout de tabela, então o mesmo CSS, importado aqui de propósito:
// sem este import, rodar o teste desta tela isoladamente carregaria a árvore
// sem nenhum <style> dessas classes.
import './admin-products-page.css';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Listagem de categorias do painel admin
// Mesmo padrão de confirmação e tratamento de 409 usado em
// AdminProductsPage: ação destrutiva confirmada antes, mensagem do backend
// exibida tal como veio quando há produto vinculado.
// ---------------------------------------------
export function AdminCategoriesPage({ cliente }: PropsDaTela) {
  const [pagina, setPagina] = useState(1);
  const { categorias, carregando, erro, recarregar } =
    useAdminCategoriesList(cliente, pagina);
  const [erroDeRemocao, setErroDeRemocao] = useState<string | null>(null);

  async function removerComConfirmacao(id: number, nome: string) {
    if (!window.confirm(`Remover a categoria "${nome}"?`)) {
      return;
    }
    setErroDeRemocao(null);
    try {
      await removerCategoria(cliente, id);
      recarregar();
    } catch (falha) {
      setErroDeRemocao(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível remover a categoria.',
      );
    }
  }

  return (
    <div>
      <div className="admin-produtos__cabecalho">
        <h1>Categorias</h1>
        <Link to="/admin/categorias/novo">
          <Botao>Nova categoria</Botao>
        </Link>
      </div>

      {erro ? <Aviso>{erro}</Aviso> : null}
      {erroDeRemocao ? <Aviso>{erroDeRemocao}</Aviso> : null}

      {!erro && carregando ? (
        <p role="status">Carregando categorias…</p>
      ) : null}

      {!erro && categorias && categorias.data.length === 0 ? (
        <p>Nenhuma categoria cadastrada.</p>
      ) : null}

      {!erro && categorias && categorias.data.length > 0 ? (
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {categorias.data.map((categoria) => (
              <tr key={categoria.id}>
                <td>{categoria.name}</td>
                <td className="admin-tabela__acoes">
                  <Link
                    to={`/admin/categorias/${categoria.id}/editar`}
                    aria-label={`Editar ${categoria.name}`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remover ${categoria.name}`}
                    onClick={() =>
                      void removerComConfirmacao(categoria.id, categoria.name)
                    }
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {categorias ? (
        <Paginacao
          pagina={categorias.page}
          totalDePaginas={
            Math.ceil(categorias.total / categorias.limit) || 1
          }
          aoMudar={setPagina}
        />
      ) : null}
    </div>
  );
}
