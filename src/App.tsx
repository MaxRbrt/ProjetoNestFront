import { MotionConfig } from 'motion/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { apiClient } from './api/instancia';
import { RotaAdmin } from './auth/rota-admin';
import { RotaProtegida } from './auth/rota-protegida';
import { ProvedorDeSessao } from './auth/contexto-de-sessao';
import { TelaDeFormularioDeCategoriaAdmin } from './pages/admin/tela-de-formulario-de-categoria-admin';
import { TelaDeCategoriasAdmin } from './pages/admin/tela-de-categorias-admin';
import { TelaDeDashboardAdmin } from './pages/admin/tela-de-dashboard-admin';
import { LayoutAdmin } from './pages/admin/layout-admin';
import { TelaDeFormularioDeProdutoAdmin } from './pages/admin/tela-de-formulario-de-produto-admin';
import { TelaDeProdutosAdmin } from './pages/admin/tela-de-produtos-admin';
import { TelaInicial } from './pages/tela-inicial';
import { TelaDeEntrada } from './pages/tela-de-entrada';
import { TelaDeDetalheDoProduto } from './pages/products/tela-de-detalhe-do-produto';
import { TelaDeProdutos } from './pages/products/tela-de-produtos';
import { TelaDeCadastro } from './pages/tela-de-cadastro';
import { TelaDeVerificacaoDeEmail } from './pages/tela-de-verificacao-de-email';

// ---------------------------------------------
// Raiz da aplicação
// O provedor de sessão envolve o roteador inteiro: as rotas precisam saber se
// a verificação ainda está em curso antes de decidir o que renderizar, senão
// quem recarrega a página autenticado vê a tela de entrada piscar.
// O reducedMotion="user" do MotionConfig é obrigatório: o CSS já respeita a
// preferência do sistema, mas as animações do Motion rodam por JavaScript e
// ignoravam esse ajuste — quem pediu menos movimento continuava recebendo tudo.
// ---------------------------------------------
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ProvedorDeSessao cliente={apiClient}>
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
              path="/"
              element={
                <RotaProtegida>
                  <TelaInicial />
                </RotaProtegida>
              }
            />
            <Route
              path="/produtos"
              element={
                <RotaProtegida>
                  <TelaDeProdutos cliente={apiClient} />
                </RotaProtegida>
              }
            />
            <Route
              path="/produtos/:id"
              element={
                <RotaProtegida>
                  <TelaDeDetalheDoProduto cliente={apiClient} />
                </RotaProtegida>
              }
            />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProvedorDeSessao>
      </BrowserRouter>
    </MotionConfig>
  );
}
