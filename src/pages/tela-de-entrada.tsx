import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/cliente';
import { useSessao } from '../auth/contexto-de-sessao';
import { Aviso, Botao, Campo } from '../components/primitivos';
import { sacudir } from '../motion/tokens';
import { useAnimacaoDeErro } from '../motion/use-animacao-de-erro';
import { LayoutDeAutenticacao } from './layout-de-autenticacao';

interface LocalDeOrigem {
  de?: string;
}

// ---------------------------------------------
// Tela de entrada
// A mensagem de erro vem da API sem tradução nem enriquecimento: o backend
// responde de propósito a mesma frase para email inexistente e senha errada,
// e detalhar aqui recriaria no cliente a enumeração de contas que ele evita.
// A animação de erro é disparada de forma imperativa para recomeçar mesmo
// quando a mensagem é idêntica à da tentativa anterior, sem remontar o
// formulário — que apagaria o que o usuário digitou.
// ---------------------------------------------
export function TelaDeEntrada() {
  const { entrar, saidaNaoConfirmada } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { controle: controleDoErro, sacudirAgora } = useAnimacaoDeErro();

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await entrar(email, senha);
      const destino = (local.state as LocalDeOrigem | null)?.de ?? '/';
      navegar(destino, { replace: true });
    } catch (falha) {
      const mensagem =
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível entrar agora. Tente de novo.';
      setErro(mensagem);
      sacudirAgora();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutDeAutenticacao
      titulo="Entrar"
      subtitulo="Acesse sua conta para acompanhar seus pedidos."
    >
      <motion.form
        className="formulario__campos"
        onSubmit={aoEnviar}
        variants={sacudir}
        animate={controleDoErro}
        noValidate
      >
        {saidaNaoConfirmada ? (
          <Aviso>
            Não foi possível confirmar a saída no servidor. Entre novamente
            para encerrar a sessão anterior com segurança.
          </Aviso>
        ) : null}

        {erro ? <Aviso>{erro}</Aviso> : null}

        <Campo
          rotulo="Email"
          type="email"
          name="email"
          placeholder="voce@exemplo.com"
          autoComplete="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          required
        />

        <Campo
          rotulo="Senha"
          type="password"
          name="password"
          placeholder="Sua senha"
          autoComplete="current-password"
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          required
        />

        <Botao type="submit" bloco carregando={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>

        <Link className="formulario__link" to="/esqueci-senha">
          Esqueceu sua senha?
        </Link>
      </motion.form>

      <p className="formulario__rodape">
        Ainda não tem conta?{' '}
        <Link className="formulario__link" to="/cadastrar">
          Cadastre-se
        </Link>
      </p>
    </LayoutDeAutenticacao>
  );
}
