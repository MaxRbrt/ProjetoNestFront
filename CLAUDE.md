# CLAUDE.md — projeto-test-web

Frontend em React + Vite + TypeScript que consome a API do `projeto-test` (NestJS), projeto irmão
neste mesmo diretório pai.

> Este arquivo é o registro durável do frontend. As specs vivem em
> `../projeto-test/docs/superpowers/specs/` (repo irmão) e o ledger de execução em
> `.superpowers/sdd/` (aqui mesmo) — nenhum dos dois é versionado neste repositório. Se ele for
> clonado sozinho, só o que estiver aqui sobrevive. Atualize ao fim de cada bloco de trabalho.

## Estado atual

Fundação, autenticação, vitrine e painel administrativo prontos. Última atualização: 2026-09-01.

| Área | Estado |
|---|---|
| Cliente HTTP | Token em memória, fila de refresh, tratamento de erro da API |
| Sessão | Três estados (verificando/autenticado/anônimo), recuperação por cookie, rota protegida e rota restrita a ADMIN |
| Telas | Login, cadastro, verificação de email, inicial autenticada, vitrine, detalhe de produto, dashboard admin, listagem e formulários de produtos e categorias |
| Sistema visual | Tokens de cor, tipografia e motion; primitivos de botão, campo e aviso; subnavegação administrativa |
| Vitrine | Completa — busca/categoria/página na URL, debounce, cancelamento, retry, estados de carregamento/vazio/erro e detalhe com retorno ao filtro |
| Painel Admin | Completo — métricas em paralelo, paginação de produtos/categorias, CRUD com confirmação de remoção, exibição de conflito (409) e cancelamento de requisições por `AbortController` |
| Testes | 107 (Vitest + Testing Library em 26 suítes) |
| Carrinho, pedidos | Não iniciados |

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
