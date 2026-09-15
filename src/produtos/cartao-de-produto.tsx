import { Link, useLocation } from 'react-router-dom';
import type { Produto } from '../api/produtos';
import { urlDaImagemDoProduto } from '../api/produtos';
import { Etiqueta, Preco } from '../ui/indice';

interface PropsDoCartao {
  produto: Produto;
}

// ---------------------------------------------
// Cartão de produto na grade
// O cartão inteiro é um Link (não onClick em div) para que Ctrl+clique e
// clique do meio funcionem. state.retorno carrega a URL atual (com busca,
// categoria, ordenação e página) para o detalhe devolver o visitante ao
// catálogo no mesmo filtro ao voltar. Etiqueta de estoque é honesta: só
// "Esgotado" e "Últimas unidades", nada que o backend não tenha. Sem imagem,
// cai na inicial do nome como âncora visual, igual ao cartão anterior.
// ---------------------------------------------
export function CartaoDeProduto({ produto }: PropsDoCartao) {
  const local = useLocation();
  const retorno = `${local.pathname}${local.search}`;
  const urlDaImagem = urlDaImagemDoProduto(produto);
  const semEstoque = produto.estoque === 0;
  const estoqueBaixo = produto.estoque > 0 && produto.estoque <= 3;

  return (
    <Link
      to={`/produtos/${produto.id}`}
      state={{ retorno }}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-borda bg-superficie shadow-carta transition-shadow duration-200 ease-saida hover:shadow-carta-media focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
    >
      <div
        className={`flex aspect-square items-center justify-center overflow-hidden bg-superficie-sutil p-4 ${semEstoque ? 'opacity-60 grayscale' : ''}`}
      >
        {urlDaImagem ? (
          <img
            src={urlDaImagem}
            alt=""
            loading="lazy"
            width={400}
            height={400}
            className="h-full w-full object-contain transition-transform duration-300 ease-saida motion-safe:group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-marca"
          >
            {produto.nome.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {semEstoque && (
          <span className="self-start">
            <Etiqueta tom="erro">Esgotado</Etiqueta>
          </span>
        )}
        {estoqueBaixo && (
          <span className="self-start">
            <Etiqueta tom="aviso">Últimas unidades</Etiqueta>
          </span>
        )}
        <h3 className="mb-1 min-h-[2.5rem] line-clamp-2 text-sm font-semibold text-tinta">
          {produto.nome}
        </h3>
        <Preco centavos={produto.precoEmCentavos} tamanho="pequeno" />
        <p className="text-xs text-tinta-suave">
          {produto.estoque > 0 ? `${produto.estoque} em estoque` : 'Indisponível'}
        </p>
      </div>
    </Link>
  );
}
