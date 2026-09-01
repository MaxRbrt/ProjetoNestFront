import { MotionConfig } from 'motion/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { apiClient } from './api/instance';
import { RotaAdmin } from './auth/admin-route';
import { RotaProtegida } from './auth/protected-route';
import { ProvedorDeSessao } from './auth/session-context';
import { AdminCategoryFormPage } from './pages/admin/admin-category-form-page';
import { AdminCategoriesPage } from './pages/admin/admin-categories-page';
import { AdminDashboardPage } from './pages/admin/admin-dashboard-page';
import { AdminLayout } from './pages/admin/admin-layout';
import { AdminProductFormPage } from './pages/admin/admin-product-form-page';
import { AdminProductsPage } from './pages/admin/admin-products-page';
import { TelaInicial } from './pages/home-page';
import { TelaDeEntrada } from './pages/login-page';
import { TelaDeDetalheDoProduto } from './pages/products/product-detail-page';
import { TelaDeProdutos } from './pages/products/products-page';
import { TelaDeCadastro } from './pages/register-page';
import { TelaDeVerificacaoDeEmail } from './pages/verify-email-page';

// ---------------------------------------------
// Raiz da aplicação
// O provedor de sessão envolve o roteador inteiro: as rotas precisam saber se
// a verificação ainda está em curso antes de decidir o que renderizar, senão
// quem recarrega a página autenticado vê a tela de entrada piscar.
// ---------------------------------------------
export default function App() {
  return (
    // O reducedMotion="user" é obrigatório: o CSS já respeita a preferência
    // do sistema, mas as animações do Motion rodam por JavaScript e ignoravam
    // esse ajuste — quem pediu menos movimento continuava recebendo tudo.
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
                  <AdminLayout />
                </RotaAdmin>
              }
            >
              <Route
                path="/admin"
                element={<AdminDashboardPage cliente={apiClient} />}
              />
              <Route
                path="/admin/produtos"
                element={<AdminProductsPage cliente={apiClient} />}
              />
              <Route
                path="/admin/produtos/novo"
                element={<AdminProductFormPage cliente={apiClient} />}
              />
              <Route
                path="/admin/produtos/:id/editar"
                element={<AdminProductFormPage cliente={apiClient} />}
              />
              <Route
                path="/admin/categorias"
                element={<AdminCategoriesPage cliente={apiClient} />}
              />
              <Route
                path="/admin/categorias/novo"
                element={<AdminCategoryFormPage cliente={apiClient} />}
              />
              <Route
                path="/admin/categorias/:id/editar"
                element={<AdminCategoryFormPage cliente={apiClient} />}
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProvedorDeSessao>
      </BrowserRouter>
    </MotionConfig>
  );
}
