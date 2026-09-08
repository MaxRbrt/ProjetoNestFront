import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, type ApiClient } from '../api/cliente';
import { Aviso } from '../components/primitivos';
import { LayoutDeAutenticacao } from './layout-de-autenticacao';

interface PropsDaTela {
  cliente: ApiClient;
}

type SituacaoDaVerificacao = 'verificando' | 'confirmado' | 'falhou';

// ---------------------------------------------
// Leitura do token no fragmento da URL
// O backend manda o link como .../verificar-email#token=XYZ, de propósito: o
// fragmento nunca sai do navegador rumo ao servidor HTTP, então o token não
// aparece em log de acesso nem em cabeçalho de referência. Por isso a leitura
// é de window.location.hash, e não de useSearchParams — que só enxerga
// ?token=, algo que este link nunca usa.
// ---------------------------------------------
function lerTokenDoFragmento(): string | null {
  const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return fragmento.get('token');
}

// ---------------------------------------------
// Tela de verificação de email
// O token chega pela URL do email e é consumido uma única vez: a trava impede
// que a montagem dupla do modo estrito gaste o token na primeira chamada e
// receba "token inválido" na segunda, mostrando erro para quem acertou.
// O fragmento da URL é a origem real do token; a query string fica como
// caminho alternativo para quem testar o link colando ?token= manualmente. O
// token sai da barra de endereços antes da chamada: mantido ali, ele acompanha
// o histórico do navegador e vaza em cabeçalhos de referência para qualquer
// recurso que a página venha a carregar.
// ---------------------------------------------
export function TelaDeVerificacaoDeEmail({ cliente }: PropsDaTela) {
  const [parametros] = useSearchParams();
  const token = lerTokenDoFragmento() ?? parametros.get('token');

  const [situacao, setSituacao] = useState<SituacaoDaVerificacao>('verificando');
  const [erro, setErro] = useState<string | null>(null);
  const jaEnviou = useRef(false);

  useEffect(() => {
    if (jaEnviou.current) {
      return;
    }
    jaEnviou.current = true;

    if (!token) {
      setErro('O link de verificação está incompleto.');
      setSituacao('falhou');
      return;
    }

    window.history.replaceState(null, '', window.location.pathname);

    cliente
      .post('/auth/verify-email', { token })
      .then(() => setSituacao('confirmado'))
      .catch((falha: unknown) => {
        setErro(
          falha instanceof ApiError
            ? falha.message
            : 'Não foi possível verificar o email agora.',
        );
        setSituacao('falhou');
      });
  }, [cliente, token]);

  if (situacao === 'verificando') {
    return (
      <LayoutDeAutenticacao titulo="Verificando">
        <p className="formulario__rodape" role="status" aria-live="polite">
          Confirmando seu email…
        </p>
      </LayoutDeAutenticacao>
    );
  }

  if (situacao === 'confirmado') {
    return (
      <LayoutDeAutenticacao titulo="Email confirmado">
        <Aviso tipo="sucesso">
          Sua conta está verificada. Agora você já pode entrar.
        </Aviso>
        <p className="formulario__rodape">
          <Link className="formulario__link" to="/entrar">
            Ir para a entrada
          </Link>
        </p>
      </LayoutDeAutenticacao>
    );
  }

  return (
    <LayoutDeAutenticacao titulo="Não deu certo">
      <Aviso>{erro}</Aviso>
      <p className="formulario__rodape">
        O link pode ter expirado ou já ter sido usado.{' '}
        <Link className="formulario__link" to="/entrar">
          Voltar para a entrada
        </Link>
      </p>
    </LayoutDeAutenticacao>
  );
}
