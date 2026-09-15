import { NavLink, Outlet } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import { Cabecalho } from '../../layout/cabecalho';
import './layout-admin.css';

interface PropsDoLayoutAdmin {
  cliente: ApiClient;
}

// ---------------------------------------------
// Casca do painel administrativo
// O cabeçalho principal continua igual ao resto da aplicação — só a subnav
// abaixo dele é exclusiva do painel. Outlet renderiza a rota filha, para que
// dashboard, produtos e categorias não precisem remontar este layout cada
// uma por conta própria.
// ---------------------------------------------
export function LayoutAdmin({ cliente }: PropsDoLayoutAdmin) {
  return (
    <>
      <Cabecalho cliente={cliente} />
      <div className="painel-admin">
        <nav
          className="painel-admin__subnav"
          aria-label="Navegação do painel admin"
        >
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          <NavLink to="/admin/produtos">Produtos</NavLink>
          <NavLink to="/admin/categorias">Categorias</NavLink>
          <NavLink to="/admin/pedidos">Pedidos</NavLink>
        </nav>
        <main className="painel-admin__conteudo">
          <Outlet />
        </main>
      </div>
    </>
  );
}
