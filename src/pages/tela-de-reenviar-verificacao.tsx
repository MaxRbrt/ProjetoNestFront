import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, type ApiClient } from '../api/cliente';
import { Aviso, Botao, Campo } from '../components/primitivos';
import { sacudir } from '../motion/tokens';
import { useAnimacaoDeErro } from '../motion/use-animacao-de-erro';
import { LayoutDeAutenticacao } from './layout-de-autenticacao';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Tela de reenvio de verificação de email
// Mesmo espírito de TelaDeEsqueciSenha: a confirmação é sempre a mesma frase
// genérica, exista ou não a conta, e mesmo que ela já esteja verificada — o
// backend responde o aceite genérico de propósito, e detalhar aqui recriaria
// a enumeração no cliente.
// ---------------------------------------------
export function TelaDeReenviarVerificacao({ cliente }: PropsDaTela) {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const { controle: controleDoErro, sacudirAgora } = useAnimacaoDeErro();

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await cliente.post('/auth/resend-verification', { email });
      setEnviado(true);
    } catch (falha) {
      const mensagem =
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível enviar agora. Tente de novo.';
      setErro(mensagem);
      sacudirAgora();
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <LayoutDeAutenticacao
        titulo="Confira seu email"
        subtitulo="Falta um passo para ativar sua conta."
      >
        <Aviso tipo="sucesso">
          Se os dados forem elegíveis, você receberá as instruções por email.
        </Aviso>
        <p className="formulario__rodape">
          <Link className="formulario__link" to="/entrar">
            Voltar para a entrada
          </Link>
        </p>
      </LayoutDeAutenticacao>
    );
  }

  return (
    <LayoutDeAutenticacao
      titulo="Reenviar verificação"
      subtitulo="Informe seu email para receber um novo link de confirmação."
    >
      <motion.form
        className="formulario__campos"
        onSubmit={aoEnviar}
        variants={sacudir}
        animate={controleDoErro}
        noValidate
      >
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

        <Botao type="submit" bloco carregando={enviando}>
          {enviando ? 'Enviando…' : 'Reenviar verificação'}
        </Botao>
      </motion.form>

      <p className="formulario__rodape">
        Já confirmou?{' '}
        <Link className="formulario__link" to="/entrar">
          Entrar
        </Link>
      </p>
    </LayoutDeAutenticacao>
  );
}
