import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Botao } from '../ui/indice';

// ---------------------------------------------
// Busca do cabeçalho
// Não faz requisição própria: quem busca é a tela de catálogo, lendo o
// parâmetro "busca" da URL — o mesmo contrato que o filtro da vitrine
// (FiltroDeProdutosView/filtroDaUrl) já usa. Isso preserva a regra de que a
// consulta compartilhável é a fonte da verdade: colar o link, voltar pelo
// histórico ou recarregar a página têm que reproduzir a mesma busca. Os
// demais parâmetros já presentes na URL (categoria, página) são preservados
// só quando a busca acontece a partir do próprio catálogo; fora dele o
// campo começa vazio e a busca simplesmente abre a vitrine filtrada.
// ---------------------------------------------
export function Busca() {
  const navegar = useNavigate();
  const local = useLocation();
  const [parametrosAtuais] = useSearchParams();
  const naVitrine = local.pathname === '/produtos';
  const [valor, setValor] = useState(() =>
    naVitrine ? (parametrosAtuais.get('busca') ?? '') : '',
  );

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const parametros = new URLSearchParams(
      naVitrine ? parametrosAtuais : undefined,
    );
    if (valor.trim()) {
      parametros.set('busca', valor.trim());
    } else {
      parametros.delete('busca');
    }
    parametros.delete('pagina');
    navegar(`/produtos?${parametros.toString()}`);
  }

  return (
    <form
      role="search"
      className="flex w-full min-w-0 gap-2"
      onSubmit={aoEnviar}
    >
      <label htmlFor="busca-do-cabecalho" className="sr-only">
        Buscar produto
      </label>
      <input
        id="busca-do-cabecalho"
        type="search"
        name="nome"
        placeholder="Buscar produtos…"
        value={valor}
        onChange={(evento) => setValor(evento.target.value)}
        className="min-h-13 min-w-0 w-full rounded-card border border-borda-forte bg-superficie px-4 text-lg text-tinta placeholder:text-tinta-media focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      />
      <Botao
        type="submit"
        aria-label="Buscar"
        tamanho="pequeno"
        className="shrink-0 focus-visible:outline-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Buscar</span>
      </Botao>
    </form>
  );
}
