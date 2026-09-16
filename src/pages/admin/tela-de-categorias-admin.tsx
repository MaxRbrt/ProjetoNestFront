import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { removerCategoria } from '../../api/catalogo-admin';
import { Aviso, Botao, classesDeBotao } from '../../ui/indice';
import { useListaDeCategoriasAdmin } from '../../hooks/use-lista-de-categorias-admin';
import { Paginacao } from '../products/paginacao';

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-tinta">Categorias</h1>
        <Link
          to="/admin/categorias/novo"
          className={classesDeBotao({ tamanho: 'pequeno' })}
        >
          Nova categoria
        </Link>
      </div>

      {erro ? (
        <div className="mt-4">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}
      {erroDeRemocao ? (
        <div className="mt-4">
          <Aviso>{erroDeRemocao}</Aviso>
        </div>
      ) : null}

      {!erro && carregando ? (
        <p role="status" className="mt-4 text-sm text-tinta-media">
          Carregando categorias…
        </p>
      ) : null}

      {!erro && categorias && categorias.dados.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-media">
          Nenhuma categoria cadastrada.
        </p>
      ) : null}

      {!erro && categorias && categorias.dados.length > 0 ? (
        <div
          className="mt-4 overflow-x-auto rounded-card border border-borda"
          role="region"
          aria-label="Lista de categorias"
          tabIndex={0}
        >
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead className="sticky top-0 bg-superficie">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Nome
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {categorias.dados.map((categoria) => (
                <tr key={categoria.id} className="odd:bg-superficie-sutil">
                  <td className="px-4 py-3 text-tinta">{categoria.nome}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/categorias/${categoria.id}/editar`}
                        aria-label={`Editar ${categoria.nome}`}
                        className={classesDeBotao({
                          variante: 'fantasma',
                          tamanho: 'pequeno',
                        })}
                      >
                        Editar
                      </Link>
                      <Botao
                        type="button"
                        variante="perigo"
                        tamanho="pequeno"
                        aria-label={`Remover ${categoria.nome}`}
                        onClick={() =>
                          void removerComConfirmacao(
                            categoria.id,
                            categoria.nome,
                          )
                        }
                      >
                        Remover
                      </Botao>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {categorias ? (
        <Paginacao
          pagina={categorias.pagina}
          totalDePaginas={Math.ceil(categorias.total / categorias.limite) || 1}
          aoMudar={setPagina}
        />
      ) : null}
    </div>
  );
}
