import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSessao } from './contexto-de-sessao';

export interface ItemDoCarrinho {
  produtoId: number;
  quantidade: number;
}

interface ValorDoCarrinho {
  itens: ItemDoCarrinho[];
  totalDeItens: number;
  adicionar: (produtoId: number, quantidade: number) => void;
  removerItem: (produtoId: number) => void;
  atualizarQuantidade: (produtoId: number, quantidade: number) => void;
  limpar: () => void;
}

const ContextoDoCarrinho = createContext<ValorDoCarrinho | null>(null);

const CHAVE_DO_CARRINHO = 'carrinho';

// ---------------------------------------------
// Leitura do carrinho persistido
// O catch é vazio de propósito: armazenamento pode estar indisponível (aba
// anônima) ou conter lixo de uma versão anterior — nos dois casos, começar
// com carrinho vazio é mais seguro que quebrar a aplicação.
// ---------------------------------------------
function lerCarrinhoPersistido(): ItemDoCarrinho[] {
  try {
    const bruto = localStorage.getItem(CHAVE_DO_CARRINHO);
    if (!bruto) return [];
    const dados: unknown = JSON.parse(bruto);
    if (!Array.isArray(dados)) return [];
    return dados.filter(
      (item): item is ItemDoCarrinho =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ItemDoCarrinho).produtoId === 'number' &&
        typeof (item as ItemDoCarrinho).quantidade === 'number',
    );
  } catch {
    return [];
  }
}

function gravarCarrinhoPersistido(itens: ItemDoCarrinho[]): void {
  try {
    localStorage.setItem(CHAVE_DO_CARRINHO, JSON.stringify(itens));
  } catch {
    /* vazio de propósito — ver lerCarrinhoPersistido */
  }
}

interface PropsDoProvedor {
  children: ReactNode;
}

// ---------------------------------------------
// Provedor do carrinho
// Guarda só produtoId e quantidade: nome e preço são buscados de novo na
// tela do carrinho e no checkout, para nunca exibir dado desatualizado se o
// produto mudar de preço entre a adição e a compra. Zerado quando a sessão
// vira 'anonimo' — mesma lógica de não deixar rastro de sessão anterior num
// computador compartilhado que já vale para a marca de saída pendente.
// ---------------------------------------------
export function ProvedorDoCarrinho({ children }: PropsDoProvedor) {
  const { situacao } = useSessao();
  const [itens, setItens] = useState<ItemDoCarrinho[]>(() =>
    lerCarrinhoPersistido(),
  );

  useEffect(() => {
    gravarCarrinhoPersistido(itens);
  }, [itens]);

  useEffect(() => {
    if (situacao === 'anonimo') {
      setItens([]);
    }
  }, [situacao]);

  const adicionar = useCallback((produtoId: number, quantidade: number) => {
    setItens((atuais) => {
      const existente = atuais.find((item) => item.produtoId === produtoId);
      if (existente) {
        return atuais.map((item) =>
          item.produtoId === produtoId
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item,
        );
      }
      return [...atuais, { produtoId, quantidade }];
    });
  }, []);

  const removerItem = useCallback((produtoId: number) => {
    setItens((atuais) => atuais.filter((item) => item.produtoId !== produtoId));
  }, []);

  const atualizarQuantidade = useCallback(
    (produtoId: number, quantidade: number) => {
      setItens((atuais) =>
        atuais.map((item) =>
          item.produtoId === produtoId ? { ...item, quantidade } : item,
        ),
      );
    },
    [],
  );

  const limpar = useCallback(() => {
    setItens([]);
  }, []);

  const totalDeItens = useMemo(
    () => itens.reduce((soma, item) => soma + item.quantidade, 0),
    [itens],
  );

  const valor = useMemo<ValorDoCarrinho>(
    () => ({ itens, totalDeItens, adicionar, removerItem, atualizarQuantidade, limpar }),
    [itens, totalDeItens, adicionar, removerItem, atualizarQuantidade, limpar],
  );

  return (
    <ContextoDoCarrinho.Provider value={valor}>
      {children}
    </ContextoDoCarrinho.Provider>
  );
}

export function useCarrinho(): ValorDoCarrinho {
  const valor = useContext(ContextoDoCarrinho);
  if (!valor) {
    throw new Error('useCarrinho precisa estar dentro de ProvedorDoCarrinho.');
  }
  return valor;
}
