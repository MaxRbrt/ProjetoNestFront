import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { removerCategoria } from '../../api/catalogo-admin';
import { Aviso, Botao } from '../../components/primitivos';
import { useListaDeCategoriasAdmin } from '../../hooks/use-lista-de-categorias-admin';
import { Paginacao } from '../products/paginacao';
// ---------------------------------------------
// CSS compartilhado com a listagem de produtos
// Reaproveita .admin-produtos__cabecalho, .admin-tabela e .admin-tabela__acoes
// já definidas lá — mesmo layout de tabela, então o mesmo CSS. O import é
// explícito de propósito: sem ele, renderizar esta tela isoladamente carrega a
// árvore sem nenhum <style> dessas classes.
// ---------------------------------------------
import './tela-de-produtos-admin.css';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Listagem de categorias do painel admin
// Mesmo padrão de confirmação e tratamento de 409 usado em
// TelaDeProdutosAdmin: ação destrutiva confirmada antes, mensagem do backend
// exibida tal como veio quando há produto vinculado.
// ---------------------------------------------
export function TelaDeCategoriasAdmin({ cliente }: PropsDaTela) {
  const [pagina, setPagina] = useState(1);
  const { categorias, carregando, erro, recarregar } =
    useListaDeCategoriasAdmin(cliente, pagina);
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

      {!erro && categorias && categorias.dados.length === 0 ? (
        <p>Nenhuma categoria cadastrada.</p>
      ) : null}

      {!erro && categorias && categorias.dados.length > 0 ? (
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {categorias.dados.map((categoria) => (
              <tr key={categoria.id}>
                <td>{categoria.nome}</td>
                <td className="admin-tabela__acoes">
                  <Link
                    to={`/admin/categorias/${categoria.id}/editar`}
                    aria-label={`Editar ${categoria.nome}`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remover ${categoria.nome}`}
                    onClick={() =>
                      void removerComConfirmacao(categoria.id, categoria.nome)
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
          pagina={categorias.pagina}
          totalDePaginas={
            Math.ceil(categorias.total / categorias.limite) || 1
          }
          aoMudar={setPagina}
        />
      ) : null}
    </div>
  );
}
