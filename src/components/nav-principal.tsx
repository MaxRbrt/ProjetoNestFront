import { Link } from 'react-router-dom';
import { useSessao } from '../auth/contexto-de-sessao';

// ---------------------------------------------
// Navegação principal, condicionada ao papel
// Centraliza a decisão de quais links aparecem no cabeçalho: sem isso, cada
// tela que monta <Cabecalho links={...}> precisaria repetir a checagem de
// role, e uma tela nova facilmente esqueceria o link do painel admin.
// ---------------------------------------------
export function NavPrincipal() {
  const { usuario } = useSessao();

  return (
    <>
      <Link to="/produtos">Produtos</Link>
      {usuario?.papel === 'ADMIN' ? (
        <Link to="/admin">Painel Admin</Link>
      ) : null}
    </>
  );
}
