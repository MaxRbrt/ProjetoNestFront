import type { ReactNode, Ref } from 'react';
import { Trilha, type ItemDaTrilha } from './trilha';

interface PropsDoCabecalhoDaPagina {
  trilha: ItemDaTrilha[];
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  refDoTitulo?: Ref<HTMLHeadingElement>;
}

// ---------------------------------------------
// Cabeçalho da página
// Trilha, título e descrição com o mesmo ritmo em todas as telas da loja —
// antes cada tela repetia o bloco com margens próprias. "acao" fica à direita
// do título no desktop e abaixo dele no celular. refDoTitulo existe para as
// telas que devolvem o foco ao <h1> depois de uma ação (o h1 recebe
// tabIndex -1 só nesse caso, para não entrar na ordem do Tab).
// ---------------------------------------------
export function CabecalhoDaPagina({
  trilha,
  titulo,
  descricao,
  acao,
  refDoTitulo,
}: PropsDoCabecalhoDaPagina) {
  return (
    <div className="flex flex-col gap-4">
      <Trilha itens={trilha} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1
            ref={refDoTitulo}
            tabIndex={refDoTitulo ? -1 : undefined}
            className="text-balance break-words text-3xl font-bold tracking-tight text-tinta focus:outline-none sm:text-4xl"
          >
            {titulo}
          </h1>
          {descricao ? (
            <p className="text-lg text-tinta-media">{descricao}</p>
          ) : null}
        </div>
        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>
    </div>
  );
}
