import { useRef, useState, type FormEvent } from 'react';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import {
  atualizarEndereco,
  criarEndereco,
  removerEndereco,
  type DadosDeEndereco,
  type Endereco,
} from '../../api/enderecos';
import { useEnderecos } from '../../hooks/use-enderecos';
import { CabecalhoDaPagina } from '../../layout/cabecalho-da-pagina';
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Esqueleto,
  Etiqueta,
  Selecao,
} from '../../ui/indice';
import { UFS_VALIDAS } from './ufs';

interface PropsDaTela {
  cliente: ApiClient;
}

const FORMULARIO_VAZIO: DadosDeEndereco = {
  apelido: '',
  destinatario: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

// ---------------------------------------------
// Tela de endereços
// Lista inteira de uma vez, sem paginação — ninguém cadastra dezenas de
// endereços de entrega. Um único formulário serve tanto para criar quanto
// para editar: idEmEdicao null significa criação, um número significa qual
// endereço está sendo editado. Erro de carga (listar, via useEnderecos) e
// erro de ação (salvar/remover/marcar principal) ficam separados, mesmo
// critério já usado no carrinho e no detalhe de pedido — um erro ao salvar
// não pode esconder a lista que o usuário precisa ver para tentar de novo.
// Marcar principal e remover agem direto na lista, sem abrir o formulário.
// ---------------------------------------------
export function TelaDeEnderecos({ cliente }: PropsDaTela) {
  const { enderecos, carregando, erroDeCarga, recarregar } =
    useEnderecos(cliente);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState<string | null>(
    null,
  );
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [idEmEdicao, setIdEmEdicao] = useState<number | null>(null);
  const [formulario, setFormulario] =
    useState<DadosDeEndereco>(FORMULARIO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const tituloDaPagina = useRef<HTMLHeadingElement>(null);

  function abrirParaCriar() {
    setMensagemDeSucesso(null);
    setIdEmEdicao(null);
    setFormulario(FORMULARIO_VAZIO);
    setErroDeAcao(null);
    setMostrarFormulario(true);
  }

  function abrirParaEditar(endereco: Endereco) {
    setMensagemDeSucesso(null);
    setIdEmEdicao(endereco.id);
    setFormulario({
      apelido: endereco.apelido,
      destinatario: endereco.destinatario,
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      complemento: endereco.complemento ?? '',
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.uf,
    });
    setErroDeAcao(null);
    setMostrarFormulario(true);
  }

  async function aoSalvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setMensagemDeSucesso(null);
    setErroDeAcao(null);
    setSalvando(true);
    try {
      if (idEmEdicao === null) {
        await criarEndereco(cliente, formulario);
      } else {
        await atualizarEndereco(cliente, idEmEdicao, formulario);
      }
      setMensagemDeSucesso('Endereço salvo com sucesso.');
      setMostrarFormulario(false);
      tituloDaPagina.current?.focus();
      await recarregar();
    } catch (falha) {
      setErroDeAcao(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível salvar o endereço agora.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aoMarcarPrincipal(id: number) {
    setMensagemDeSucesso(null);
    setErroDeAcao(null);
    try {
      await atualizarEndereco(cliente, id, { principal: true });
      setMensagemDeSucesso('Endereço principal atualizado.');
      await recarregar();
    } catch (falha) {
      setErroDeAcao(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível marcar este endereço como principal.',
      );
    }
  }

  async function aoRemover(id: number) {
    if (!window.confirm('Remover este endereço?')) return;
    setMensagemDeSucesso(null);
    setErroDeAcao(null);
    try {
      await removerEndereco(cliente, id);
      setMensagemDeSucesso('Endereço removido.');
      await recarregar();
    } catch (falha) {
      setErroDeAcao(
        falha instanceof ApiError
          ? falha.message
          : 'Não foi possível remover este endereço agora.',
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <CabecalhoDaPagina
        trilha={[{ rotulo: 'Início', para: '/' }, { rotulo: 'Meus endereços' }]}
        titulo="Meus endereços"
        descricao="Cadastre e organize os locais onde deseja receber seus pedidos."
        refDoTitulo={tituloDaPagina}
        acao={
          !erroDeCarga &&
          !carregando &&
          !mostrarFormulario &&
          enderecos.length > 0 ? (
            <Botao type="button" onClick={abrirParaCriar}>
              Adicionar endereço
            </Botao>
          ) : null
        }
      />

      {mensagemDeSucesso ? (
        <div className="mt-6">
          <Aviso tipo="sucesso">{mensagemDeSucesso}</Aviso>
        </div>
      ) : null}

      {erroDeCarga ? (
        <div className="mt-6">
          <Aviso tipo="erro">{erroDeCarga}</Aviso>
          <Botao
            type="button"
            variante="secundario"
            className="mt-4"
            carregando={carregando}
            onClick={() => void recarregar()}
          >
            Tentar novamente
          </Botao>
        </div>
      ) : null}

      {!erroDeCarga && carregando ? <EsqueletoDaLista /> : null}

      {!erroDeCarga && !carregando ? (
        <>
          {erroDeAcao ? (
            <div className="mt-6">
              <Aviso tipo="erro">{erroDeAcao}</Aviso>
            </div>
          ) : null}

          {enderecos.length === 0 && !mostrarFormulario ? (
            <Cartao className="mt-8 flex flex-col items-start gap-4">
              <h2 className="text-xl font-bold text-tinta">
                Você ainda não tem nenhum endereço cadastrado.
              </h2>
              <p className="text-lg text-tinta-media">
                Cadastre um endereço para poder finalizar suas compras.
              </p>
              <Botao type="button" className="mt-2" onClick={abrirParaCriar}>
                Cadastrar endereço
              </Botao>
            </Cartao>
          ) : null}

          {enderecos.length > 0 ? (
            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {enderecos.map((endereco) => (
                <CartaoDeEndereco
                  key={endereco.id}
                  endereco={endereco}
                  aoMarcarPrincipal={() => void aoMarcarPrincipal(endereco.id)}
                  aoEditar={() => abrirParaEditar(endereco)}
                  aoRemover={() => void aoRemover(endereco.id)}
                />
              ))}
            </ul>
          ) : null}

          {mostrarFormulario ? (
            <FormularioDeEndereco
              idEmEdicao={idEmEdicao}
              formulario={formulario}
              aoAlterar={setFormulario}
              salvando={salvando}
              aoSalvar={aoSalvar}
              aoCancelar={() => {
                setMostrarFormulario(false);
                tituloDaPagina.current?.focus();
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface PropsDoCartao {
  endereco: Endereco;
  aoMarcarPrincipal: () => void;
  aoEditar: () => void;
  aoRemover: () => void;
}

function CartaoDeEndereco({
  endereco,
  aoMarcarPrincipal,
  aoEditar,
  aoRemover,
}: PropsDoCartao) {
  return (
    <Cartao como="li" className="flex min-w-0 flex-col gap-5">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-xl font-bold text-tinta">
            {endereco.apelido}
          </h2>
          {endereco.principal ? (
            <Etiqueta tom="sucesso">Principal</Etiqueta>
          ) : null}
        </div>
        <div className="mt-3 break-words text-lg leading-relaxed text-tinta-media">
          <p className="font-medium text-tinta">{endereco.destinatario}</p>
          <p>
            {endereco.logradouro}, {endereco.numero}
          </p>
          {endereco.complemento ? <p>{endereco.complemento}</p> : null}
          <p>{endereco.bairro}</p>
          <p>
            {endereco.cidade} — {endereco.uf}
          </p>
          <p>CEP {endereco.cep}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
        <Botao
          variante="secundario"
          tamanho="pequeno"
          type="button"
          onClick={aoEditar}
        >
          Editar
        </Botao>
        {!endereco.principal ? (
          <Botao
            variante="fantasma"
            tamanho="pequeno"
            type="button"
            onClick={aoMarcarPrincipal}
          >
            Tornar principal
          </Botao>
        ) : null}
        <Botao
          variante="perigo"
          tamanho="pequeno"
          type="button"
          className="ml-auto"
          onClick={aoRemover}
        >
          Remover
        </Botao>
      </div>
    </Cartao>
  );
}

interface PropsDoFormulario {
  idEmEdicao: number | null;
  formulario: DadosDeEndereco;
  aoAlterar: (formulario: DadosDeEndereco) => void;
  salvando: boolean;
  aoSalvar: (evento: FormEvent<HTMLFormElement>) => void;
  aoCancelar: () => void;
}

// ---------------------------------------------
// Formulário de endereço
// Painel destacado que serve tanto criação quanto edição. Os campos ficam
// agrupados como no restante do checkout: CEP e número em linha curta,
// logradouro em linha larga, cidade e UF lado a lado — uma coluna só no
// mobile.
// ---------------------------------------------
function FormularioDeEndereco({
  idEmEdicao,
  formulario,
  aoAlterar,
  salvando,
  aoSalvar,
  aoCancelar,
}: PropsDoFormulario) {
  return (
    <form
      className="mt-8 flex flex-col gap-2 rounded-card border border-t-4 border-borda border-t-acento bg-superficie p-5 shadow-carta sm:p-7"
      aria-labelledby="titulo-do-endereco"
      onSubmit={aoSalvar}
    >
      <h2 id="titulo-do-endereco" className="text-xl font-bold text-tinta sm:text-2xl">
        {idEmEdicao === null ? 'Novo endereço' : 'Editar endereço'}
      </h2>
      <p className="text-lg text-tinta-media">
        Preencha os dados de entrega. O complemento é opcional.
      </p>
      <fieldset
        disabled={salvando}
        className="mt-4 flex min-w-0 flex-col gap-5"
      >
        <Campo
          rotulo="Apelido"
          autoFocus
          autoComplete="section-entrega nickname"
          ajuda="Um nome para identificar este endereço."
          placeholder="Casa, trabalho…"
          value={formulario.apelido}
          onChange={(e) =>
            aoAlterar({ ...formulario, apelido: e.target.value })
          }
          required
        />
        <Campo
          rotulo="Destinatário"
          autoComplete="section-entrega shipping name"
          value={formulario.destinatario}
          onChange={(e) =>
            aoAlterar({ ...formulario, destinatario: e.target.value })
          }
          required
        />

        <Campo
          rotulo="CEP"
          autoComplete="section-entrega shipping postal-code"
          inputMode="numeric"
          placeholder="00000-000"
          value={formulario.cep}
          onChange={(e) => aoAlterar({ ...formulario, cep: e.target.value })}
          required
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Campo
            rotulo="Logradouro"
            autoComplete="section-entrega shipping address-line1"
            value={formulario.logradouro}
            onChange={(e) =>
              aoAlterar({ ...formulario, logradouro: e.target.value })
            }
            required
          />
          <Campo
            rotulo="Número"
            placeholder="123 ou S/N"
            value={formulario.numero}
            onChange={(e) =>
              aoAlterar({ ...formulario, numero: e.target.value })
            }
            required
          />
        </div>

        <Campo
          rotulo="Complemento"
          autoComplete="section-entrega shipping address-line2"
          value={formulario.complemento ?? ''}
          onChange={(e) =>
            aoAlterar({ ...formulario, complemento: e.target.value })
          }
        />
        <Campo
          rotulo="Bairro"
          value={formulario.bairro}
          onChange={(e) => aoAlterar({ ...formulario, bairro: e.target.value })}
          required
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Campo
            rotulo="Cidade"
            autoComplete="section-entrega shipping address-level2"
            value={formulario.cidade}
            onChange={(e) =>
              aoAlterar({ ...formulario, cidade: e.target.value })
            }
            required
          />
          <Selecao
            rotulo="UF"
            autoComplete="section-entrega shipping address-level1"
            value={formulario.uf}
            onChange={(e) => aoAlterar({ ...formulario, uf: e.target.value })}
            required
          >
            <option value="" disabled>
              Selecione
            </option>
            {UFS_VALIDAS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Selecao>
        </div>

        <div className="mt-1 flex flex-col gap-3 border-t border-borda pt-5 sm:flex-row">
          <Botao type="submit" carregando={salvando}>
            Salvar endereço
          </Botao>
          <Botao type="button" variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
        </div>
      </fieldset>
    </form>
  );
}

// ---------------------------------------------
// Esqueleto da lista de endereços
// Espelha o cartão real (apelido, linha de endereço, ações) para a página não
// saltar de altura quando os dados chegam.
// ---------------------------------------------
function EsqueletoDaLista() {
  return (
    <div
      role="status"
      aria-label="Carregando endereços"
      className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <Esqueleto className="h-56 w-full" />
      <Esqueleto className="h-56 w-full" />
    </div>
  );
}
