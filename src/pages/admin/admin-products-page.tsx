import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/client';
import { removerProduto } from '../../api/catalog-admin';
import { Aviso, Botao } from '../../components/ui';
import { useAdminProductsList } from '../../hooks/use-admin-products-list';
import { Paginacao } from '../products/pagination';
import './admin-products-page.css';

interface PropsDaTela {
  cliente: ApiClient;
}

const FORMATADOR_DE_PRECO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// ---------------------------------------------
// Listagem de produtos do painel admin
// Confirmação nativa (window.confirm) antes de remover: é uma ação
// destrutiva e o produto pode estar em pedidos existentes, caso em que o
// backend responde 409 com uma mensagem pronta em PT-BR, mostrada tal como
// veio — sem reescrever o que o backend já formulou.
// ---------------------------------------------
export function AdminProductsPage({ cliente }: PropsDaTela) {
  const [pagina, setPagina] = useState(1);
  const { produtos, carregando, erro, recarregar } = useAdminProductsList(
    cliente,
    pagina,
  );
  const [erroDeRemocao, setErroDeRemocao] = useState<string | null>(null);

  async function removerComConfirmacao(id: number, nome: string) {
    if (!window.confirm(`Remover o produto "${nome}"?`)) {
      return;
    }
    setErroDeRemocao(null);
    try {
      await removerProduto(cliente, id);
      recarregar();
    } catch (falha) {
      setErroDeRemocao(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível remover o produto.',
      );
    }
  }

  return (
    <div>
      <div className="admin-produtos__cabecalho">
        <h1>Produtos</h1>
        <Link to="/admin/produtos/novo">
          <Botao>Novo produto</Botao>
        </Link>
      </div>

      {erro ? <Aviso>{erro}</Aviso> : null}
      {erroDeRemocao ? <Aviso>{erroDeRemocao}</Aviso> : null}

      {!erro && carregando ? <p role="status">Carregando produtos…</p> : null}

      {!erro && produtos && produtos.data.length === 0 ? (
        <p>Nenhum produto cadastrado.</p>
      ) : null}

      {!erro && produtos && produtos.data.length > 0 ? (
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {produtos.data.map((produto) => (
              <tr key={produto.id}>
                <td>{produto.name}</td>
                <td>{FORMATADOR_DE_PRECO.format(produto.price)}</td>
                <td>{produto.stock}</td>
                <td className="admin-tabela__acoes">
                  <Link
                    to={`/admin/produtos/${produto.id}/editar`}
                    aria-label={`Editar ${produto.name}`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remover ${produto.name}`}
                    onClick={() =>
                      void removerComConfirmacao(produto.id, produto.name)
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

      {produtos ? (
        <Paginacao
          pagina={produtos.page}
          totalDePaginas={Math.ceil(produtos.total / produtos.limit) || 1}
          aoMudar={setPagina}
        />
      ) : null}
    </div>
  );
}
