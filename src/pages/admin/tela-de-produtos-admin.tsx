import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import { removerProduto } from '../../api/catalogo-admin';
import { formatarCentavos } from '../../utils/dinheiro';
import { Aviso, Botao, classesDeBotao } from '../../ui/indice';
import { useListaDeProdutosAdmin } from '../../hooks/use-lista-de-produtos-admin';
import { Paginacao } from '../produtos/paginacao';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Listagem de produtos do painel admin
// Confirmação nativa (window.confirm) antes de remover: é uma ação
// destrutiva e o produto pode estar em pedidos existentes, caso em que o
// backend responde 409 com uma mensagem pronta em PT-BR, mostrada tal como
// veio — sem reescrever o que o backend já formulou.
// ---------------------------------------------
export function TelaDeProdutosAdmin({ cliente }: PropsDaTela) {
  const localizacao = useLocation();
  const navegar = useNavigate();
  const [sucesso] = useState(() => {
    const mensagem = (localizacao.state as { sucesso?: unknown } | null)
      ?.sucesso;
    return typeof mensagem === 'string' ? mensagem : null;
  });
  useEffect(() => {
    if (localizacao.state?.sucesso) {
      navegar(localizacao.pathname + localizacao.search, {
        replace: true,
        state: null,
      });
    }
  }, [localizacao, navegar]);
  const [pagina, setPagina] = useState(1);
  const { produtos, carregando, erro, recarregar } = useListaDeProdutosAdmin(
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-balance text-2xl font-bold text-tinta">Produtos</h1>
        <Link
          to="/admin/produtos/novo"
          className={classesDeBotao({
            tamanho: 'pequeno',
            className: 'min-h-11 lg:min-h-9',
          })}
        >
          Novo produto
        </Link>
      </div>

      {sucesso ? (
        <div className="mt-4">
          <Aviso tipo="sucesso">{sucesso}</Aviso>
        </div>
      ) : null}
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
          Carregando produtos…
        </p>
      ) : null}

      {!erro && produtos && produtos.dados.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-media">
          Nenhum produto cadastrado.
        </p>
      ) : null}

      {!erro && produtos && produtos.dados.length > 0 ? (
        <div
          className="mt-4 overflow-x-auto rounded-card border border-borda"
          role="region"
          aria-label="Lista de produtos"
          tabIndex={0}
        >
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="sticky top-0 bg-superficie">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Nome
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Preço
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Estoque
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {produtos.dados.map((produto) => (
                <tr key={produto.id} className="odd:bg-superficie-sutil">
                  <td className="px-4 py-3 text-tinta">{produto.nome}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-tinta">
                    {formatarCentavos(produto.precoEmCentavos)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-tinta">
                    {produto.estoque}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/produtos/${produto.id}/editar`}
                        aria-label={`Editar ${produto.nome}`}
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
                        aria-label={`Remover ${produto.nome}`}
                        onClick={() =>
                          void removerComConfirmacao(produto.id, produto.nome)
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

      {produtos ? (
        <Paginacao
          pagina={produtos.pagina}
          totalDePaginas={Math.ceil(produtos.total / produtos.limite) || 1}
          aoMudar={setPagina}
        />
      ) : null}
    </div>
  );
}
