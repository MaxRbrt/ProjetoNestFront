import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/client';
import {
  atualizarProduto,
  criarProduto,
  type DadosDeProduto,
} from '../../api/catalog-admin';
import { buscarProduto } from '../../api/products';
import { Aviso, Botao, Campo } from '../../components/ui';
import { useCategories } from '../../hooks/use-categories';
import './admin-product-form-page.css';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Formulário de produto (criar e editar)
// O modo é decidido pela presença de :id na rota, não por uma prop separada:
// evita duas telas quase idênticas divergindo com o tempo. No modo edição, o
// produto é buscado uma vez para preencher os campos; a categoria vem do
// mesmo hook que a vitrine pública usa para o filtro.
// ---------------------------------------------
export function AdminProductFormPage({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id?: string }>();
  const navegar = useNavigate();
  const { categorias } = useCategories(cliente);
  const emEdicao = parametros.id !== undefined;

  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [estoque, setEstoque] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!emEdicao) return;

    let cancelado = false;
    const controlador = new AbortController();
    const id = Number(parametros.id);

    buscarProduto(cliente, id, controlador.signal)
      .then((produto) => {
        if (cancelado) return;
        setNome(produto.name);
        setPreco(String(produto.price));
        setCategoriaId(String(produto.categoryId));
        setEstoque(String(produto.stock));
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar o produto.');
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, emEdicao, parametros.id]);

  async function aoSalvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    const dados: DadosDeProduto = {
      name: nome,
      price: Number(preco),
      categoryId: Number(categoriaId),
      stock: Number(estoque),
    };

    try {
      if (emEdicao) {
        await atualizarProduto(cliente, Number(parametros.id), dados);
      } else {
        await criarProduto(cliente, dados);
      }
      navegar('/admin/produtos');
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível salvar o produto.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <h1>{emEdicao ? 'Editar produto' : 'Novo produto'}</h1>

      {erro ? <Aviso>{erro}</Aviso> : null}

      <form className="admin-form" onSubmit={aoSalvar}>
        <Campo
          rotulo="Nome"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          required
        />
        <Campo
          rotulo="Preço"
          type="number"
          step="0.01"
          value={preco}
          onChange={(evento) => setPreco(evento.target.value)}
          required
        />
        <div className="campo">
          <label className="campo__rotulo" htmlFor="categoria">
            Categoria
          </label>
          <select
            id="categoria"
            className="campo__entrada"
            value={categoriaId}
            onChange={(evento) => setCategoriaId(evento.target.value)}
            required
          >
            <option value="" disabled>
              Selecione
            </option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.name}
              </option>
            ))}
          </select>
        </div>
        <Campo
          rotulo="Estoque"
          type="number"
          value={estoque}
          onChange={(evento) => setEstoque(evento.target.value)}
          required
        />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </div>
  );
}
