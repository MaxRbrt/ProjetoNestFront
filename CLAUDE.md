# CLAUDE.md — projeto-test-web

Frontend em React + Vite + TypeScript que consome a API do `projeto-test` (NestJS), projeto irmão
neste mesmo diretório pai.

> Este arquivo é o registro durável do frontend. As specs vivem em
> `../projeto-test/docs/superpowers/specs/` (repo irmão) e o ledger de execução em
> `.superpowers/sdd/` (aqui mesmo) — nenhum dos dois é versionado neste repositório. Se ele for
> clonado sozinho, só o que estiver aqui sobrevive. Atualize ao fim de cada bloco de trabalho.

## Estado atual

Fundação, autenticação e vitrine prontas. Última atualização: 2026-08-31.

| Área | Estado |
|---|---|
| Cliente HTTP | Token em memória, fila de refresh, tratamento de erro da API |
| Sessão | Três estados (verificando/autenticado/anônimo), recuperação por cookie, rota protegida |
| Telas | Login, cadastro, verificação de email, inicial autenticada, vitrine e detalhe de produto |
| Sistema visual | Tokens de cor, tipografia e motion; primitivos de botão, campo e aviso |
| Vitrine | Completa — busca/categoria/página na URL, debounce, cancelamento, retry, estados de carregamento/vazio/erro e detalhe com retorno ao filtro |
| Testes | 72 (Vitest + Testing Library) |
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

## Sistema visual e motion

Direção atual: brutalismo refinado — grade visível, cores sólidas, sombra **sólida** (deslocamento
sem desfoque), cantos retos, tipografia pesada.

**A regra que mantém a coerência:** no brutalismo o movimento *encaixa*, não flutua. Duração curta
(120–180ms em feedback), curva com parada seca, deslocamento nos eixos da grade. Animação suave e
demorada aqui parece um tema aplicado por cima.

Os tokens ficam em `src/motion/tokens.ts` e `src/styles/tokens.css`, e **espelham um ao outro** de
propósito: componentes animados pelo Motion e elementos animados por CSS precisam ter o mesmo tempo,
senão a interface parece ter duas personalidades. Nenhuma tela deve inventar duração ou curva
própria.

`prefers-reduced-motion` é obrigatório, não opcional: movimento seco e rápido é justamente o que
incomoda quem tem sensibilidade vestibular. No modo reduzido tudo vira transição de opacidade.

**Movimento só entra quando carrega informação** — entrada escalonada comunica chegada de conteúdo;
deslocamento no erro dá feedback antes da leitura; transição de elemento compartilhado preserva
continuidade espacial. Enfeite sem função não entra.

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
