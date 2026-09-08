// ---------------------------------------------
// Erro vindo da API
// Preserva o status para que a interface distinga "credencial inválida" de
// "servidor fora do ar", e normaliza a mensagem: o ValidationPipe do backend
// devolve um array quando há vários campos inválidos.
// ---------------------------------------------
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface CorpoDeErro {
  message?: string | string[];
}

// ---------------------------------------------
// Extração da mensagem de erro da API
// Resposta sem corpo JSON cai no catch vazio de propósito: a mensagem padrão
// já cobre o caso, e falhar aqui esconderia o status real por trás de um erro
// de parsing.
// ---------------------------------------------
async function extrairErro(resposta: Response): Promise<ApiError> {
  let mensagem = 'Não foi possível completar a requisição.';
  try {
    const corpo = (await resposta.json()) as CorpoDeErro;
    if (Array.isArray(corpo.message)) {
      mensagem = corpo.message.join(', ');
    } else if (typeof corpo.message === 'string' && corpo.message) {
      mensagem = corpo.message;
    }
  } catch {
    /* vazio de propósito — ver bloco acima */
  }
  return new ApiError(resposta.status, mensagem);
}

export interface UsuarioPublico {
  id: string;
  email: string;
  emailVerificado: boolean;
  criadoEm: string;
  papel: 'ADMIN' | 'CLIENTE';
}

export interface SessaoAutenticada {
  tokenDeAcesso: string;
  tipoDoToken: 'Bearer';
  expiraEm: number;
  usuario: UsuarioPublico;
}

export type EventoDeSessao =
  | { tipo: 'renovada'; sessao: SessaoAutenticada }
  | { tipo: 'encerrada' };

type OuvinteDeSessao = (evento: EventoDeSessao) => void;

interface OpcoesDoCliente {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Nome do canal entre abas. Trocado nos testes para não cruzar cenários. */
  canalDeSessao?: string;
}

interface OpcoesDaRequisicao {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  cabecalhos?: Record<string, string>;
  /** Cancela a requisição em voo — usado por filtros que mudam rápido. */
  signal?: AbortSignal;
}

const ROTA_DE_RENOVACAO = '/auth/refresh';
const CANAL_PADRAO = 'sessao-do-catalogo';
const NOME_DO_LOCK = 'renovacao-de-sessao';

// ---------------------------------------------
// Rotas em que 401 não significa token expirado
// Em login, cadastro e recuperação de senha, 401 é o resultado da própria
// operação — credencial inválida ou link vencido. Renovar a sessão nesses
// casos chamaria /auth/refresh à toa e, pior, substituiria a mensagem real
// pela do refresh, mostrando "não foi possível renovar a sessão" para quem
// apenas digitou a senha errada. A única rota sob /auth que renova é /auth/me,
// que é protegida e depende de token válido.
// ---------------------------------------------
function ehRotaDeCredencial(caminho: string): boolean {
  return caminho.startsWith('/auth/') && caminho !== '/auth/me';
}

interface NavegadorComLocks {
  locks?: {
    request<T>(nome: string, callback: () => Promise<T>): Promise<T>;
  };
}

