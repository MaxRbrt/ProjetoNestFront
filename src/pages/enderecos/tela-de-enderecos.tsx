import { useState, type FormEvent } from 'react';
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
import { Trilha } from '../../layout/trilha';
import {
  Aviso,
  Botao,
  Campo,
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
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [idEmEdicao, setIdEmEdicao] = useState<number | null>(null);
  const [formulario, setFormulario] =
    useState<DadosDeEndereco>(FORMULARIO_VAZIO);
  const [salvando, setSalvando] = useState(false);

  function abrirParaCriar() {
    setIdEmEdicao(null);
    setFormulario(FORMULARIO_VAZIO);
    setErroDeAcao(null);
    setMostrarFormulario(true);
  }

  function abrirParaEditar(endereco: Endereco) {
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
    setErroDeAcao(null);
    setSalvando(true);
    try {
      if (idEmEdicao === null) {
        await criarEndereco(cliente, formulario);
      } else {
        await atualizarEndereco(cliente, idEmEdicao, formulario);
      }
      setMostrarFormulario(false);
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
    setErroDeAcao(null);
    try {
      await atualizarEndereco(cliente, id, { principal: true });
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
    setErroDeAcao(null);
    try {
      await removerEndereco(cliente, id);
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
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Trilha
        itens={[{ rotulo: 'Início', para: '/' }, { rotulo: 'Meus endereços' }]}
      />

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
        Meus endereços
      </h1>

      {erroDeCarga ? (
        <div className="mt-6">
          <Aviso tipo="erro">{erroDeCarga}</Aviso>
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
            <div className="mt-6 flex flex-col items-center gap-4 rounded-card border border-borda bg-superficie-sutil py-16 text-center">
              <p className="text-tinta-media">
                Você ainda não tem nenhum endereço cadastrado.
              </p>
              <Botao type="button" onClick={abrirParaCriar}>
                Cadastrar endereço
              </Botao>
            </div>
          ) : null}

          {enderecos.length > 0 ? (
            <ul className="mt-6 flex flex-col gap-3">
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

          {!mostrarFormulario && enderecos.length > 0 ? (
            <div className="mt-6">
              <Botao type="button" onClick={abrirParaCriar}>
                Adicionar endereço
              </Botao>
            </div>
          ) : null}

          {mostrarFormulario ? (
            <FormularioDeEndereco
              idEmEdicao={idEmEdicao}
              formulario={formulario}
              aoAlterar={setFormulario}
              salvando={salvando}
              aoSalvar={aoSalvar}
              aoCancelar={() => setMostrarFormulario(false)}
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
    <li className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-4 shadow-carta sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <strong className="font-semibold text-tinta">
            {endereco.apelido}
          </strong>
          {endereco.principal ? (
            <Etiqueta tom="sucesso">Principal</Etiqueta>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-tinta-media">
          {endereco.destinatario} — {endereco.logradouro}, {endereco.numero}
          {endereco.complemento ? `, ${endereco.complemento}` : ''}
          {' — '}
          {endereco.bairro}, {endereco.cidade}/{endereco.uf}
        </p>
      </div>
      <div className="flex flex-shrink-0 flex-wrap gap-2">
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
          variante="fantasma"
          tamanho="pequeno"
          type="button"
          onClick={aoEditar}
        >
          Editar
        </Botao>
        <Botao
          variante="perigo"
          tamanho="pequeno"
          type="button"
          onClick={aoRemover}
        >
          Remover
        </Botao>
      </div>
    </li>
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
      className="mt-6 flex flex-col gap-4 rounded-card border border-borda bg-superficie p-5 shadow-carta"
      onSubmit={aoSalvar}
    >
      <h2 className="text-lg font-semibold text-tinta">
        {idEmEdicao === null ? 'Novo endereço' : 'Editar endereço'}
      </h2>

      <Campo
        rotulo="Apelido"
        placeholder="Casa, Trabalho..."
        value={formulario.apelido}
        onChange={(e) => aoAlterar({ ...formulario, apelido: e.target.value })}
        required
      />
      <Campo
        rotulo="Destinatário"
        value={formulario.destinatario}
        onChange={(e) =>
          aoAlterar({ ...formulario, destinatario: e.target.value })
        }
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
        <Campo
          rotulo="CEP"
          placeholder="00000-000"
          value={formulario.cep}
          onChange={(e) => aoAlterar({ ...formulario, cep: e.target.value })}
          required
        />
        <Campo
          rotulo="Número"
          placeholder="123 ou S/N"
          value={formulario.numero}
          onChange={(e) => aoAlterar({ ...formulario, numero: e.target.value })}
          required
        />
      </div>

      <Campo
        rotulo="Logradouro"
        value={formulario.logradouro}
        onChange={(e) =>
          aoAlterar({ ...formulario, logradouro: e.target.value })
        }
        required
      />

      <Campo
        rotulo="Complemento"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
        <Campo
          rotulo="Cidade"
          value={formulario.cidade}
          onChange={(e) => aoAlterar({ ...formulario, cidade: e.target.value })}
          required
        />
        <Selecao
          rotulo="UF"
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

      <div className="flex gap-3">
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
        <Botao type="button" variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
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
      className="mt-6 flex flex-col gap-3"
    >
      <Esqueleto className="h-24 w-full" />
      <Esqueleto className="h-24 w-full" />
    </div>
  );
}
