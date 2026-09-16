import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, type ApiClient } from '../api/cliente';
import { sacudir } from '../motion/tokens';
import { useAnimacaoDeErro } from '../motion/use-animacao-de-erro';
import { Aviso, Botao, Campo } from '../ui/indice';
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
        <p className="text-center text-base text-tinta-media">
          <Link
            className="inline-flex min-h-12 items-center font-semibold text-acento underline underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
            to="/entrar"
          >
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
        className="flex flex-col gap-6"
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
          spellCheck={false}
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          required
        />

        <Botao type="submit" bloco carregando={enviando}>
          {enviando ? 'Enviando…' : 'Reenviar verificação'}
        </Botao>
      </motion.form>

      <p className="text-center text-base text-tinta-media">
        Já confirmou?{' '}
        <Link
          className="inline-flex min-h-12 items-center font-semibold text-acento underline underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
          to="/entrar"
        >
          Entrar
        </Link>
      </p>
    </LayoutDeAutenticacao>
  );
}
