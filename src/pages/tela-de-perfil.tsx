import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSessao } from '../auth/contexto-de-sessao';
import { CabecalhoDaPagina } from '../layout/cabecalho-da-pagina';
import { Botao, Cartao, Etiqueta, Esqueleto } from '../ui/indice';

const FORMATADOR_DE_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const ATALHOS = [
  {
    para: '/pedidos',
    rotulo: 'Meus pedidos',
    descricao: 'Situação e detalhes das compras',
  },
  {
    para: '/enderecos',
    rotulo: 'Meus endereços',
    descricao: 'Onde você recebe os pedidos',
  },
  { para: '/produtos', rotulo: 'Voltar ao catálogo', descricao: 'Ver produtos' },
];

export function TelaDePerfil() {
  const { situacao, usuario } = useSessao();
  const [mostrarEmail, setMostrarEmail] = useState(false);

  if (situacao === 'verificando') {
    return (
      <div
        role="status"
        aria-label="Carregando perfil"
        className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <Esqueleto className="h-64 w-full" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/entrar" replace state={{ de: '/perfil' }} />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <CabecalhoDaPagina
        trilha={[{ rotulo: 'Início', para: '/' }, { rotulo: 'Meu perfil' }]}
        titulo="Meu perfil"
        descricao="Estas são as informações da sua conta."
      />

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Cartao
          como="section"
          aria-labelledby="dados-da-conta"
          className="lg:col-span-2"
        >
          <h2 id="dados-da-conta" className="text-xl font-bold text-tinta">
            Dados da conta
          </h2>
          <dl className="mt-4 divide-y divide-borda">
            <div className="pb-5">
              <dt className="text-lg font-semibold text-tinta">Email</dt>
              <dd className="mt-2">
                <p
                  id="email-do-perfil"
                  className="mb-3 break-all text-lg text-tinta-media"
                >
                  {mostrarEmail ? usuario.email : 'Email oculto por privacidade.'}
                </p>
                <Botao
                  type="button"
                  variante="secundario"
                  tamanho="pequeno"
                  aria-expanded={mostrarEmail}
                  aria-controls="email-do-perfil"
                  onClick={() => setMostrarEmail(!mostrarEmail)}
                >
                  {mostrarEmail ? 'Ocultar email' : 'Mostrar email'}
                </Botao>
              </dd>
            </div>
            <div className="py-5">
              <dt className="text-lg font-semibold text-tinta">Tipo de conta</dt>
              <dd className="mt-2">
                <Etiqueta tom={usuario.papel === 'ADMIN' ? 'acento' : 'neutro'}>
                  {usuario.papel}
                </Etiqueta>
              </dd>
            </div>
            <div className="py-5">
              <dt className="text-lg font-semibold text-tinta">
                Verificação de email
              </dt>
              <dd className="mt-2">
                <Etiqueta tom={usuario.emailVerificado ? 'sucesso' : 'aviso'}>
                  {usuario.emailVerificado
                    ? 'Email verificado'
                    : 'Email não verificado'}
                </Etiqueta>
              </dd>
            </div>
            <div className="pt-5">
              <dt className="text-lg font-semibold text-tinta">
                Conta criada em
              </dt>
              <dd className="mt-2 text-lg text-tinta">
                {FORMATADOR_DE_DATA.format(new Date(usuario.criadoEm))}
              </dd>
            </div>
          </dl>
        </Cartao>

        <Cartao como="nav" aria-labelledby="atalhos-da-conta">
          <h2 id="atalhos-da-conta" className="text-xl font-bold text-tinta">
            Sua conta
          </h2>
          <ul className="mt-3 flex flex-col">
            {ATALHOS.map(({ para, rotulo, descricao }) => (
              <li key={para}>
                <Link
                  to={para}
                  className="-mx-3 flex min-h-12 flex-col justify-center rounded-pequeno px-3 py-2.5 hover:bg-superficie-sutil focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                >
                  <span className="text-lg font-semibold text-tinta underline decoration-borda-forte underline-offset-4">
                    {rotulo}
                  </span>
                  <span className="text-base text-tinta-media">{descricao}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </div>
  );
}
