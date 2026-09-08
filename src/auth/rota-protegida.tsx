import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSessao } from './contexto-de-sessao';

interface PropsDaRotaProtegida {
  children: ReactNode;
}

// ---------------------------------------------
// Rota protegida
// Enquanto a sessão está sendo verificada, nada é decidido: redirecionar aqui
// mandaria para o login todo usuário que recarregasse a página com sessão
// válida, porque o cookie ainda não foi trocado por um token.
// ---------------------------------------------
export function RotaProtegida({ children }: PropsDaRotaProtegida) {
  const { situacao } = useSessao();
  const local = useLocation();

  if (situacao === 'verificando') {
    return <TelaDeVerificacao />;
  }

  if (situacao === 'anonimo') {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }

  return <>{children}</>;
}

// ---------------------------------------------
// Espera da verificação de sessão
// Pontos pulsando em sequência, sem barra de progresso: a duração da resposta
// é desconhecida, e uma barra prometeria um avanço que não há como medir.
// ---------------------------------------------
export function TelaDeVerificacao() {
  return (
    <div className="verificacao" role="status" aria-live="polite">
      <span className="verificacao__pontos" aria-hidden="true">
        <span className="verificacao__ponto" />
        <span className="verificacao__ponto" />
        <span className="verificacao__ponto" />
      </span>
      <span className="verificacao__texto">Verificando sessão…</span>
    </div>
  );
}
