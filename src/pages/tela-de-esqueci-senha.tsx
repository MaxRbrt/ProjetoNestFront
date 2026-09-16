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
// Tela de esqueci minha senha
// A confirmação é sempre a mesma frase genérica, exista ou não a conta: o
// backend responde de propósito o aceite genérico para não revelar quais
// emails têm cadastro, e detalhar aqui recriaria essa enumeração no cliente.
// ---------------------------------------------
export function TelaDeEsqueciSenha({ cliente }: PropsDaTela) {
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
      await cliente.post('/auth/forgot-password', { email });
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
        subtitulo="Enviamos as instruções, se a conta existir."
      >
        <Aviso tipo="sucesso">
          Se o email informado tiver uma conta, você vai receber um link para
          redefinir sua senha.
        </Aviso>
        <p className="text-center text-sm text-tinta-suave">
          <Link
            className="font-semibold text-acento hover:underline underline-offset-4"
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
      titulo="Esqueceu sua senha?"
      subtitulo="Informe seu email para receber as instruções de redefinição."
    >
      <motion.form
        className="flex flex-col gap-4"
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
          {enviando ? 'Enviando…' : 'Enviar instruções'}
        </Botao>
      </motion.form>

      <p className="text-center text-sm text-tinta-suave">
        Lembrou a senha?{' '}
        <Link
          className="font-semibold text-acento hover:underline underline-offset-4"
          to="/entrar"
        >
          Entrar
        </Link>
      </p>
    </LayoutDeAutenticacao>
  );
}
