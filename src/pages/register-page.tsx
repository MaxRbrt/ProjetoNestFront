import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, type ApiClient } from '../api/client';
import { Aviso, Botao, Campo } from '../components/ui';
import { sacudir } from '../motion/tokens';
import { useAnimacaoDeErro } from '../motion/use-animacao-de-erro';
import { LayoutDeAutenticacao } from './auth-layout';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Tela de cadastro
// O sucesso não leva direto para dentro da aplicação: o backend exige
// verificação de email antes de permitir login, então a tela precisa explicar
// que falta um passo, em vez de deixar o usuário tentando entrar e falhando.
// ---------------------------------------------
export function TelaDeCadastro({ cliente }: PropsDaTela) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const { controle: controleDoErro, sacudirAgora } = useAnimacaoDeErro();

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await cliente.post('/auth/register', { email, password: senha });
      setEnviado(true);
    } catch (falha) {
      const mensagem =
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível cadastrar agora. Tente de novo.';
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
          Já confirmou?{' '}
          <Link className="formulario__link" to="/entrar">
            Entrar
          </Link>
        </p>
      </LayoutDeAutenticacao>
    );
  }

  return (
    <LayoutDeAutenticacao
      titulo="Criar conta"
      subtitulo="Leva menos de um minuto."
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

        {/* Os requisitos aparecem antes do envio, não só na mensagem de erro:
            descobrir a regra por tentativa e erro é o caminho mais curto para
            o usuário escolher a senha mínima que o formulário aceita. */}
        <Campo
          rotulo="Senha"
          type="password"
          name="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          ajuda="Use ao menos uma letra maiúscula, um número e um símbolo. Frases longas são mais seguras que senhas curtas complicadas."
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          required
        />

        <Botao type="submit" bloco carregando={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar'}
        </Botao>
      </motion.form>

      <p className="formulario__rodape">
        Já tem conta?{' '}
        <Link className="formulario__link" to="/entrar">
          Entrar
        </Link>
      </p>
    </LayoutDeAutenticacao>
  );
}
