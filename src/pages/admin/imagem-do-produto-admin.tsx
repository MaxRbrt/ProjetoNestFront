import { useEffect, useId, useRef, useState } from 'react';
import { Aviso, Botao, Cartao, classesDeBotao } from '../../ui/indice';

interface PropsDaImagem {
  arquivo: File | null;
  urlAtual: string | null;
  erro: string | null;
  removendo: boolean;
  aoSelecionar: (arquivo: File | null, erro: string | null) => void;
  aoRemover: () => Promise<void>;
}

export function ImagemDoProdutoAdmin({
  arquivo,
  urlAtual,
  erro,
  removendo,
  aoSelecionar,
  aoRemover,
}: PropsDaImagem) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  const botaoDeSelecao = useRef<HTMLButtonElement>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const imagem = previa ?? urlAtual;

  // A seleção cria a prévia; trocar, descartar ou desmontar libera a URL.
  // Nenhuma imagem local é persistida antes de salvar o produto.
  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa);
    },
    [previa],
  );

  function selecionar(arquivoSelecionado: File | undefined) {
    if (!arquivoSelecionado) return;
    setConfirmando(false);
    setPrevia(null);
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(
        arquivoSelecionado.type,
      )
    ) {
      aoSelecionar(null, 'Escolha uma imagem JPEG, PNG ou WebP.');
    } else if (arquivoSelecionado.size > 2 * 1024 * 1024) {
      aoSelecionar(null, 'A imagem deve ter no máximo 2 MB.');
    } else {
      setPrevia(URL.createObjectURL(arquivoSelecionado));
      aoSelecionar(arquivoSelecionado, null);
    }
  }

  function descartar() {
    setPrevia(null);
    aoSelecionar(null, null);
    if (campo.current) campo.current.value = '';
    botaoDeSelecao.current?.focus();
  }

  async function confirmarRemocao() {
    await aoRemover();
    setConfirmando(false);
    botaoDeSelecao.current?.focus();
  }

  return (
    <Cartao
      como="section"
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-titulo`} className="text-xl font-semibold text-tinta">
          Imagem do produto
        </h2>
        <span className="text-base text-tinta-media">Opcional</span>
      </div>
      {imagem ? (
        <div className="rounded-card border border-borda bg-superficie-sutil p-4">
          <img
            src={imagem}
            className="h-56 w-full object-contain"
            width={560}
            height={224}
            alt={
              previa
                ? 'Pré-visualização da imagem selecionada'
                : 'Imagem atual do produto'
            }
          />
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-borda-forte bg-superficie-sutil p-6 text-center">
          <p className="font-medium text-tinta">Nenhuma imagem adicionada</p>
          <p className="text-base text-tinta-media">
            Adicione a foto que aparecerá no catálogo.
          </p>
        </div>
      )}
      <input
        ref={campo}
        aria-label="Imagem"
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={(evento) => selecionar(evento.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-3">
        <button
          ref={botaoDeSelecao}
          type="button"
          className={classesDeBotao({
            variante: 'secundario',
            tamanho: 'pequeno',
          })}
          aria-describedby={`${id}-ajuda${erro ? ` ${id}-erro` : ''}`}
          onClick={() => campo.current?.click()}
        >
          {arquivo || urlAtual ? 'Trocar imagem' : 'Selecionar imagem'}
        </button>
        {arquivo || erro ? (
          <Botao
            type="button"
            variante="fantasma"
            tamanho="pequeno"
            onClick={descartar}
          >
            Descartar seleção
          </Botao>
        ) : urlAtual && !confirmando ? (
          <Botao
            type="button"
            variante="perigo"
            tamanho="pequeno"
            onClick={() => setConfirmando(true)}
          >
            Remover imagem
          </Botao>
        ) : null}
      </div>
      <p id={`${id}-ajuda`} className="text-base text-tinta-media">
        Uma imagem em JPEG, PNG ou WebP, até 2 MB.
      </p>
      {arquivo ? (
        <p role="status" className="break-words text-base text-tinta-media">
          <span className="font-medium text-tinta">{arquivo.name}</span>
          <br />
          Imagem selecionada. Será enviada ao salvar o produto.
        </p>
      ) : null}
      {erro ? (
        <div id={`${id}-erro`}>
          <Aviso>{erro}</Aviso>
        </div>
      ) : null}
      {confirmando ? (
        <div className="flex flex-col gap-3 border-t border-borda pt-4">
          <p role="status" className="text-base text-tinta">
            Remover esta imagem do catálogo? A remoção será aplicada agora.
          </p>
          <div className="flex flex-wrap gap-3">
            <Botao
              type="button"
              variante="perigo"
              tamanho="pequeno"
              carregando={removendo}
              onClick={() => void confirmarRemocao()}
            >
              {removendo ? 'Removendo…' : 'Confirmar remoção'}
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              tamanho="pequeno"
              onClick={() => {
                setConfirmando(false);
                botaoDeSelecao.current?.focus();
              }}
            >
              Manter imagem
            </Botao>
          </div>
        </div>
      ) : null}
    </Cartao>
  );
}
