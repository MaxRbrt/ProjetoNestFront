import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, type ApiClient } from '../api/cliente';
import { sacudir } from '../motion/tokens';
import { useAnimacaoDeErro } from '../motion/use-animacao-de-erro';
import { Aviso, Botao, Campo } from '../ui/indice';
import { LayoutDeAutenticacao } from './layout-de-autenticacao';

interface PropsDaTela {
  cliente: ApiClient;
}

// ---------------------------------------------
// Mensagem de token inválido/expirado
// Texto exato usado pelo backend (INVALID_ACTION_TOKEN em
// tokens-de-acao.service.ts) para token inexistente, expirado ou já
// consumido — é o único caso em que reapresentar o formulário é inútil
// (o token não muda entre tentativas). Qualquer outro erro (senha fora da
// política, rede) é recuperável: mantém o formulário, deixa tentar de novo.
// Revisão adversarial (Codex) encontrou o formulário sendo descartado para
// TODO erro, inclusive senha inválida — usuário não conseguia corrigir.
// ---------------------------------------------
const TOKEN_INVALIDO_OU_EXPIRADO = 'O token é inválido ou expirou.';

// ---------------------------------------------
// Leitura do token no fragmento da URL
// Mesmo motivo de TelaDeVerificacaoDeEmail: o backend manda o link como
// .../redefinir-senha#token=XYZ para o token nunca sair do navegador rumo ao
// servidor HTTP. A leitura é de window.location.hash, com ?token= como
// caminho alternativo para quem testar o link colando manualmente.
// ---------------------------------------------
function lerTokenDoFragmento(): string | null {
  const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return fragmento.get('token');
}

// ---------------------------------------------
// Tela de redefinição de senha
// O token não muda entre tentativas — ele vem da URL, não de um campo do
// formulário —, então uma falha (expirado/já usado/inválido) manda para
// pedir um novo link em vez de oferecer "tentar de novo" com o mesmo token.
//
// Ao contrário de TelaDeVerificacaoDeEmail, a URL não é limpa ao montar: o
// fragmento nunca é enviado ao servidor de qualquer forma (é assim que ele
// protege o token desde a origem), então limpar cedo só teria valor
// cosmético — e tentar fazer isso via useEffect no mount reintroduz um bug
// real: o StrictMode do React, em desenvolvimento, desmonta e remonta o
// componente uma vez logo após o primeiro efeito rodar, recriando os hooks
// do zero. Se esse primeiro efeito já tivesse apagado o hash, o segundo
// mount releria a URL (agora vazia) e perderia o token antes do usuário
// sequer ver o formulário. A limpeza cosmética só acontece depois do envio
// bem-sucedido, quando não há mais remount de StrictMode pela frente.
//
// O token entra num useState com inicializador preguiçoso — computado uma
// vez e mantido — porque a limpeza pós-sucesso reescreve a URL e dispara um
// novo render; se o token fosse recalculado a cada render (const simples),
// esse render pós-sucesso releria a URL já vazia e voltaria a cair no
// branch de "link incompleto" em vez do de sucesso.
// ---------------------------------------------
export function TelaDeRedefinirSenha({ cliente }: PropsDaTela) {
  const [parametros] = useSearchParams();
  const [token] = useState(
    () => lerTokenDoFragmento() ?? parametros.get('token'),
  );

  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [tokenInvalido, setTokenInvalido] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const { controle: controleDoErro, sacudirAgora } = useAnimacaoDeErro();

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!token) return;
    setErro(null);
    setEnviando(true);

    try {
      await cliente.post('/auth/reset-password', { token, novaSenha });
      window.history.replaceState(null, '', window.location.pathname);
      setConcluido(true);
    } catch (falha) {
      const mensagem =
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível redefinir sua senha agora. Tente de novo.';

      if (mensagem === TOKEN_INVALIDO_OU_EXPIRADO) {
        setTokenInvalido(true);
      } else {
        setErro(mensagem);
        sacudirAgora();
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!token || tokenInvalido) {
    return (
      <LayoutDeAutenticacao titulo="Não deu certo">
        <Aviso>
          {token
            ? 'O link pode ter expirado ou já ter sido usado.'
            : 'O link de redefinição está incompleto.'}
        </Aviso>
        <p className="text-center text-sm text-tinta-suave">
          <Link
            className="font-semibold text-acento hover:underline underline-offset-4"
            to="/esqueci-senha"
          >
            Pedir um novo link
          </Link>
        </p>
      </LayoutDeAutenticacao>
    );
  }

  if (concluido) {
    return (
      <LayoutDeAutenticacao titulo="Senha redefinida">
        <Aviso tipo="sucesso">
          Sua senha foi alterada. Agora você já pode entrar com ela.
        </Aviso>
        <p className="text-center text-sm text-tinta-suave">
          <Link
            className="font-semibold text-acento hover:underline underline-offset-4"
            to="/entrar"
          >
            Ir para a entrada
          </Link>
        </p>
      </LayoutDeAutenticacao>
    );
  }

  return (
    <LayoutDeAutenticacao
      titulo="Redefinir senha"
      subtitulo="Escolha uma nova senha para sua conta."
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
          rotulo="Nova senha"
          type="password"
          name="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          ajuda="Use ao menos uma letra maiúscula, um número e um símbolo. Frases longas são mais seguras que senhas curtas complicadas."
          value={novaSenha}
          onChange={(evento) => setNovaSenha(evento.target.value)}
          required
        />

        <Botao type="submit" bloco carregando={enviando}>
          {enviando ? 'Redefinindo…' : 'Redefinir senha'}
        </Botao>
      </motion.form>
    </LayoutDeAutenticacao>
  );
}
