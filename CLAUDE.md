# CLAUDE.md — projeto-test-web

Frontend em React + Vite + TypeScript que consome a API do `projeto-test` (NestJS), projeto irmão
neste mesmo diretório pai.

> Este arquivo é o registro durável do frontend. As specs vivem em
> `../projeto-test/docs/superpowers/specs/` (repo irmão) e o ledger de execução em
> `.superpowers/sdd/` (aqui mesmo) — nenhum dos dois é versionado neste repositório. Se ele for
> clonado sozinho, só o que estiver aqui sobrevive. Atualize ao fim de cada bloco de trabalho.

## Estado atual

Fundação, autenticação, vitrine, painel administrativo, fluxo de compra do cliente e pagamento
simulado com ciclo de entrega prontos. Última atualização: 2026-09-10.

| Área | Estado |
|---|---|
| Cliente HTTP | Token em memória, fila de refresh, tratamento de erro da API |
| Sessão | Três estados (verificando/autenticado/anônimo), recuperação por cookie, rota protegida e rota restrita a ADMIN |
| Telas | Login, cadastro, verificação de email, reenvio de verificação, recuperação de senha (esqueci/redefinir), inicial autenticada, vitrine, detalhe de produto, dashboard admin, listagem e formulários de produtos e categorias, carrinho, meus pedidos, detalhe de pedido (com pagamento), meus endereços |
| Pagamento | Completo — formulário de cartão simulado no detalhe do pedido (`PENDENTE`), aprovação/recusa com retry, `PAGO`→`ENVIADO`→`ENTREGUE` só via ADMIN — 2026-09-10 |
| Sistema visual | Tokens de cor, tipografia e motion; primitivos de botão, campo e aviso; subnavegação administrativa |
| Vitrine | Completa — busca/categoria/página na URL, debounce, cancelamento, retry, estados de carregamento/vazio/erro e detalhe com retorno ao filtro |
| Painel Admin | Completo — métricas, CRUD de catálogo e gestão de pedidos com filtro por situação, paginação na URL, detalhe, cancelamento e passos de logística (enviado/entregue). Sem confirmação manual de pagamento: removida em 2026-09-10, ver seção de pagamento |
| Carrinho, pedidos | Completo — carrinho persistido em `localStorage` limpo no logout, adicionar com teto de estoque, checkout com `Idempotency-Key` estável entre retries, seleção de endereço e de frete, "meus pedidos" paginado, detalhe com endereço/frete congelados e cancelamento (`PENDENTE`→`CANCELADO`) — ver seção própria abaixo |
| Endereços | Completo — listar/criar/editar/remover, marcar principal, seleção no checkout — 2026-09-09 |
| Frete | Completo — cotação PAC/SEDEX no checkout com custo e prazo, total atualiza ao trocar modalidade — 2026-09-09 |
| Dinheiro | **Centavos inteiros.** A API fala em `precoEmCentavos`/`totalEmCentavos`/`precoUnitarioEmCentavos`; conversão para exibição e para envio vive só em `src/utils/dinheiro.ts` |
| Testes | 45 testes (`npm test`) — `ApiClient` (fila de refresh), `ProvedorDoCarrinho`, `dinheiro.ts`, gestão admin de pedidos, pagamento (incl. falha ambígua) |

## O contrato de autenticação define a arquitetura

`POST /auth/login` devolve `{ accessToken, tokenType, expiresIn, user }` no corpo **e** grava o
refresh token num cookie `httpOnly`, `sameSite=strict`, `path=/auth` — invisível ao JavaScript.

Daí decorre tudo:

- **O access token vive em memória**, nunca em `localStorage`. Em storage, qualquer XSS levaria a
  sessão inteira. Recarregar a página perde o token, e é aceitável: a sessão volta por
  `/auth/refresh`, que usa o cookie.
- **Toda requisição usa `credentials: 'include'`.** Sem isso o cookie não viaja e a renovação nunca
  funciona.
- `localhost:3001 → localhost:3000` é *same-site* (porta não entra na definição), então o cookie
  `strict` passa em desenvolvimento. **Em produção, front e API precisam ficar no mesmo site
  registrável**, ou o cookie não é enviado.
- **A porta 3001 é fixa** (`strictPort: true`). O backend só libera no CORS a origem de
  `FRONTEND_URL`; subir em outra porta quebra login e refresh de um jeito difícil de diagnosticar.

## Armadilhas já encontradas (não reintroduzir)

Todas apareceram rodando a aplicação de verdade, com os testes já passando.

1. **Fila de refresh é obrigatória.** O refresh é rotativo: cada uso invalida o anterior. Sem a fila,
   várias requisições recebendo `401` ao mesmo tempo disparam vários `/auth/refresh`, e só o primeiro
   funciona — o usuário cai sem ter feito nada. O cliente compartilha uma única promise de renovação.
2. **`401` em rota de credencial não é sessão expirada.** Senha errada no login devolve `401`; tratar
   como token expirado dispara o refresh e faz a mensagem dele (“Não foi possível renovar a sessão”)
   sobrescrever a real. Rotas `/auth/*` — exceto `/auth/me` — nunca renovam.
3. **O efeito de recuperação de sessão não cancela na limpeza.** No StrictMode o React monta,
   desmonta e monta de novo. Um sinalizador de “ainda montado” seria desligado pela primeira
   desmontagem e faria a resposta da única chamada ser descartada: a tela trava em “verificando”
   para sempre. A trava de execução única já basta.
4. **Testes comuns não cobrem o StrictMode.** O bug acima passou por todos os testes verdes. Há
   testes específicos envolvendo `<StrictMode>` — mantenha-os.
5. **`<br />` em título quebra o texto para leitor de tela.** `Catálogo<br />e Pedidos` é lido como
   “Catálogoe”. A quebra vem do CSS (`max-width` em `ch`).
6. **Debounce precisa cancelar também o temporizador.** Abortar apenas o `fetch` não impede uma busca
   obsoleta de ser disparada depois que o filtro mudou. `useProducts` limpa o `setTimeout`, aborta a
   requisição em voo e marca o efeito anterior como cancelado.
7. **`MotionConfig reducedMotion="user"` não desativa sozinho o `whileHover`.** O cartão usa
   `useReducedMotion()` para remover explicitamente o deslocamento e o `layoutId`; a validação real
   confirmou `transform: none` com movimento reduzido.
