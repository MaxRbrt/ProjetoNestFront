import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import './ui.css';

interface PropsDoBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario';
  bloco?: boolean;
  carregando?: boolean;
}

// ---------------------------------------------
// Botão
// Enquanto carrega, continua exibindo o próprio texto ao lado do aviso de
// progresso: trocar o rótulo por "Enviando..." faz o botão mudar de largura e
// a linha inteira saltar, além de esconder o que a ação fazia.
// ---------------------------------------------
export function Botao({
  variante = 'primario',
  bloco = false,
  carregando = false,
  disabled,
  children,
  className,
  ...resto
}: PropsDoBotao) {
  const classes = [
    'botao',
    variante === 'secundario' ? 'botao--secundario' : '',
    bloco ? 'botao--bloco' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...resto}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando}
    >
      {children}
    </button>
  );
}

interface PropsDoCampo extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
  ajuda?: string;
}

// ---------------------------------------------
// Campo de texto
// O erro e o texto de ajuda são ligados ao campo por aria-describedby e o
// erro marca aria-invalid, para que o leitor de tela anuncie o problema junto
// com o campo — cor sozinha não comunica nada a quem não a enxerga. Quando há
// erro, ele substitui a ajuda na descrição: anunciar os dois faria o usuário
// ouvir a regra inteira antes de saber o que errou.
// ---------------------------------------------
export function Campo({ rotulo, erro, ajuda, id, ...resto }: PropsDoCampo) {
  const idGerado = useId();
  const idDoCampo = id ?? idGerado;
  const idDoErro = `${idDoCampo}-erro`;
  const idDaAjuda = `${idDoCampo}-ajuda`;

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={idDoCampo}>
        {rotulo}
      </label>
      <input
        {...resto}
        id={idDoCampo}
        className="campo__entrada"
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={erro ? idDoErro : ajuda ? idDaAjuda : undefined}
      />
      {erro ? (
        <span className="campo__erro" id={idDoErro}>
          {erro}
        </span>
      ) : ajuda ? (
        <span className="campo__ajuda" id={idDaAjuda}>
          {ajuda}
        </span>
      ) : null}
    </div>
  );
}

interface PropsDoAviso {
  children: React.ReactNode;
  tipo?: 'erro' | 'sucesso';
}

// ---------------------------------------------
// Aviso
// role="alert" faz o leitor de tela anunciar a mensagem assim que ela aparece,
// sem esperar o usuário navegar até ela.
// ---------------------------------------------
export function Aviso({ children, tipo = 'erro' }: PropsDoAviso) {
  return (
    <p
      className={`aviso ${tipo === 'sucesso' ? 'aviso--sucesso' : ''}`}
      role="alert"
    >
      {children}
    </p>
  );
}
