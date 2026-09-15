import { Link } from 'react-router-dom';

// ---------------------------------------------
// Rodapé da loja
// A coluna de aviso não é decorativa: a interface imita uma loja de verdade
// (preço, estoque, frete calculado), e sem um aviso claro de que a compra é
// simulada a pessoa pode achar que está pagando de verdade. Por isso o texto
// fica sempre visível, nunca atrás de um link "sobre" que ninguém abre, e sem
// nenhum selo de bandeira de cartão ou logo de terceiro que sugira uma
// integração de pagamento real que não existe.
// ---------------------------------------------
export function Rodape() {
  return (
    <footer className="border-t border-borda bg-superficie-sutil text-tinta-media">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <h2 className="text-sm font-semibold text-tinta">Institucional</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-tinta hover:underline">
                Sobre a loja
              </Link>
            </li>
            <li>
              <Link to="/produtos" className="hover:text-tinta hover:underline">
                Catálogo completo
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-tinta">Ajuda</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/pedidos" className="hover:text-tinta hover:underline">
                Acompanhar pedido
              </Link>
            </li>
            <li>
              <Link
                to="/enderecos"
                className="hover:text-tinta hover:underline"
              >
                Endereços de entrega
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-tinta">Conta</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/entrar" className="hover:text-tinta hover:underline">
                Entrar
              </Link>
            </li>
            <li>
              <Link
                to="/cadastrar"
                className="hover:text-tinta hover:underline"
              >
                Criar conta
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-tinta">Aviso</h2>
          <p className="mt-3 text-sm">
            Esta é uma loja de demonstração. Nenhuma cobrança é real e o
            pagamento é simulado — nenhum valor é debitado de cartão ou conta
            algum.
          </p>
        </div>
      </div>
    </footer>
  );
}