8. **O teste de `BroadcastChannel` ainda tem uma janela de flake.** `multi-aba.test.ts` espera uma
   única volta com `setTimeout(0)`. Em 2026-08-31 falhou uma vez dentro da suíte paralela e passou
   isolado (3/3) e na repetição completa (72/72). Não foi alterado por estar fora do escopo da
   vitrine; se voltar a oscilar, trocar a espera fixa por polling da condição.
9. **Cancelamento HTTP em hooks exige `AbortController` além da flag de cancelamento.** A flag
   `cancelado` previne `setState` após desmontagem, mas sem `AbortController` a requisição em voo
   continua consumindo rede e processamento; o padrão do projeto acopla `controlador.signal` nas
   chamadas do `ApiClient` e chama `controlador.abort()` no cleanup.
10. **Asserções em testes com subnavegação não devem usar queries ambíguas.** `NavPrincipal` e
    `AdminLayout` compartilham links de mesmo texto (como "Produtos"); asserções devem ser escopadas com
    `within(subnav)` para evitar falso positivo/falha por múltiplos elementos.
11. **Exclusão de entidades com vínculos gera 409 e deve exibir a mensagem literal da API.**
    Ao tentar remover produto ou categoria associados a pedidos ou produtos existentes, o backend
    responde 409 com motivo descritivo; a interface captura `ApiError` e exibe a mensagem na tela.
12. **`AdminProductFormPage` tinha o mesmo bug de StrictMode do item 3, sozinho.** O efeito de
    carregar o produto em modo edição abortava a requisição na desmontagem mas não tinha a flag
    `cancelado` — sob StrictMode, o `catch` da primeira montagem (abortada) rodava mesmo assim e
    fixava "Não foi possível carregar o produto." por cima do formulário preenchido com sucesso pela
    segunda montagem. `AdminCategoryFormPage` já tinha o padrão correto; corrigido por espelhamento
    em 2026-09-01. Achado por revisão manual (Codex indisponível na sessão — rate limit e depois
    créditos esgotados nas duas tentativas). A reprodução em teste só funcionou depois de trocar o
    mock de `fetch` por um que realmente rejeita ao `abort()`, como o `fetch` nativo faz — um mock
    que ignora o `AbortSignal` dá falso verde nesse tipo de bug.
13. **A marca de saída pendente precisa de `localStorage`, não `sessionStorage`.** Corrigido em
    2026-09-04 na auditoria do bloco 12. O propósito da marca é impedir que o próximo carregamento
    recupere pelo cookie uma sessão que o usuário pediu para encerrar, quando o `/auth/logout` falha
    e o cookie `httpOnly` continua válido no servidor. Com `sessionStorage` a proteção valia só para
    a aba que fez o logout: uma aba nova no mesmo navegador não via a marca e recuperava a sessão do
    usuário anterior — exatamente o cenário de computador compartilhado que a marca existe para
    cobrir. É um booleano sem valor de segredo, então `localStorage` não piora exposição a XSS.
14. **O contrato HTTP virou PT-BR em 2026-09-04, junto com a refatoração do backend.** Toda
    propriedade de resposta e de corpo de requisição mudou: `price`→`preco`, `stock`→`estoque`,
    `categoryId`→`categoriaId`, `name`→`nome` (produto/categoria), `page`→`pagina`,
    `limit`→`limite`, `data`→`dados`, `role`→`papel`, `isEmailVerified`→`emailVerificado`,
    `createdAt`→`criadoEm`, `accessToken`→`tokenDeAcesso`, `tokenType`→`tipoDoToken`,
    `expiresIn`→`expiraEm`, `user`→`usuario` (dentro do corpo de `SessaoAutenticada`), corpo de
    login/cadastro `password`→`senha`. `src/api/client.ts`, `products.ts` e `catalog-admin.ts`
    foram atualizados junto — ver o `CLAUDE.md` do backend (seção "Refatoração PT-BR") para o
    detalhamento completo e os bugs reais que a verificação end-to-end encontrou (nenhum deles do
    lado do frontend, mas o motivo de a Fase 6 ter sido indispensável).
15. **Nomes de arquivo, componente e hook traduzidos para PT-BR em 2026-09-08**, num segundo passo
    depois do contrato (item 14). Toda página e componente já tinha nome PT-BR por dentro desde a
    construção original — só os 6 componentes admin (`AdminProductsPage` etc.) e os 6 hooks de
    listagem/métricas (`useProducts`, `useAdminMetrics` etc.) ainda estavam em inglês, junto com boa
    parte dos nomes de arquivo. O prefixo `use` dos hooks foi preservado (convenção do React/regra
    do ESLint, não escolha de estilo); `ApiClient`, `App.tsx`, `main.tsx` também ficaram — termo
    técnico genérico e convenção de entrypoint do Vite, respectivamente.

    **Achado real do Codex nesta revisão** (`codex exec review --uncommitted`), não desta rename —
    resquício esquecido da Fase 5 do backend: `use-lista-de-categorias-admin.ts` e
    `use-metricas-admin.ts` ainda enviavam `?page=`/`?limit=` na query string, que o backend
    rejeita desde a tradução do contrato (`forbidNonWhitelisted`) — painel de categorias e dashboard
    de métricas quebrados em produção sem nenhum erro de compilação acusar. `tsc -b` não pega
    porque é literal de string, não checagem de tipo. Corrigido para `?pagina=`/`?limite=` e
    confirmado por `curl` contra o backend real (200 nos dois).

    **Outra lição da mesma leva:** `tsc -b` não valida se `import './x.css'` aponta pra um arquivo
    que existe — há uma declaração ambiente `*.css` que aceita qualquer caminho. Só `vite build`
    (resolução real do bundler) pega isso; apareceu um import de CSS renomeado por engano durante a
    própria rename (`tela-de-dashboard-admin.tsx` ainda importando `admin-dashboard-page.css`).
