import { MotionConfig } from 'motion/react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { apiClient } from './api/instancia';
import { RotaAdmin } from './auth/rota-admin';
import { RotaProtegida } from './auth/rota-protegida';
import { ProvedorDeSessao, useSessao } from './auth/contexto-de-sessao';
import { ProvedorDoCarrinho } from './auth/contexto-do-carrinho';
import { LayoutDaLoja } from './layout/layout-da-loja';
import { TelaDeFormularioDeCategoriaAdmin } from './pages/admin/tela-de-formulario-de-categoria-admin';
import { TelaDeCategoriasAdmin } from './pages/admin/tela-de-categorias-admin';
import { TelaDeDashboardAdmin } from './pages/admin/tela-de-dashboard-admin';
import { LayoutAdmin } from './pages/admin/layout-admin';
import { TelaDeFormularioDeProdutoAdmin } from './pages/admin/tela-de-formulario-de-produto-admin';
import { TelaDeProdutosAdmin } from './pages/admin/tela-de-produtos-admin';
import { TelaDePedidosAdmin } from './pages/admin/tela-de-pedidos-admin';
import { TelaInicial } from './pages/tela-inicial';
import { TelaDeEntrada } from './pages/tela-de-entrada';
import { TelaDeDetalheDoProduto } from './pages/produtos/tela-de-detalhe-do-produto';
import { TelaDeProdutos } from './pages/produtos/tela-de-produtos';
import { TelaDeCarrinho } from './pages/carrinho/tela-de-carrinho';
import { TelaDeMeusPedidos } from './pages/pedidos/tela-de-meus-pedidos';
import { TelaDeEnderecos } from './pages/enderecos/tela-de-enderecos';
import { TelaDeDetalheDoPedido } from './pages/pedidos/tela-de-detalhe-do-pedido';
import { TelaDePerfil } from './pages/tela-de-perfil';
import { TelaDeCadastro } from './pages/tela-de-cadastro';
import { TelaDeVerificacaoDeEmail } from './pages/tela-de-verificacao-de-email';
import { TelaDeEsqueciSenha } from './pages/tela-de-esqueci-senha';
import { TelaDeReenviarVerificacao } from './pages/tela-de-reenviar-verificacao';
import { TelaDeRedefinirSenha } from './pages/tela-de-redefinir-senha';

// ---------------------------------------------
// Raiz da aplicação
// O provedor de sessão envolve o roteador inteiro: as rotas precisam saber se
// a verificação ainda está em curso antes de decidir o que renderizar, senão
// quem recarrega a página autenticado vê a tela de entrada piscar.
// A árvore protegida (carrinho + rotas) fica isolada em AreaProtegida porque
// precisa ler useSessao() para montar a key de identidade — ver o comentário
// daquela função.
// O reducedMotion="user" do MotionConfig é obrigatório: o CSS já respeita a
// preferência do sistema, mas as animações do Motion rodam por JavaScript e
// ignoravam esse ajuste — quem pediu menos movimento continuava recebendo tudo.
// ---------------------------------------------
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ProvedorDeSessao cliente={apiClient}>
          <AreaProtegida />
        </ProvedorDeSessao>
      </BrowserRouter>
    </MotionConfig>
  );
}

