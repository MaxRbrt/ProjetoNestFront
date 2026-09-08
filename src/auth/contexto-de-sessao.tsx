import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ApiClient,
  SessaoAutenticada,
  UsuarioPublico,
} from '../api/cliente';

// ---------------------------------------------
// Situação da sessão
// "verificando" é um estado próprio, não um booleano falso: ao abrir a
// aplicação ainda não se sabe se existe cookie de sessão válido. Sem esse
// terceiro estado, a tela de login pisca para quem já estava autenticado.
// ---------------------------------------------
export type SituacaoDaSessao = 'verificando' | 'autenticado' | 'anonimo';

interface ValorDaSessao {
  situacao: SituacaoDaSessao;
  usuario: UsuarioPublico | null;
  /** Verdadeiro quando o servidor não confirmou o encerramento da sessão. */
  saidaNaoConfirmada: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const SessaoContext = createContext<ValorDaSessao | null>(null);

// ---------------------------------------------
// Marca de saída pendente
// Se o servidor não confirmar o logout, o cookie httpOnly continua no
// navegador e o JavaScript não consegue apagá-lo. Sem esta marca, o próximo
// carregamento recuperaria a sessão e o usuário voltaria autenticado depois
// de ter pedido para sair — o pior desfecho num computador compartilhado.
// Fica em localStorage, não sessionStorage: a marca precisa valer para
// qualquer aba nova aberta no mesmo navegador, não só para quem originou o
// logout — sessionStorage é isolado por aba e deixaria uma aba nova recuperar
// a sessão do usuário anterior enquanto o cookie ainda não expirou. Não é
// segredo, só um booleano, então não piora exposição a XSS.
// ---------------------------------------------
const CHAVE_SAIDA_PENDENTE = 'saida-pendente';

function lerSaidaPendente(): boolean {
  try {
    return localStorage.getItem(CHAVE_SAIDA_PENDENTE) === '1';
  } catch {
    return false;
  }
}

// ---------------------------------------------
// Marcação de saída pendente
// O catch é vazio de propósito: armazenamento pode estar indisponível (aba
// anônima, por exemplo) e a sessão segue funcionando — só a proteção extra do
// logout deixa de se aplicar. Falhar aqui quebraria o login por um recurso
// acessório.
// ---------------------------------------------
function gravarSaidaPendente(pendente: boolean): void {
  try {
    if (pendente) {
      localStorage.setItem(CHAVE_SAIDA_PENDENTE, '1');
    } else {
      localStorage.removeItem(CHAVE_SAIDA_PENDENTE);
    }
  } catch {
    /* vazio de propósito — ver bloco acima */
  }
}

interface PropsDoProvedor {
  cliente: ApiClient;
  children: ReactNode;
}

// ---------------------------------------------
// Provedor de sessão
// Assina os eventos do cliente em vez de espelhar o estado por conta própria:
// a renovação automática acontece dentro do cliente, e sem a assinatura uma
// falha lá deixaria o token nulo enquanto a interface seguiria exibindo o
// usuário como autenticado.
// ---------------------------------------------
export function ProvedorDeSessao({ cliente, children }: PropsDoProvedor) {
  const [situacao, setSituacao] = useState<SituacaoDaSessao>('verificando');
  const [usuario, setUsuario] = useState<UsuarioPublico | null>(null);
  const [saidaNaoConfirmada, setSaidaNaoConfirmada] = useState(false);
  const jaVerificou = useRef(false);

  // ---------------------------------------------
  // Sincronização com o cliente HTTP
  // Cobre tanto a renovação automática desta aba quanto os eventos que chegam
  // de outra aba pelo canal de transmissão.
  // ---------------------------------------------
  useEffect(() => {
    return cliente.aoMudarSessao((evento) => {
      if (evento.tipo === 'renovada') {
        setUsuario(evento.sessao.usuario);
        setSituacao('autenticado');
        return;
      }
      setUsuario(null);
      setSituacao('anonimo');
    });
  }, [cliente]);

  // ---------------------------------------------
  // Recuperação da sessão a partir do cookie
  // A trava de execução única já basta, e o efeito deliberadamente não
  // cancela nada na limpeza: no modo estrito o React monta, desmonta e monta
  // de novo, então um sinalizador de "ainda montado" seria desligado pela
  // primeira desmontagem e faria a resposta ser descartada — a tela ficaria
  // presa em "verificando" para sempre.
  //
  // Uma saída não confirmada impede a recuperação: o cookie pode continuar
  // válido no servidor, e recuperá-lo desfaria o logout que o usuário pediu.
  // ---------------------------------------------
  useEffect(() => {
    if (jaVerificou.current) {
      return;
    }
    jaVerificou.current = true;

    if (lerSaidaPendente()) {
      setSaidaNaoConfirmada(true);
      setSituacao('anonimo');
      return;
    }

    cliente
      .recuperarSessao()
      .catch(() => {
        setUsuario(null);
        setSituacao('anonimo');
      });
  }, [cliente]);

  // ---------------------------------------------
  // Entrada na sessão
  // Entrar de novo cancela qualquer saída pendente: a sessão anterior deixou
  // de importar, e esta é uma decisão explícita do usuário.
  // ---------------------------------------------
  const entrar = useCallback(
    async (email: string, senha: string) => {
      const sessao = await cliente.post<SessaoAutenticada>('/auth/login', {
        email,
        senha,
      });
      gravarSaidaPendente(false);
      setSaidaNaoConfirmada(false);
      cliente.definirSessao(sessao);
    },
    [cliente],
  );

  // ---------------------------------------------
  // Encerramento de sessão
  // O estado local é limpo mesmo se a chamada ao servidor falhar: manter o
  // usuário aparentemente logado depois de ele pedir para sair é pior do que
  // uma sessão órfã no backend. Mas a falha não é escondida — fica registrada
  // para bloquear a recuperação automática e para a interface poder avisar.
  // ---------------------------------------------
  const sair = useCallback(async () => {
    gravarSaidaPendente(true);
    try {
      await cliente.post('/auth/logout');
      gravarSaidaPendente(false);
      setSaidaNaoConfirmada(false);
    } catch {
      setSaidaNaoConfirmada(true);
    } finally {
      cliente.limparSessao();
    }
  }, [cliente]);

  const valor = useMemo<ValorDaSessao>(
    () => ({ situacao, usuario, saidaNaoConfirmada, entrar, sair }),
    [situacao, usuario, saidaNaoConfirmada, entrar, sair],
  );

  return (
    <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>
  );
}

export function useSessao(): ValorDaSessao {
  const valor = useContext(SessaoContext);
  if (!valor) {
    throw new Error('useSessao precisa estar dentro de ProvedorDeSessao.');
  }
  return valor;
}