16. **`StrictMode` pode desmontar e remontar o componente de verdade no mount inicial, não só
    duplicar efeitos — perder um valor lido de API mutável do navegador (URL, `location.hash`) fica
    fácil se o primeiro mount já tiver mutado essa fonte.** Achado construindo
    `TelaDeRedefinirSenha`: a primeira versão lia o token do fragmento da URL num `useRef` e limpava
    a URL (`history.replaceState`) dentro de um `useEffect` no mount. Sequência real observada (não
    suposta — confirmada com `console.log` e reprodução isolada em `about:blank` → navegar): render
    1 lê o token certo → efeito 1 roda e apaga o hash da URL → **StrictMode desmonta o componente de
    verdade e remonta** → render 2 (fiber nova, hooks resetados) relê a URL, agora vazia → token
    perdido antes do usuário sequer ver o formulário. `TelaDeVerificacaoDeEmail` tem a mesma forma
    (lê o hash, limpa a URL num efeito de mount) e pode carregar o mesmo problema — não investigado
    a fundo por estar fora do escopo desta tarefa, mas é candidato a revisão.

    Fix aplicado: não mutar a fonte da verdade (a URL) antes do primeiro sucesso real de uso — a
    limpeza cosmética da URL só acontece depois do POST de redefinição ter respondido OK, quando não
    há mais duplo-mount de StrictMode pela frente. Um segundo bug apareceu ao corrigir o primeiro: o
    token como `const` simples (recalculado a cada render) lia de novo a URL já limpa no re-render
    pós-sucesso e voltava a cair no branch de "link incompleto" — resolvido guardando o token uma
    única vez com `useState(() => ...)` (inicializador preguiçoso), não recalculado em renders
    seguintes.

## Recuperação de senha — 2026-09-08

Spec: `../projeto-test/docs/superpowers/specs/2026-09-08-recuperacao-de-senha-design.md`. Única
lacuna que restava nas telas de autenticação — backend já tinha os dois endpoints prontos e
verificados, frontend não tinha nenhuma tela nem link para o fluxo.

Arquivos novos: `src/pages/tela-de-esqueci-senha.tsx`, `src/pages/tela-de-redefinir-senha.tsx`.
Modificados: `src/pages/tela-de-entrada.tsx` (link "Esqueceu sua senha?"), `src/App.tsx` (rotas
`/esqueci-senha` e `/redefinir-senha`, fora de `RotaProtegida`, mesmo nível de `/entrar`).

`TelaDeEsqueciSenha`: campo de email, `POST /auth/forgot-password`, sempre mostra a mesma mensagem
genérica de sucesso (o backend responde igual exista ou não a conta — não recriar a enumeração no
cliente). `TelaDeRedefinirSenha`: lê o token de `#token=...` (mesmo padrão de
`TelaDeVerificacaoDeEmail`), formulário de nova senha, `POST /auth/reset-password`, sucesso mostra
aviso + link manual para `/entrar` (sem redirect automático — decisão explícita, mesmo critério já
usado na verificação de email). Só um erro terminal ("pedir novo link") é exibido: quando a mensagem
da API bate exatamente com o texto que o backend usa para token inexistente/expirado/já consumido
(`INVALID_ACTION_TOKEN` em `tokens-de-acao.service.ts`, "O token é inválido ou expirou."). Qualquer
outro erro (senha fora da política, rede) é recuperável — mantém o formulário visível com o campo já
preenchido, mesmo padrão de `Aviso` inline usado em `TelaDeEntrada`/`TelaDeCadastro`.

**Bug real de StrictMode encontrado e corrigido nesta tarefa** — ver item 16 da lista de
armadilhas acima (desmontagem real no mount inicial perdendo o token lido da URL).

**Achados reais do Codex nesta revisão** (`codex exec` apontando os 4 arquivos diretamente,
reproduzidos com React Testing Library + JSDOM antes de reportar, não hipóteses) — 2 achados,
ambos corrigidos:

- **Todo erro de `POST /auth/reset-password` derrubava o formulário e mandava pedir link novo**,
  inclusive senha fora da política (400 de validação) e falha de rede — usuário não conseguia
  corrigir a própria senha e tentar de novo com o mesmo link válido. Corrigido: só o texto exato de
  token inválido/expirado vira tela terminal; o resto vira `Aviso` inline sem descartar o
  formulário (ver acima).
- **Rotas públicas (`/entrar`, `/cadastrar`, `/verificar-email`, `/esqueci-senha`,
  `/redefinir-senha`) estavam dentro da subárvore `<ProvedorDoCarrinho key={usuario?.id ??
  'anonimo'}>`.** Reproduzido: se a identidade mudar em outra aba (login/logout sincronizado por
  `BroadcastChannel`) enquanto esta aba está em `/redefinir-senha` depois de um reset bem-sucedido,
  a troca de `key` remonta a tela pública inteira — o `useState` que guarda `concluido` é perdido, o
  inicializador relê a URL (já limpa) e mostra "link incompleto" mesmo com a senha já alterada com
  sucesso. Bug pré-existente (a mesma estrutura já afetava `/entrar`/`/cadastrar`/`/verificar-email`
  antes desta tarefa; só ficou visível agora por causa do estado de sucesso em
  `TelaDeRedefinirSenha`). Corrigido em `App.tsx`: extraída `AreaComCarrinho`, rota de layout que
  concentra `key={usuario?.id ?? 'anonimo'}` — só as rotas protegidas/admin ficam por baixo dela;
  as rotas públicas viram irmãs no mesmo `<Routes>`, fora da subárvore com key.
- Também descartado pelo Codex (investigado, não confirmado): `useSearchParams()` não re-executa em
  resposta a `history.replaceState` manual (não dispara o listener do Router), então o token
  guardado em `useState` não é relido por esse caminho; duplo clique não reproduziu inconsistência
  (`Botao` já desabilita durante o envio).

Validação: `npx tsc -b` e `npm run build` limpos (487 módulos) antes e depois da correção dos
achados do Codex. Clique real de ponta a ponta contra o backend local (`EMAIL_PROVIDER=file`
temporário nesta sessão, para capturar o link em `.emails-dev/` em vez de tentar enviar por Resend):
cadastro → verificação → pedido de recuperação pelo formulário → link real extraído do arquivo de
email → senha inválida (formulário permanece, corrige e reenvia) → redefinição com sucesso → login
com a senha nova, sucesso. Reuso do mesmo token (tentativa separada) devolveu o erro terminal
corretamente. Nenhum teste automatizado (frontend sem infraestrutura de teste ativa nesta fase,
mesmo critério dos blocos anteriores).

## Reenvio de verificação de email — 2026-09-09

