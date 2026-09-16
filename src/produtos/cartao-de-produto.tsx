import { Link, useLocation } from 'react-router-dom';
import type { Produto } from '../api/produtos';
import { urlDaImagemDoProduto } from '../api/produtos';
import { Etiqueta, Preco, classesDeBotao } from '../ui/indice';

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
// cai na inicial do nome como âncora visual, igual ao cartão anterior. A
// etiqueta fica sobre a imagem para o nome começar na mesma altura em todos
// os cartões da linha, e o preço desce junto com o botão pelo mesmo motivo.
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
      className="group flex h-full flex-col overflow-hidden rounded-card border border-borda bg-superficie shadow-carta transition-[border-color,box-shadow] duration-150 hover:border-borda-forte hover:shadow-carta-media focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca"
    >
      <div className="relative border-b border-borda bg-superficie-sutil">
        <div
          className={`flex aspect-[4/3] items-center justify-center overflow-hidden p-5 sm:aspect-square ${semEstoque ? 'opacity-60 grayscale' : ''}`}
        >
          {urlDaImagem ? (
            <img
              src={urlDaImagem}
              alt=""
              loading="lazy"
              width={400}
              height={400}
              className="h-full w-full object-contain"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center text-5xl font-bold text-marca/70"
            >
              {produto.nome.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {semEstoque || estoqueBaixo ? (
          <span className="absolute left-3 top-3">
            <Etiqueta tom={semEstoque ? 'erro' : 'aviso'}>
              {semEstoque ? 'Esgotado' : 'Últimas unidades'}
            </Etiqueta>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="break-words text-lg font-semibold leading-snug text-tinta">
          {produto.nome}
        </h3>
        <p className="text-base text-tinta-media">
          {produto.estoque > 0
            ? `${produto.estoque} em estoque`
            : 'Indisponível no momento'}
        </p>
        <div className="mt-auto flex flex-col gap-4 pt-3">
          <Preco centavos={produto.precoEmCentavos} tamanho="medio" />
          <span
            className={classesDeBotao({
              variante: 'secundario',
              tamanho: 'pequeno',
              bloco: true,
              className: 'group-hover:border-marca group-hover:bg-superficie-sutil',
            })}
          >
            Ver produto
          </span>
        </div>
      </div>
    </Link>
  );
}
