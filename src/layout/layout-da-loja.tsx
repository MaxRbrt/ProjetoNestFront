import { Outlet } from 'react-router-dom';
import { Cabecalho } from './cabecalho';
import { Rodape } from './rodape';

// ---------------------------------------------
// Casca da loja
// Envolve as rotas públicas do catálogo (tela inicial, vitrine e detalhe do
// produto) com cabeçalho e rodapé comuns. O link "Pular para o conteúdo" é o
// primeiro elemento focável da página — fica invisível até receber foco, para
// quem navega por teclado não precisar passar por cabeçalho, busca e barra de
// categorias inteiros só para chegar ao conteúdo principal.
// ---------------------------------------------
export function LayoutDaLoja() {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-white focus:px-4 focus:py-2 focus:text-tinta focus:shadow-carta-media"
      >
        Pular para o conteúdo
      </a>

      <Cabecalho />

      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      <Rodape />
    </div>
  );
}