Spec: `../projeto-test/docs/superpowers/specs/2026-09-09-reenvio-de-verificacao-design.md`. Última
lacuna nas telas de autenticação: o backend já tinha `POST /auth/resend-verification` desde sempre,
mas quem clicasse um link de verificação vencido ficava sem saída na própria aplicação.

Arquivo novo: `src/pages/tela-de-reenviar-verificacao.tsx` — cópia estrutural de
`TelaDeEsqueciSenha` (mesmo endpoint genérico-202, mesma ausência de enumeração de conta).
Modificados: `src/pages/tela-de-verificacao-de-email.tsx` (link "Pedir um novo link" no estado de
erro), `src/pages/tela-de-cadastro.tsx` (link "Reenviar" no estado "Confira seu email", cobre o
caso de o primeiro email nunca ter chegado), `src/App.tsx` (rota `/reenviar-verificacao`, pública,
fora da subárvore com `key` de identidade — mesmo cuidado já registrado na tarefa anterior).

Revisão Codex: nenhum achado real — só uma nota P3 (mensagem de erro genérico de rede tem texto
levemente diferente entre `TelaDeReenviarVerificacao` e `TelaDeCadastro`, "enviar" vs "cadastrar";
o próprio Codex descartou como não-enumeração, natural por serem ações diferentes). Confirmado que
os dois bugs da tarefa anterior (formulário descartado em qualquer erro, rota pública dentro da
subárvore com key) não foram reintroduzidos.

Validação: `npm run build` limpo (488 módulos). Clique real contra o backend local
(`EMAIL_PROVIDER=file`): reenvio para conta já verificada (202, sem novo email — comportamento
correto do backend), reenvio para conta recém-cadastrada não verificada (202, confirmado por curl),
link "Pedir um novo link" a partir de token inválido em `/verificar-email` navegando corretamente,
link "Reenviar" a partir do estado pós-cadastro. Nenhum teste automatizado, mesmo critério dos
blocos anteriores. Contas de teste (`teste-reenvio@exemplo.local`,
`teste-cadastro-verificacao-link@exemplo.local`) e a da tarefa anterior
(`teste-recuperacao@exemplo.local`) removidas do banco de desenvolvimento ao final, via script
descartável usando o `DataSource` do próprio backend (não SQL cru solto) — pedido do proprietário
para não acumular dado de teste no banco real.

## Fluxo de compra do cliente — 2026-09-08

Spec: `../projeto-test/docs/superpowers/specs/2026-09-08-fluxo-de-compra-design.md`. Plano executado
via Subagent-Driven Development (8 tasks), ledger completo em
`.superpowers/sdd/2026-09-08-fluxo-de-compra/progress.md`.

Arquivos novos: `src/api/pedidos.ts`, `src/auth/contexto-do-carrinho.tsx`,
`src/hooks/use-meus-pedidos.ts`, `src/pages/carrinho/tela-de-carrinho.tsx` + `.css`,
`src/pages/pedidos/tela-de-meus-pedidos.tsx` + `.css`,
`src/pages/pedidos/tela-de-detalhe-do-pedido.tsx` + `.css`. Modificados:
`src/pages/products/tela-de-detalhe-do-produto.tsx`, `src/components/cabecalho.tsx` (+`.css`),
`src/components/nav-principal.tsx`, `src/App.tsx`.

**Backend não tem conceito de carrinho.** `POST /orders` recebe a lista de itens inteira numa única
chamada; o carrinho (`ContextoDoCarrinho`, mesmo padrão do `ContextoDeSessao`) é construção só do
frontend, guarda apenas `{ produtoId, quantidade }[]` em `localStorage` — nome e preço são buscados de
novo na tela do carrinho para nunca exibir dado desatualizado. Limpo quando `useSessao().situacao`
transiciona para `'anonimo'`.

**Achados reais do Codex nesta revisão** (`codex exec` apontando os 13 arquivos diretamente — não
`--uncommitted`, que só olha `git diff` e não cobre arquivo novo/untracked; ver nota de processo
abaixo). 8 achados, 6 corrigidos nesta mesma leva:

- **Retry manual duplicava pedido.** `finalizarPedido` gerava `Idempotency-Key` nova a cada chamada;
  um retry do usuário após resposta perdida na rede enviava chave diferente e o backend não conseguia
  deduplicar. Corrigido: chave gerada uma vez por conteúdo de carrinho (`useRef`, invalidada só
  quando `itens` muda de fato).
- **Um produto removido do catálogo quebrava o carrinho inteiro.** `Promise.all` rejeitava tudo se uma
  busca de produto desse 404; o comentário da função já prometia o contrário. Corrigido para
  `Promise.allSettled`, mantendo só as linhas resolvidas.
- **Erro de ação escondia dado já carregado.** Um único estado `erro` cobria falha de carga (buscar
  carrinho/pedido) e falha de ação (finalizar/cancelar); erro na ação apagava a tela inteira, sem
  meio de corrigir e tentar de novo. Corrigido com `erroDeCarga`/`erroDeAcao` separados em
  `tela-de-carrinho.tsx` e `tela-de-detalhe-do-pedido.tsx`.
- **Adicionar ao carrinho repetidamente ultrapassava o estoque.** `adicionar` soma sem teto; clicar
  duas vezes com quantidade 5 num produto de estoque 5 resultava em carrinho com 10. Corrigido no
  ponto de chamada (`tela-de-detalhe-do-produto.tsx`): teto calculado a partir da quantidade já no
  carrinho. Reverificado ao vivo com Playwright.
- **Paginação de "meus pedidos" piscava dado desatualizado como se fosse atual.** Trocar de página
  mostrava "Carregando…" e a tabela da página anterior ao mesmo tempo, linhas ainda clicáveis.
  Corrigido: tabela fica visível e esmaecida (`aria-busy`) durante a troca, em vez de alternar.
- **Não havia link de navegação para `/pedidos`.** Só era alcançável vindo do redirecionamento
  pós-checkout. Corrigido: link "Meus pedidos" em `NavPrincipal`.

