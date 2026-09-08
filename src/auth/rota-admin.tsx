import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { TelaDeVerificacao } from './rota-protegida';
import { useSessao } from './contexto-de-sessao';

interface PropsDaRotaAdmin {
  children: ReactNode;
}

// ---------------------------------------------
// Rota restrita a administrador
// Cliente autenticado sem o papel vai para "/", não para "/entrar": a pessoa
// já provou quem é, só não tem permissão — mandar para o login descreveria
// errado o motivo do bloqueio. O estado de verificação é tratado antes de
// qualquer decisão, pelo mesmo motivo de RotaProtegida: sem esse terceiro
// estado, recarregar a página com sessão válida piscaria a tela errada.
// ---------------------------------------------
export function RotaAdmin({ children }: PropsDaRotaAdmin) {
  const { situacao, usuario } = useSessao();
  const local = useLocation();

  if (situacao === 'verificando') {
    return <TelaDeVerificacao />;
  }

  if (situacao === 'anonimo') {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }

  if (usuario?.papel !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
