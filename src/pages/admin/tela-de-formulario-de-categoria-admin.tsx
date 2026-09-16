import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import {
  atualizarCategoria,
  buscarCategoria,
  criarCategoria,
} from '../../api/catalogo-admin';
import { Aviso, Botao, Campo, classesDeBotao } from '../../ui/indice';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Formulário de categoria (criar e editar)
// Mesmo princípio de TelaDeFormularioDeProdutoAdmin: o modo vem da rota, não de uma
// prop separada.
// ---------------------------------------------
export function TelaDeFormularioDeCategoriaAdmin({ cliente }: PropsDaTela) {
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
        if (!cancelado) setNome(categoria.nome);
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
          nome,
        });
      } else {
        await criarCategoria(cliente, { nome });
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
    <div className="max-w-xl">
      <h1 className="text-balance text-2xl font-bold text-tinta">
        {emEdicao ? 'Editar categoria' : 'Nova categoria'}
      </h1>

      {erro ? (
        <div className="mt-4">
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}

      <form
        className="mt-6 flex flex-col gap-4 rounded-card border border-borda bg-superficie p-5 shadow-carta sm:p-6"
        onSubmit={aoSalvar}
      >
        <Campo
          rotulo="Nome"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          required
        />
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Link
            to="/admin/categorias"
            className={classesDeBotao({ variante: 'fantasma' })}
          >
            Cancelar
          </Link>
          <Botao type="submit" carregando={salvando}>
            Salvar
          </Botao>
        </div>
      </form>
    </div>
  );
}