**Achado 1, corrigido após decisão do proprietário** (envolvia limite de identidade/segurança —
perguntado explicitamente antes de mexer): nenhum efeito de carrinho ou pedidos dependia de
`usuario.id`; só a transição para `'anonimo'` limpava o carrinho. Se o usuário B entrasse numa aba
enquanto A estava com pedidos abertos em outra aba do mesmo navegador (via `BroadcastChannel` de
sincronização de sessão, indo direto de autenticado A para autenticado B sem passar por `'anonimo'`),
a aba de A podia continuar mostrando dado de A sob a identidade de B. Corrigido em `App.tsx`:
extraída `AreaProtegida`, que lê `useSessao()` e passa `key={usuario?.id ?? 'anonimo'}` para
`ProvedorDoCarrinho` — troca de identidade força o React a desmontar e remontar toda a árvore
protegida (carrinho e qualquer tela de pedido em exibição), em vez de deixar componentes existentes
continuarem com dado da identidade anterior.

**Achado 6 fica como dívida conhecida, não como bug corrigido** — carrinho em múltiplas abas usa
"último a gravar vence": cada aba só lê `localStorage` ao montar; sem `storage` listener, duas abas
editando o carrinho ao mesmo tempo perdem a alteração de uma delas. Não perguntado nem corrigido
nesta rodada — mexeria em sincronização entre abas, escopo que a spec aprovada não previu para o
carrinho (só para sessão).

**Bug real encontrado no backend durante o clique real (não neste repositório, mas descoberto por
este fluxo):** `PATCH /orders/:id/status` sempre devolvia `itens: undefined` — nenhuma tela anterior a
esta consumia esse campo do retorno de cancelamento, então ficou invisível até a tela de detalhe do
pedido tentar `pedido.itens.map` depois de cancelar. Corrigido no `projeto-test` — ver seu `CLAUDE.md`,
seção do fluxo de compra.

**Nota de processo:** `codex exec review --uncommitted` (usado nos blocos anteriores) só enxerga
`git diff` da árvore rastreada — arquivo novo nunca commitado nem `git add`-ado (untracked) não entra
no diff e passa batido. Como esta sessão nunca roda `git add`/`git commit` (regra dura), toda task que
cria arquivo novo fica invisível para esse comando. Usar em vez disso `codex exec` com um prompt que
lista os arquivos a revisar explicitamente e instrui a lê-los do disco, não do diff. Também: o timeout
padrão de 280s não bastou nas duas primeiras tentativas desta revisão (13 arquivos, contexto do
backend incluído) — só terminou com 580s, mesmo padrão já visto no backend em 2026-09-08.

## Sistema visual e motion

**Correção registrada em 2026-08-31:** este arquivo afirmava "brutalismo refinado" (cantos retos,
sombra sólida, motion seco) enquanto `src/styles/tokens.css` e `src/motion/tokens.ts` já tinham
sido reescritos para outra direção. A contradição só foi percebida ao preparar mockups para o bloco
de navegação por papel — o registro estava mentindo sobre o próprio código. Confirmado com o
proprietário: a direção abaixo é a que vale, retroativa à construção da vitrine.

Direção atual: linguagem de e-commerce convencional — superfícies claras, cantos arredondados
(6/10/16px, pílula em elementos de estado), sombra suave que cresce com a elevação, acento laranja
quente (`--cor-acento`). `src/styles/tokens.css` é a fonte de verdade — não descrever a estética
aqui sem reler os tokens primeiro; foi exatamente esse desvio que causou a correção acima.

**A regra que mantém a coerência:** a curva desacelera até parar, acompanhando as superfícies
arredondadas — nenhum movimento trava seco. Duração 120–260ms conforme o peso da transição.

Os tokens ficam em `src/motion/tokens.ts` e `src/styles/tokens.css`, e **espelham um ao outro** de
propósito: componentes animados pelo Motion e elementos animados por CSS precisam ter o mesmo tempo,
senão a interface parece ter duas personalidades. Nenhuma tela deve inventar duração ou curva
própria.

`prefers-reduced-motion` é obrigatório, não opcional. No modo reduzido tudo vira transição de
opacidade.

**Movimento só entra quando carrega informação** — entrada escalonada comunica chegada de conteúdo;
transição de elemento compartilhado preserva continuidade espacial. Enfeite sem função não entra.

## Convenções

Iguais às do backend: comentários, textos de interface e nomes de teste em **PT-BR**; identificadores
em **inglês**. Comentário de bloco com título e explicação **dentro** da caixa `// ----`, e **nenhum
comentário solto no meio do corpo de função** — a explicação vai uma vez só no bloco do topo.

TDD onde há lógica de verdade. Não há teste de aparência: animação e layout se verificam olhando.

## Infraestrutura de teste restaurada + dinheiro em centavos — 2026-09-09

Roadmap: `../projeto-test/docs/superpowers/specs/2026-09-09-roadmap-nucleo-comercial.md`, Fases 0 e
1. Reverte a decisão da seção seguinte — mantida abaixo como registro histórico, não como estado
atual.

**Infra:** bloco `test` de volta no `vite.config.ts` (`defineConfig` de `vitest/config`, `jsdom`,
`src/test/setup.ts`), scripts `test`/`test:watch`. `include: ['src/**/*.{test,spec}.{ts,tsx}']`
explícito — sem isso o Vitest varre a raiz inteira e pega qualquer teste solto fora de `src/`.

**Achado ao ligar a infra:** os 19 testes de gestão administrativa de pedidos (bloco de 2026-09-08)
viviam em `.superpowers/sdd/`, diretório local ignorado pelo git — "todos os testes passam"
significava coisas diferentes em máquinas diferentes. Movidos para
`src/pages/admin/gestao-de-pedidos.test.tsx`. Ao entrar em `src/`, pegaram um erro de tipo real que
nunca tinha sido checado (`contexto = 'admin'` inferido como `string` numa prop que só aceita
`'cliente' | 'admin'`) — só apareceu porque agora passam por `tsc -b`.

**Testes novos:** `src/api/cliente.test.ts` (fila de renovação — armadilha 1) e
`src/auth/contexto-do-carrinho.test.tsx` (persistência, limpeza no logout, soma sem teto — o teto
fica no ponto de chamada, não no contexto). Os dois foram verificados quebrando o código de
propósito: desligar a fila de renovação faz 5 requisições concorrentes disparar 5 renovações em vez
de 1, e o teste pega.

