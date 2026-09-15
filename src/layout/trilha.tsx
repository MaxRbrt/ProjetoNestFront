import { Link } from 'react-router-dom';

export interface ItemDaTrilha {
  rotulo: string;
  para?: string;
}

interface PropsDaTrilha {
  itens: ItemDaTrilha[];
}

// ---------------------------------------------
// Trilha de navegação
// O último item é sempre a página atual: sem link e com aria-current="page",
// para o leitor de tela anunciar onde a pessoa está sem repetir o título da
// página. Os itens anteriores só viram link quando trazem "para" — a trilha
// pode nomear um nível sem rota própria (uma categoria sem página de listagem
// dedicada, por exemplo) sem virar um link quebrado.
// ---------------------------------------------
export function Trilha({ itens }: PropsDaTrilha) {
  const ultimoIndice = itens.length - 1;

  return (
    <nav aria-label="Trilha de navegação" className="text-sm text-tinta-media">
      <ol className="flex flex-wrap items-center gap-1.5">
        {itens.map((item, indice) => {
          const atual = indice === ultimoIndice;
          return (
            <li
              key={`${item.rotulo}-${indice}`}
              className="flex items-center gap-1.5"
            >
              {indice > 0 ? (
                <span aria-hidden="true" className="text-tinta-media/60">
                  /
                </span>
              ) : null}
              {atual || !item.para ? (
                <span
                  aria-current={atual ? 'page' : undefined}
                  className={atual ? 'font-medium text-tinta' : ''}
                >
                  {item.rotulo}
                </span>
              ) : (
                <Link
                  to={item.para}
                  className="hover:text-tinta hover:underline"
                >
                  {item.rotulo}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