// ---------------------------------------------
// Cliente HTTP da API
// O access token fica em memória, nunca em localStorage: guardá-lo lá faria
// qualquer falha de XSS entregar a sessão inteira. O refresh vive num cookie
// httpOnly que o JavaScript não lê, por isso toda requisição envia
// credentials — sem isso o cookie não viaja e a renovação nunca acontece.
//
// Três mecanismos protegem a sessão, porque o refresh do backend é rotativo e
// reapresentar um token já usado faz o servidor revogar a família inteira:
//
//  - uma promessa única de renovação, para os 401 simultâneos da mesma aba;
//  - um lock entre documentos mais um canal de transmissão, para as abas;
//  - um contador de geração, para descartar respostas que chegam depois de o
//    usuário já ter entrado com outra conta ou saído.
// ---------------------------------------------
export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ouvintes = new Set<OuvinteDeSessao>();
  private readonly canal: BroadcastChannel | null;

  private accessToken: string | null = null;
  private renovacaoEmAndamento: Promise<string> | null = null;
  private renovacaoBloqueada = false;
  private geracao = 0;

  constructor(opcoes: OpcoesDoCliente) {
    this.baseUrl = opcoes.baseUrl.replace(/\/$/, '');
    this.fetchImpl = opcoes.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.canal = this.abrirCanal(opcoes.canalDeSessao ?? CANAL_PADRAO);
  }

  // ---------------------------------------------
  // Observação das mudanças de sessão
  // A aplicação precisa saber quando a sessão morre por conta própria: sem
  // isso, uma renovação que falha deixava o token nulo e a interface seguia
  // exibindo o usuário como autenticado.
  // ---------------------------------------------
  aoMudarSessao(ouvinte: OuvinteDeSessao): () => void {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  tokenAtual(): string | null {
    return this.accessToken;
  }

  temSessao(): boolean {
    return this.accessToken !== null;
  }

  // ---------------------------------------------
  // Início de sessão
  // Incrementa a geração para invalidar qualquer renovação em voo, e libera o
  // bloqueio deixado por uma falha anterior: um login novo é justamente o
  // evento que autoriza voltar a renovar.
  // ---------------------------------------------
  definirSessao(sessao: SessaoAutenticada, propagar = true): void {
    this.geracao += 1;
    this.accessToken = sessao.tokenDeAcesso;
    this.renovacaoBloqueada = false;
    if (propagar) {
      this.publicarNoCanal({ tipo: 'renovada', sessao });
    }
    this.notificar({ tipo: 'renovada', sessao });
  }

  // ---------------------------------------------
  // Fim de sessão
  // Também bloqueia a renovação: depois de sair, uma resposta 401 atrasada não
  // pode ressuscitar a sessão pelo cookie que ainda esteja no navegador.
  // ---------------------------------------------
  limparSessao(propagar = true): void {
    this.geracao += 1;
    this.accessToken = null;
    this.renovacaoBloqueada = true;
    if (propagar) {
      this.publicarNoCanal({ tipo: 'encerrada' });
    }
    this.notificar({ tipo: 'encerrada' });
  }

  get<T>(caminho: string, opcoes?: OpcoesDaRequisicao): Promise<T> {
    return this.requisitar<T>(caminho, { ...opcoes, metodo: 'GET' });
  }

  post<T>(
    caminho: string,
    corpo?: unknown,
    opcoes?: OpcoesDaRequisicao,
  ): Promise<T> {
    return this.requisitar<T>(caminho, { ...opcoes, metodo: 'POST', corpo });
  }

  patch<T>(
    caminho: string,
    corpo?: unknown,
    opcoes?: OpcoesDaRequisicao,
  ): Promise<T> {
    return this.requisitar<T>(caminho, { ...opcoes, metodo: 'PATCH', corpo });
  }

  delete<T>(caminho: string, opcoes?: OpcoesDaRequisicao): Promise<T> {
    return this.requisitar<T>(caminho, { ...opcoes, metodo: 'DELETE' });
  }

  // ---------------------------------------------
  // Recuperação de sessão a partir do cookie
  // Usada na abertura da aplicação, quando ainda não há token em memória. O
  // desbloqueio é explícito porque a abertura é um momento legítimo para
  // tentar de novo, mesmo que a sessão anterior tenha terminado mal. Se a
  // geração mudar durante a espera, o usuário entrou ou saiu enquanto a
  // resposta vinha: aplicar a sessão recuperada agora trocaria a sessão atual
  // por uma que já não vale.
  // ---------------------------------------------
  async recuperarSessao(): Promise<SessaoAutenticada> {
    this.renovacaoBloqueada = false;
    const geracaoInicial = this.geracao;
    const sessao = await this.requisitar<SessaoAutenticada>(
      ROTA_DE_RENOVACAO,
      { metodo: 'POST' },
    );

    if (this.geracao !== geracaoInicial) {
      return sessao;
    }

    this.definirSessao(sessao);
    return sessao;
  }

  // ---------------------------------------------
  // Renovação da sessão expirada
  // Uma promessa única atende todos os 401 simultâneos da mesma aba, e o lock
  // entre documentos impede que duas abas apresentem o mesmo refresh cookie.
  // Quem entra no lock confere se o token já mudou — sinal de que outra aba
  // renovou e transmitiu o resultado — e nesse caso não renova de novo.
  // ---------------------------------------------
  private renovarSessao(): Promise<string> {
    if (this.renovacaoEmAndamento) {
      return this.renovacaoEmAndamento;
    }

    const geracaoInicial = this.geracao;
    const tokenAntes = this.accessToken;

    this.renovacaoEmAndamento = this.comLock(async () => {
      if (this.accessToken && this.accessToken !== tokenAntes) {
        return this.accessToken;
      }

      const sessao = await this.requisitar<SessaoAutenticada>(
        ROTA_DE_RENOVACAO,
        { metodo: 'POST' },
      );

      if (this.geracao !== geracaoInicial) {
        return this.accessToken ?? sessao.tokenDeAcesso;
      }

      this.definirSessao(sessao);
      return sessao.tokenDeAcesso;
    })
      .catch((erro: unknown) => {
        if (this.geracao === geracaoInicial) {
          this.limparSessao();
        }
        throw erro;
      })
      .finally(() => {
        this.renovacaoEmAndamento = null;
      });

    return this.renovacaoEmAndamento;
  }

  // ---------------------------------------------
  // Execução da requisição com renovação transparente
  // O token enviado é guardado: se o 401 chega depois de outra requisição já
  // ter renovado, basta repetir com o token novo. Renovar de novo apresentaria
  // ao backend um refresh já consumido, que ele trata como reuso e responde
  // revogando a sessão inteira.
  // ---------------------------------------------
  private async requisitar<T>(
    caminho: string,
    opcoes: OpcoesDaRequisicao = {},
  ): Promise<T> {
    const tokenUsado = this.accessToken;
    const resposta = await this.enviar(caminho, opcoes, tokenUsado);

    if (resposta.status !== 401 || ehRotaDeCredencial(caminho)) {
      return this.interpretar<T>(resposta);
    }

    if (this.accessToken && this.accessToken !== tokenUsado) {
      const refeita = await this.enviar(caminho, opcoes, this.accessToken);
      return this.interpretar<T>(refeita);
    }

    if (this.renovacaoBloqueada) {
      return this.interpretar<T>(resposta);
    }

    const tokenNovo = await this.renovarSessao();
    const respostaRefeita = await this.enviar(caminho, opcoes, tokenNovo);
    return this.interpretar<T>(respostaRefeita);
  }

  private enviar(
    caminho: string,
    opcoes: OpcoesDaRequisicao,
    token: string | null,
  ): Promise<Response> {
    const cabecalhos: Record<string, string> = { ...opcoes.cabecalhos };

    if (token) {
      cabecalhos.Authorization = `Bearer ${token}`;
    }
    if (opcoes.corpo !== undefined) {
      cabecalhos['Content-Type'] = 'application/json';
    }

    return this.fetchImpl(`${this.baseUrl}${caminho}`, {
      method: opcoes.metodo ?? 'GET',
      credentials: 'include',
      headers: cabecalhos,
      signal: opcoes.signal,
      body:
        opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
  }

  private async interpretar<T>(resposta: Response): Promise<T> {
    if (!resposta.ok) {
      throw await extrairErro(resposta);
    }
    if (resposta.status === 204) {
      return undefined as T;
    }
    return (await resposta.json()) as T;
  }

  // ---------------------------------------------
  // Exclusão mútua entre abas
  // A API de locks não existe em todo navegador nem no ambiente de teste; sem
  // ela o comportamento volta a ser o de uma aba só, que continua correto
  // dentro do documento — apenas não coordena com as demais.
  // ---------------------------------------------
  private comLock<T>(operacao: () => Promise<T>): Promise<T> {
    const locks = (globalThis.navigator as NavegadorComLocks | undefined)
      ?.locks;
    if (!locks) {
      return operacao();
    }
    return locks.request(NOME_DO_LOCK, operacao);
  }

  // ---------------------------------------------
  // Canal de sincronização entre abas
  // O evento recebido é aplicado sem propagar de volta: a aba que o originou
  // já aplicou o estado, e reenviar criaria um eco infinito entre as abas.
  // ---------------------------------------------
  private abrirCanal(nome: string): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') {
      return null;
    }
    const canal = new BroadcastChannel(nome);
    canal.onmessage = (mensagem: MessageEvent<EventoDeSessao>) => {
      if (mensagem.data.tipo === 'renovada') {
        this.definirSessao(mensagem.data.sessao, false);
      } else {
        this.limparSessao(false);
      }
    };
    return canal;
  }

  private publicarNoCanal(evento: EventoDeSessao): void {
    this.canal?.postMessage(evento);
  }

  private notificar(evento: EventoDeSessao): void {
    for (const ouvinte of this.ouvintes) {
      ouvinte(evento);
    }
  }

  // ---------------------------------------------
  // Encerramento do canal entre abas
  // Chamado quando a aplicação é desmontada, para não deixar o canal aberto
  // segurando referência ao cliente.
  // ---------------------------------------------
  encerrar(): void {
    this.canal?.close();
    this.ouvintes.clear();
  }
}