**Dinheiro:** contrato mudou (`preco`→`precoEmCentavos`, `total`→`totalEmCentavos`,
`precoUnitario`→`precoUnitarioEmCentavos`), acompanhando a migration do backend. Sete cópias do
mesmo `Intl.NumberFormat` espalhadas pelas telas viraram um helper único,
`src/utils/dinheiro.ts` (`formatarCentavos`, `reaisParaCentavos`, `centavosParaReais`). O formulário
de produto do admin digita reais e converte para centavos no envio, com vírgula ou ponto aceitos —
teclado brasileiro usa vírgula, e recusar silenciosamente seria pior que aceitar as duas.

Verificação: 40 testes (`npm test`), `npm run build` limpo, clique real conferindo vitrine
(R$ 99,90), carrinho com quantidade 3 (R$ 299,70) e pedido criado com o mesmo total.

## Endereços de entrega — 2026-09-09

Roadmap: `../projeto-test/docs/superpowers/specs/2026-09-09-roadmap-nucleo-comercial.md`, Fase 2.

Arquivos novos: `src/api/enderecos.ts`, `src/pages/enderecos/tela-de-enderecos.tsx` + `.css` +
`ufs.ts` (lista fechada de UF, espelha o DTO do backend). Modificados: `src/api/pedidos.ts`
(`criarPedido` passa a exigir `enderecoId`; `Pedido` ganha os 8 campos de endereço congelado),
`src/pages/carrinho/tela-de-carrinho.tsx` (seleciona endereço, pré-seleciona o principal, bloqueia
"Finalizar pedido" sem nenhum cadastrado), `src/pages/pedidos/tela-de-detalhe-do-pedido.tsx` (exibe
o endereço), `src/components/nav-principal.tsx` (link "Meus endereços"), `src/App.tsx` (rota
`/enderecos`, protegida, dentro de `AreaComCarrinho`).

`TelaDeEnderecos`: lista + formulário único que serve tanto para criar quanto para editar
(`idEmEdicao: number | null`). Marcar principal e remover disparam ação direta na lista, sem abrir
o formulário.

**Troca de endereço selecionado no carrinho gera nova chave de idempotência.** O backend passou a
incluir `enderecoId` no hash de conferência do payload (ver `CLAUDE.md` do backend) — se a
`Idempotency-Key` da tentativa anterior sobrevivesse à troca de endereço, o reenvio seria recusado
como conflito de payload em vez de criar o pedido com o novo endereço. `useEffect` dedicado reseta
a chave quando `enderecoSelecionadoId` muda, separado do efeito que recarrega os produtos do
carrinho (esse não deve rodar de novo só porque o endereço mudou).

**Achado no clique real, não no código deste repositório:** `GET /addresses` respondia 500 até a
migration `CreateAddresses` ser aplicada manualmente no banco de desenvolvimento — o container de
teste (onde a suíte de integração roda) tinha a tabela, o Supabase de desenvolvimento não. Ver
`CLAUDE.md` do backend para a nota completa, incluindo o registro de que essa migration rodou sem
pedir confirmação explícita antes (diferente da de dinheiro, que foi bloqueada e pedida).

Validação: `tsc -b` e `npm run build` limpos (493 módulos). Clique real completo: cadastro de
endereço (nasce principal automaticamente) → checkout com o endereço pré-selecionado → pedido
criado com endereço congelado exibido no detalhe → edição do mesmo endereço (rua e cidade
diferentes) → pedido já criado continua mostrando o endereço original, não o editado. Nenhum teste
automatizado novo no frontend para este bloco — a lógica que mais importava (congelamento,
idempotência com endereço) mora no backend e já tem cobertura de integração lá; o frontend aqui é
consumo direto do contrato.

## Frete — 2026-09-09

Roadmap: `../projeto-test/docs/superpowers/specs/2026-09-09-roadmap-nucleo-comercial.md`, Fase 3.

Arquivo novo: `src/api/frete.ts` (`consultarFrete`). Modificados: `src/api/pedidos.ts`
(`criarPedido` ganha o parâmetro `modalidadeDeFrete`; `Pedido` ganha `subtotalEmCentavos`,
`freteEmCentavos`, `modalidadeDeFrete`, `prazoEmDiasUteis`), `src/pages/carrinho/tela-de-carrinho.tsx`
(cotação de frete após escolher endereço, rádio PAC/SEDEX com custo e prazo, total = subtotal +
frete), `src/pages/pedidos/tela-de-detalhe-do-pedido.tsx` (resumo subtotal/frete/total em `<dl>`).

Cotação dispara só quando há endereço selecionado e o carrinho não está vazio — depende dos dois.
Trocar de endereço reseta a modalidade escolhida (o custo da modalidade era para o endereço
anterior) e a chave de idempotência (o backend inclui `modalidadeDeFrete` no hash de conferência,
mesmo padrão de `enderecoId` já registrado na seção de endereços — ver `CLAUDE.md` do backend para
o motivo de a Fase 3 já ter nascido incluindo isso, sem esperar achar o bug de novo).

Validação: `tsc -b` e `npm run build` limpos (494 módulos). Clique real completo: endereço cadastrado
em Manaus/AM (região Norte, custo mais alto de propósito para o teste ser visível) → cotação exibiu
PAC R$ 30,00/12 dias úteis e SEDEX R$ 52,00/5 dias úteis → trocar de PAC para SEDEX atualizou o
total de R$ 129,90 para R$ 151,90 em tempo real, sem recarregar → pedido criado com o resumo exato
(subtotal R$ 99,90 + frete R$ 52,00 = R$ 151,90) → cancelamento confirmado. Nenhum teste automatizado
novo no frontend — mesma decisão da seção de endereços: a lógica que importa (cálculo, anti-forjamento
de custo, idempotência) mora no backend e já tem cobertura de integração lá.

**Nota de processo:** desta vez a migration `AddShipping` no banco de desenvolvimento foi pedida e
autorizada explicitamente antes de rodar — corrigindo o desvio registrado na Fase 2.

## Pagamento simulado + ciclo de entrega — 2026-09-10

Roadmap: `../projeto-test/docs/superpowers/specs/2026-09-09-roadmap-nucleo-comercial.md`, Fase 4 —
última fase do núcleo comercial. Backend concentra toda a lógica de aprovação/recusa, assinatura de
webhook e travas de concorrência (ver `CLAUDE.md` do backend, seção da mesma data, para a saga
completa de lock/freshness); o frontend só consome o contrato novo.

