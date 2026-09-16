import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/cliente';
import {
  listarProdutos,
  type FiltroDeProdutos,
  type Produto,
} from '../api/produtos';

interface OpcoesDaVitrine {
  ordenarPor?: FiltroDeProdutos['ordenarPor'];
  direcao?: FiltroDeProdutos['direcao'];
  limite: number;
}

// ---------------------------------------------
// Vitrine independente
// Cancela a leitura anterior e descarta respostas tardias mesmo quando o
// transporte ignora o abort. Falha fica restrita à seção que fez a leitura.
// ---------------------------------------------
export function useVitrine(
  cliente: ApiClient,
  { ordenarPor = null, direcao = 'asc', limite }: OpcoesDaVitrine,
) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;
    setCarregando(true);
    setErro(null);

    listarProdutos(
      cliente,
      { categoria: null, busca: '', pagina: 1, ordenarPor, direcao, limite },
      controlador.signal,
    )
      .then((pagina) => {
        if (cancelado) return;
        setProdutos(pagina.dados);
        setCarregando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErro('Não foi possível carregar esta vitrine.');
        setCarregando(false);
      });

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [cliente, ordenarPor, direcao, limite]);

  return { produtos, carregando, erro };
}
