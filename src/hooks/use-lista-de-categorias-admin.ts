import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import type { Categoria, Paginado } from '../api/produtos';

interface ResultadoDaListaAdmin {
  categorias: Paginado<Categoria> | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// ---------------------------------------------
// Listagem de categorias para o painel admin
// Paginada, ao contrário de useCategorias (que busca até 100 de uma vez só
// para o dropdown de filtro da vitrine) — aqui o objetivo é navegar página a
// página para editar ou remover, não preencher um select.
// ---------------------------------------------
export function useListaDeCategoriasAdmin(
  cliente: ApiClient,
  pagina: number,
): ResultadoDaListaAdmin {
  const [categorias, setCategorias] = useState<Paginado<Categoria> | null>(
    null,
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const recarregar = useCallback(() => {
    setTentativa((atual) => atual + 1);
  }, []);

  useEffect(() => {
    let cancelado = false;
    const controlador = new AbortController();
    setCarregando(true);

    cliente
      .get<Paginado<Categoria>>(`/categories?pagina=${pagina}`, {
        signal: controlador.signal,
      })
      .then((resultado) => {
        if (cancelado) return;
        setCategorias(resultado);
        setErro(null);
        setCarregando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErro('Não foi possível carregar as categorias.');
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, pagina, tentativa]);

  return { categorias, carregando, erro, recarregar };
}
