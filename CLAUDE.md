# CLAUDE.md — projeto-test-web

Frontend em React + Vite + TypeScript que consome a API do `projeto-test` (NestJS), projeto irmão
neste mesmo diretório pai.

> Este arquivo é o registro durável do frontend. As specs vivem em
> `../projeto-test/docs/superpowers/specs/` (repo irmão) e o ledger de execução em
> `.superpowers/sdd/` (aqui mesmo) — nenhum dos dois é versionado neste repositório. Se ele for
> clonado sozinho, só o que estiver aqui sobrevive. Atualize ao fim de cada bloco de trabalho.

## Estado atual

Fundação, autenticação, vitrine, painel administrativo e fluxo de compra do cliente prontos. Última
atualização: 2026-09-08.

| Área | Estado |
|---|---|
| Cliente HTTP | Token em memória, fila de refresh, tratamento de erro da API |
| Sessão | Três estados (verificando/autenticado/anônimo), recuperação por cookie, rota protegida e rota restrita a ADMIN |
| Telas | Login, cadastro, verificação de email, inicial autenticada, vitrine, detalhe de produto, dashboard admin, listagem e formulários de produtos e categorias, carrinho, meus pedidos, detalhe de pedido |
| Sistema visual | Tokens de cor, tipografia e motion; primitivos de botão, campo e aviso; subnavegação administrativa |
| Vitrine | Completa — busca/categoria/página na URL, debounce, cancelamento, retry, estados de carregamento/vazio/erro e detalhe com retorno ao filtro |
| Painel Admin | Completo — métricas em paralelo, paginação de produtos/categorias, CRUD com confirmação de remoção, exibição de conflito (409) e cancelamento de requisições por `AbortController` |
| Carrinho, pedidos | Completo — carrinho persistido em `localStorage` limpo no logout, adicionar com teto de estoque, checkout com `Idempotency-Key` estável entre retries, "meus pedidos" paginado, detalhe com cancelamento (`PENDENTE`→`CANCELADO`) — ver seção própria abaixo |
| Testes | **Nenhum.** Todos removidos na auditoria de 2026-09-04, junto com a infraestrutura (`src/test/`, bloco `test` do `vite.config.ts`, scripts `test`/`test:watch`) — ver nota abaixo |

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

## Remoção de testes durante a auditoria de 2026-09

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