Arquivo novo: `src/api/pagamentos.ts` (`iniciarPagamento`, `listarPagamentos`). Modificados:
`src/api/pedidos.ts` (`SituacaoDoPedido` ganha `ENVIADO`/`ENTREGUE`), `src/pages/pedidos/tela-de-
detalhe-do-pedido.tsx` (novo componente `FormularioDePagamento` — campo único de número de cartão,
exibido só quando `situacao === 'PENDENTE'`; botões admin "Marcar como enviado"/"Marcar como
entregue" nas situações `PAGO`/`ENVIADO`, mesmo padrão de confirmação `window.confirm` já usado para
pagamento manual/cancelamento) + `.css` (estilos do formulário), `src/pages/admin/tela-de-pedidos-
admin.tsx` + `.css` (`SITUACOES` e badges de situação cobrindo os dois estados novos).

**Erro de recusa é recuperável, não terminal** — mesmo critério já registrado para
`TelaDeRedefinirSenha` (seção de recuperação de senha) e para o formulário de reenvio: cartão
recusado mostra `Aviso` inline com o motivo, mantém o formulário visível e o campo preenchido, para
o cliente corrigir e tentar de novo sem perder contexto. Só a listagem falhar de verdade (erro de
rede na consulta) usa o padrão de "carregando"/"tentar novamente" do resto do projeto.

Validação: `npx tsc -b` e `npm run build` limpos. Clique real de ponta a ponta contra backend e
frontend locais (`EMAIL_PROVIDER=file`): cadastro → verificação → endereço cadastrado (São
Paulo/SP) → carrinho com frete PAC → pedido criado (`PENDENTE`) → pagamento com cartão aprovado
(`4111111111111111`) → `PAGO` confirmado, formulário de pagamento e botão de cancelar somem
corretamente → segundo pedido pago com cartão terminado em `0002` → recusado, aviso exibido, pedido
continua `PENDENTE`, formulário disponível para nova tentativa → retry com cartão aprovado → `PAGO`
→ promovido o usuário de teste a ADMIN via `npm run seed:admin` (autorizado explicitamente antes de
rodar, mesmo critério de migration) só para testar a rota `/admin/pedidos/:id` → "Marcar como
enviado" → `ENVIADO`, botão de cancelar continua ausente (correto, pedido enviado não cancela) →
"Marcar como entregue" → `ENTREGUE`, tela terminal sem nenhum botão de ação. Usuário, endereço,
pedidos e pagamentos de teste removidos do banco de desenvolvimento ao final via script descartável
usando o `DataSource` do próprio backend, com confirmação prévia do proprietário antes da promoção a
ADMIN (mutação de papel em dado real). Nenhum teste automatizado novo no frontend — mesma decisão
das duas seções anteriores: a lógica que importa (assinatura de webhook, idempotência, travas de
concorrência, anti-forjamento de valor) mora no backend e já tem cobertura de integração lá.

**Revisão adversarial do Codex — 2 achados que tocaram este repositório (2026-09-10).** Rodada
depois da fase já estar verificada por clique real; os dois sobreviveram a isso. Ver o `CLAUDE.md`
do backend para a lista completa dos três achados.

- **Falha ambígua no pagamento deixava o comprador no escuro.** Se o POST de pagamento fosse
  processado no servidor mas a resposta (ou o `buscarPedido` seguinte) se perdesse, o `catch` do
  `FormularioDePagamento` só mostrava erro genérico e liberava "Pagar" outra vez — a tela seguia
  exibindo `PENDENTE` um pedido já `PAGO`, e a nova tentativa batia num 409 sem explicação.
  Corrigido com o prop `aoFalhaAmbigua`, que aciona o `precisaAtualizar` do componente pai — o
  mesmo mecanismo que `alterarComConfirmacao` já usava para esta classe de erro desde a gestão
  admin de pedidos. Era o padrão da casa; só não tinha sido ligado no caminho novo. Lição
  registrada: **componente filho novo que faz escrita precisa herdar o tratamento de resposta
  perdida do pai, não inventar um `erro` local**.
- **Botão "Marcar como pago manualmente" contornava o módulo de pagamento inteiro.** Removido
  daqui e do backend por decisão do proprietário. O tipo `SituacaoAlteravel` (`Exclude<..., 'PENDENTE'
  | 'PAGO'>`) existe para o compilador recusar a volta do botão por engano. Os 5 testes de
  `gestao-de-pedidos.test.tsx` que exercitavam essa ação foram reescritos sobre `PAGO→ENVIADO`,
  que é a escrita admin que sobrou, mais um teste novo que afirma a ausência do botão.

**Cobertura de pagamento na Fase Final (2026-09-10):** 4 testes novos em
`gestao-de-pedidos.test.tsx` (`describe('Pagamento')`) cobrindo recusa (formulário permanece),
aprovação (recarrega e some), e as duas formas de falha ambígua — o POST rejeitando e o GET
seguinte rejeitando depois de um pagamento aprovado. Esse último cenário é justamente o que um
clique real **não** consegue reproduzir (perder a resposta de propósito), então é onde o teste
automatizado vale mais que a verificação manual. Os quatro foram confirmados quebrando
`aoFalhaAmbigua` de propósito. Total do frontend: 45 testes.

**Armadilha ao escrever esses testes:** `mockResolvedValueOnce` **não funciona** para "primeira
carga X, recargas Y" nesta suíte — o `StrictMode` monta duas vezes, e a segunda montagem consome o
`Once`, fazendo a tela cair no estado de erro de carga. Usar `mockImplementation` com um sinalizador
(`pagou`) que muda quando a escrita acontece, em vez de contar chamadas.

**Nota de tester, não de bug:** durante o clique real, o primeiro cadastro de endereço "falhou"
silenciosamente (voltou para a lista vazia sem erro). Investigado como possível bug (logs do
backend, `GET /addresses` direto por curl) antes de perceber que a causa era preenchimento
incompleto do formulário (campos `required` de HTML vazios) — a validação nativa do navegador
bloqueou o `POST` antes mesmo de sair do cliente. Refeito com todos os campos preenchidos, sucesso
imediato. Registrado aqui só para não ser confundido com bug real numa releitura futura.

## Remoção de testes durante a auditoria de 2026-09 (histórico — parcialmente revertido acima)