// ---------------------------------------------
// Área que depende da identidade do usuário
// AreaComCarrinho é uma rota de layout: só ela fica sob
// key={usuario?.id ?? 'anonimo'}. Quando a sessão troca de um usuário
// autenticado para outro na mesma aba (sincronização entre abas via
// BroadcastChannel, sem passar por um estado intermediário anônimo), a
// mudança de key força o React a desmontar e remontar essa subárvore —
// carrinho e qualquer tela de pedido em exibição — em vez de deixar
// componentes existentes continuarem mostrando dado do usuário anterior sob
// a identidade do novo. Sem isso, a aba A podia continuar exibindo pedidos e
// carrinho de A depois que a aba B promovia a sessão inteira do navegador
// para B.
//
// As rotas públicas (entrada, cadastro, verificação de email, recuperação de
// senha) ficam FORA dessa subárvore de propósito — revisão adversarial
// (Codex) reproduziu um bug real: se uma tela pública com estado local
// próprio (como a confirmação de "senha redefinida" em
// TelaDeRedefinirSenha) estivesse dentro dela, uma troca de identidade em
// outra aba remontaria a tela pública no meio da leitura, perdendo esse
// estado e mostrando um erro mesmo com a ação já concluída com sucesso.
// ---------------------------------------------
function AreaProtegida() {
  return (
    <Routes>
      <Route path="/entrar" element={<TelaDeEntrada />} />
      <Route
        path="/cadastrar"
        element={<TelaDeCadastro cliente={apiClient} />}
      />
      <Route
        path="/verificar-email"
        element={<TelaDeVerificacaoDeEmail cliente={apiClient} />}
      />
      <Route
        path="/reenviar-verificacao"
        element={<TelaDeReenviarVerificacao cliente={apiClient} />}
      />
      <Route
        path="/esqueci-senha"
        element={<TelaDeEsqueciSenha cliente={apiClient} />}
      />
      <Route
        path="/redefinir-senha"
        element={<TelaDeRedefinirSenha cliente={apiClient} />}
      />

      <Route element={<AreaComCarrinho />}>
        <Route element={<LayoutDaLoja />}>
          <Route path="/" element={<TelaInicial cliente={apiClient} />} />
          <Route
            path="/produtos"
            element={<TelaDeProdutos cliente={apiClient} />}
          />
          <Route
            path="/produtos/:id"
            element={<TelaDeDetalheDoProduto cliente={apiClient} />}
          />
          <Route
            path="/carrinho"
            element={
              <RotaProtegida>
                <TelaDeCarrinho cliente={apiClient} />
              </RotaProtegida>
            }
          />
          <Route
            path="/pedidos"
            element={
              <RotaProtegida>
                <TelaDeMeusPedidos cliente={apiClient} />
              </RotaProtegida>
            }
          />
          <Route
            path="/enderecos"
            element={
              <RotaProtegida>
                <TelaDeEnderecos cliente={apiClient} />
              </RotaProtegida>
            }
          />
          <Route
            path="/perfil"
            element={
              <RotaProtegida>
                <TelaDePerfil />
              </RotaProtegida>
            }
          />
          <Route
            path="/pedidos/:id"
            element={
              <RotaProtegida>
                <TelaDeDetalheDoPedido cliente={apiClient} />
              </RotaProtegida>
            }
          />
        </Route>
        <Route
          element={
            <RotaAdmin>
              <LayoutAdmin />
            </RotaAdmin>
          }
        >
          <Route
            path="/admin"
            element={<TelaDeDashboardAdmin cliente={apiClient} />}
          />
          <Route
            path="/admin/pedidos"
            element={<TelaDePedidosAdmin cliente={apiClient} />}
          />
          <Route
            path="/admin/pedidos/:id"
            element={
              <TelaDeDetalheDoPedido cliente={apiClient} contexto="admin" />
            }
          />
          <Route
            path="/admin/produtos"
            element={<TelaDeProdutosAdmin cliente={apiClient} />}
          />
          <Route
            path="/admin/produtos/novo"
            element={<TelaDeFormularioDeProdutoAdmin cliente={apiClient} />}
          />
          <Route
            path="/admin/produtos/:id/editar"
            element={<TelaDeFormularioDeProdutoAdmin cliente={apiClient} />}
          />
          <Route
            path="/admin/categorias"
            element={<TelaDeCategoriasAdmin cliente={apiClient} />}
          />
          <Route
            path="/admin/categorias/novo"
            element={<TelaDeFormularioDeCategoriaAdmin cliente={apiClient} />}
          />
          <Route
            path="/admin/categorias/:id/editar"
            element={<TelaDeFormularioDeCategoriaAdmin cliente={apiClient} />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ---------------------------------------------
// Layout do carrinho por identidade
// Ver o comentário de AreaProtegida — isolado numa rota de layout própria
// para que só as rotas protegidas/admin fiquem sob a key de identidade.
// ---------------------------------------------
function AreaComCarrinho() {
  const { usuario } = useSessao();

  return (
    <ProvedorDoCarrinho key={usuario?.id ?? 'anonimo'}>
      <Outlet />
    </ProvedorDoCarrinho>
  );
}
