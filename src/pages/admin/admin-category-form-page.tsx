import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/client';
import {
  atualizarCategoria,
  buscarCategoria,
  criarCategoria,
} from '../../api/catalog-admin';
import { Aviso, Botao, Campo } from '../../components/ui';
import './admin-product-form-page.css';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Formulário de categoria (criar e editar)
// Mesmo princípio de AdminProductFormPage: o modo vem da rota, não de uma
// prop separada.
// ---------------------------------------------
export function AdminCategoryFormPage({ cliente }: PropsDaTela) {
  const parametros = useParams<{ id?: string }>();
  const navegar = useNavigate();
  const emEdicao = parametros.id !== undefined;

  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!emEdicao) return;

    let cancelado = false;
    const controlador = new AbortController();
    const id = Number(parametros.id);

    buscarCategoria(cliente, id, controlador.signal)
      .then((categoria) => {
        if (!cancelado) setNome(categoria.name);
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar a categoria.');
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

    try {
      if (emEdicao) {
        await atualizarCategoria(cliente, Number(parametros.id), {
          name: nome,
        });
      } else {
        await criarCategoria(cliente, { name: nome });
      }
      navegar('/admin/categorias');
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível salvar a categoria.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <h1>{emEdicao ? 'Editar categoria' : 'Nova categoria'}</h1>

      {erro ? <Aviso>{erro}</Aviso> : null}

      <form className="admin-form" onSubmit={aoSalvar}>
        <Campo
          rotulo="Nome"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          required
        />
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>
    </div>
  );
}
