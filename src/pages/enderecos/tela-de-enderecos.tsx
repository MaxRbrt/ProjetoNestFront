import { useEffect, useState, type FormEvent } from 'react';
import type { ApiClient } from '../../api/cliente';
import { ApiError } from '../../api/cliente';
import {
  atualizarEndereco,
  criarEndereco,
  listarEnderecos,
  removerEndereco,
  type DadosDeEndereco,
  type Endereco,
} from '../../api/enderecos';
import { Aviso, Botao, Campo } from '../../components/primitivos';
import { Cabecalho } from '../../components/cabecalho';
import { NavPrincipal } from '../../components/nav-principal';
import { UFS_VALIDAS } from './ufs';
import './tela-de-enderecos.css';

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
// endereço está sendo editado. Erro de carga (listar) e erro de ação
// (salvar/remover) ficam separados, mesmo critério já usado no carrinho e no
// detalhe de pedido — um erro ao salvar não pode esconder a lista que o
// usuário precisa ver para tentar de novo.
// ---------------------------------------------
export function TelaDeEnderecos({ cliente }: PropsDaTela) {
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [idEmEdicao, setIdEmEdicao] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<DadosDeEndereco>(FORMULARIO_VAZIO);
  const [salvando, setSalvando] = useState(false);

  function recarregar(signal?: AbortSignal) {
    setCarregando(true);
    setErroDeCarga(null);
    return listarEnderecos(cliente, signal)
      .then((lista) => setEnderecos(lista))
      .catch((falha: unknown) => {
        if (falha instanceof DOMException && falha.name === 'AbortError') return;
        setErroDeCarga(
          falha instanceof ApiError
            ? falha.message
            : 'Não foi possível carregar seus endereços.',
        );
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    const controlador = new AbortController();
    void recarregar(controlador.signal);
    return () => controlador.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente]);

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
    <>
      <Cabecalho links={<NavPrincipal />} />

      <main className="tela-enderecos">
        <h1>Meus endereços</h1>

        {erroDeCarga ? <Aviso>{erroDeCarga}</Aviso> : null}

        {!erroDeCarga && carregando ? (
          <p role="status">Carregando endereços…</p>
        ) : null}

        {!erroDeCarga && !carregando ? (
          <>
            {erroDeAcao ? <Aviso>{erroDeAcao}</Aviso> : null}

            {enderecos.length === 0 && !mostrarFormulario ? (
              <p className="tela-enderecos__vazio">
                Você ainda não tem nenhum endereço cadastrado.
              </p>
            ) : null}

            <ul className="tela-enderecos__lista">
              {enderecos.map((endereco) => (
                <li key={endereco.id} className="tela-enderecos__item">
                  <div>
                    <strong>{endereco.apelido}</strong>
                    {endereco.principal ? (
                      <span className="tela-enderecos__selo">Principal</span>
                    ) : null}
                    <p>
                      {endereco.destinatario} — {endereco.logradouro},{' '}
                      {endereco.numero}
                      {endereco.complemento ? `, ${endereco.complemento}` : ''}
                      {' — '}
                      {endereco.bairro}, {endereco.cidade}/{endereco.uf}
                    </p>
                  </div>
                  <div className="tela-enderecos__acoes">
                    {!endereco.principal ? (
                      <button
                        type="button"
                        onClick={() => void aoMarcarPrincipal(endereco.id)}
                      >
                        Tornar principal
                      </button>
                    ) : null}
                    <button type="button" onClick={() => abrirParaEditar(endereco)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void aoRemover(endereco.id)}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {!mostrarFormulario ? (
              <Botao type="button" onClick={abrirParaCriar}>
                Adicionar endereço
              </Botao>
            ) : (
              <form className="tela-enderecos__formulario" onSubmit={aoSalvar}>
                <h2>{idEmEdicao === null ? 'Novo endereço' : 'Editar endereço'}</h2>

                <Campo
                  rotulo="Apelido"
                  placeholder="Casa, Trabalho..."
                  value={formulario.apelido}
                  onChange={(e) =>
                    setFormulario({ ...formulario, apelido: e.target.value })
                  }
                  required
                />
                <Campo
                  rotulo="Destinatário"
                  value={formulario.destinatario}
                  onChange={(e) =>
                    setFormulario({ ...formulario, destinatario: e.target.value })
                  }
                  required
                />
                <Campo
                  rotulo="CEP"
                  placeholder="00000-000"
                  value={formulario.cep}
                  onChange={(e) =>
                    setFormulario({ ...formulario, cep: e.target.value })
                  }
                  required
                />
                <Campo
                  rotulo="Logradouro"
                  value={formulario.logradouro}
                  onChange={(e) =>
                    setFormulario({ ...formulario, logradouro: e.target.value })
                  }
                  required
                />
                <Campo
                  rotulo="Número"
                  placeholder="123 ou S/N"
                  value={formulario.numero}
                  onChange={(e) =>
                    setFormulario({ ...formulario, numero: e.target.value })
                  }
                  required
                />
                <Campo
                  rotulo="Complemento"
                  value={formulario.complemento ?? ''}
                  onChange={(e) =>
                    setFormulario({ ...formulario, complemento: e.target.value })
                  }
                />
                <Campo
                  rotulo="Bairro"
                  value={formulario.bairro}
                  onChange={(e) =>
                    setFormulario({ ...formulario, bairro: e.target.value })
                  }
                  required
                />
                <Campo
                  rotulo="Cidade"
                  value={formulario.cidade}
                  onChange={(e) =>
                    setFormulario({ ...formulario, cidade: e.target.value })
                  }
                  required
                />
                <div className="campo">
                  <label className="campo__rotulo" htmlFor="uf">
                    UF
                  </label>
                  <select
                    id="uf"
                    className="campo__entrada"
                    value={formulario.uf}
                    onChange={(e) =>
                      setFormulario({ ...formulario, uf: e.target.value })
                    }
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
                  </select>
                </div>

                <div className="tela-enderecos__botoes-formulario">
                  <Botao type="submit" carregando={salvando}>
                    Salvar
                  </Botao>
                  <Botao
                    type="button"
                    variante="secundario"
                    onClick={() => setMostrarFormulario(false)}
                  >
                    Cancelar
                  </Botao>
                </div>
              </form>
            )}
          </>
        ) : null}
      </main>
    </>
  );
}
