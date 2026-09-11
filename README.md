# projeto-test-web

Frontend em React + Vite + TypeScript para a API `projeto-test` (NestJS), projeto irmão.

Estética: brutalismo refinado — grade visível, cores sólidas, sombra sólida (deslocamento sem
desfoque), cantos retos. Motion tratado como parte do design system, não decoração: movimento
sempre carrega informação (fila de refresh, transições de estado, entrada escalonada de listas).

## Requisitos

- Node.js 20+
- API `projeto-test` rodando em `http://localhost:3000` (CORS liberado só para `localhost:3001`)

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Sobe em `http://localhost:3001` — porta fixa (`strictPort`), porque o backend só libera essa origem
no CORS.

## Variáveis de ambiente

| Variável | Padrão | Observação |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Base da API |

## O que está implementado

- **Autenticação** — login, cadastro, verificação de email, sessão recuperada por cookie
  `httpOnly` no carregamento, rota protegida.
- **Vitrine de produtos** — busca com debounce, filtro por categoria, paginação, todos
  sincronizados na URL; cancelamento de requisição obsoleta; estados de carregamento, vazio e erro;
  detalhe de produto com retorno preservando o filtro e imagem opcional.
- **Compra** — carrinho persistido por usuário, endereços de entrega, cotação de frete, pedido
  idempotente, pagamentos simulados e histórico/detalhe de pedidos.
- **Administração** — CRUD de produtos, categorias e imagens, além de acompanhamento e transição
  de pedidos.


## Arquitetura de autenticação (por que é assim)

O access token vive em memória, nunca em `localStorage` — um XSS não levaria a sessão embora. O
refresh vive num cookie `httpOnly`/`sameSite=strict`, invisível ao JavaScript; toda requisição usa
`credentials: 'include'`.

O refresh do backend é **rotativo** (cada uso invalida o anterior), então o cliente HTTP mantém uma
fila: várias requisições recebendo `401` ao mesmo tempo disparam um único `/auth/refresh`, não um
por requisição — sem isso, a segunda apresentaria token já queimado e derrubaria a sessão à toa.

Detalhes e armadilhas já resolvidas (StrictMode, `<br/>` quebrando leitor de tela, debounce que
precisa cancelar o temporizador e não só o fetch) estão documentados em `CLAUDE.md`.

## Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (Vitest + Testing Library) |
| `npx tsc -b` | Checagem de tipos |
| `npm run build` | Build de produção |
| `npm run lint` | Oxlint |

## Estrutura

```
src/
├─ api/          cliente HTTP e contratos da API
├─ auth/         sessão e rotas protegidas
├─ carrinho/     estado persistido por identidade
├─ components/   primitivos de interface
├─ hooks/        dados da vitrine
├─ motion/       tokens e variantes reutilizáveis
├─ pages/        telas públicas, compra e administração
└─ styles/       tokens de design
```

## Testes

Os testes Vitest + Testing Library cobrem lógica com risco real — fila de refresh sob
concorrência, StrictMode, debounce/cancelamento, ownership de sessão — não aparência: layout e
animação se verificam olhando.

```bash
npm test
```

## Licença

Projeto de estudo, sem licença de uso definida.