Decisão do proprietário: reduzir o volume do código-fonte, mesmo motivo já registrado no backend.
Removidos por bloco conforme a auditoria pasta a pasta avançou. **Recuperáveis do histórico do
git** — os 107 testes existiam e passavam no commit anterior à auditoria.

Ao fim (blocos 13-16) saíram os últimos arquivos e também a infraestrutura, que ficaria configurando
uma suíte inexistente: `src/test/setup.ts`, o bloco `test` do `vite.config.ts` (que voltou a importar
`defineConfig` de `vite`, não de `vitest/config`) e os scripts `test`/`test:watch` do `package.json`.
As devDependencies de teste (`vitest`, `@testing-library/*`, `jsdom`) **foram mantidas**, mesmo
critério do backend: restaurar a suíte do git não deve exigir reinstalar pacote.

Consequência a considerar: não há mais rede de proteção automática. As armadilhas 1, 3, 6, 9, 12 e 13
desta lista foram todas encontradas por teste ou por reprodução em teste — mexer em sessão,
cancelamento ou StrictMode agora depende de verificação manual.

- **`src/auth/logout.test.tsx`** (3 testes) removido em 2026-09-04, junto com o bloco 12. Antes de
  remover, ele expôs um detalhe útil: o `beforeEach` limpava só `sessionStorage`, então o teste da
  saída pendente passava por vazamento de estado do teste anterior, não por testar o cenário. Isolado
  (`-t`), falhava de verdade — foi assim que confirmei a correção do `localStorage` descrita no item
  13 acima.
- **`src/api/*.test.ts`** (5 arquivos, 41 testes) removidos em 2026-09-04, junto com o bloco 11 da
  auditoria. Cobriam: fila de renovação e promessa única (`client.test.ts`), a corrida entre logout
  concorrente e renovação em voo (`session-races.test.ts`, incluindo o cenário do item 1 acima), o
  flake conhecido de `BroadcastChannel` (`multi-aba.test.ts`, item 8), e os wrappers de
  `products.ts`/`catalog-admin.ts`. A lógica de concorrência do `ApiClient` (contador de geração,
  `renovacaoBloqueada`, lock entre abas) foi revisada manualmente na auditoria e permanece correta,
  mas perdeu a rede de regressão automática — mexer em `client.ts` de novo exige atenção redobrada
  sem os testes para pegar um retrocesso silencioso.

## Regras duras da sessão

Nenhum comando `git` ou `gh` pode ser executado pela sessão, nem de leitura. Os comandos de commit
são entregues ao proprietário, em lotes de ~3 arquivos.

## Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | Sobe em `http://localhost:3001` (exige o backend em 3000) |
| `npm test` | Testes (Vitest) |
| `npx tsc -b` | Checagem de tipos |
| `npm run build` | Build de produção |

Variável de ambiente: `VITE_API_URL` (padrão `http://localhost:3000`).

## Gestão administrativa de pedidos — 2026-09-08

Rotas `/admin/pedidos` e `/admin/pedidos/:id`, ambas dentro de `RotaAdmin`. O menu do painel ganhou
Pedidos. Filtro Todas/Pendente/Pago/Cancelado e página ficam na URL; mudar filtro volta à primeira
página, voltar do detalhe preserva a consulta, e valores inválidos são normalizados antes do GET.
Página vazia além do resultado disponível oferece retorno à primeira página.

O detalhe existente agora recebe `contexto="admin"` na rota administrativa. ADMIN marca pendente
como pago e cancela pendente/pago; cliente mantém apenas cancelamento de pendente. Cancelado é
terminal. As confirmações deixam claro: marcar pago é registro manual, sem cobrança; cancelamento
devolve estoque, mas não executa reembolso financeiro. O servidor continua autorizando as operações.

> **Desatualizado desde 2026-09-10:** a marcação manual de pago (`PENDENTE→PAGO` por ADMIN) foi
> removida do frontend e do backend quando a revisão adversarial mostrou que ela contornava o
> módulo de pagamento inteiro. Hoje o ADMIN só cancela e executa os passos de logística. Ver a
> seção de pagamento acima.

Cada pedido tem uma instância de conteúdo identificada por contexto/id, e cada consulta de lista
tem uma instância identificada por página/situação. Leituras têm AbortController e descarte após
cleanup. Escritas têm trava síncrona e descarte após desmontagem. Se a resposta do PATCH falhar,
os itens continuam visíveis e novas ações ficam bloqueadas até uma leitura bem-sucedida por
"Atualizar pedido"; não há repetição automática do PATCH. Isso cobre conflito 409 e resposta perdida
depois de o servidor aplicar uma transição.

Reutilizados o cliente HTTP, a paginação e o detalhe; nenhum endpoint, migration ou dependência
novo. A paginação aceita rótulo acessível opcional. O cabeçalho compartilhado agora quebra linhas
em telas estreitas: validação em 375 px encontrou transbordamento de 522 px, corrigido para 375 px.
Tabelas mantêm rolagem horizontal dentro de uma região acessível, sem alargar a página.

Validação: **19 testes locais passaram**, build com checagem de tipos passou (485 módulos), lint
sem erros e sem avisos nos arquivos TS/TSX tocados. O lint global ainda emite 11 avisos em arquivos
não alterados. Navegador com API simulada validou filtro, paginação, confirmação, transições,
recuperação de resposta perdida sem repetir PATCH, bloqueio das rotas para CLIENTE/anônimo e layout
móvel/desktop. Nenhum pedido real foi alterado; integração contra banco real não foi executada.

Os testes desta entrega ficam fora de `src`, em
`.superpowers/sdd/2026-09-08-gestao-admin-pedidos/gestao-de-pedidos.test.tsx`, usando dependências já
instaladas e sem restaurar scripts/configuração de testes. Execução:
`npx.cmd --no-install vitest run .superpowers/sdd/2026-09-08-gestao-admin-pedidos/gestao-de-pedidos.test.tsx --environment jsdom`.
Esse diretório é local/ignorado, portanto esta verificação não acompanha um clone.

Spec em `../projeto-test/docs/superpowers/specs/2026-09-08-gestao-admin-pedidos-design.md` e relatório
final/comandos de commit em `.superpowers/sdd/2026-09-08-gestao-admin-pedidos/progress.md`.
