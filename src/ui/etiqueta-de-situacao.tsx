export interface PropsDaEtiquetaDeSituacao {
  situacao: string;
  rotulo: string;
}

const TONS: Record<string, string> = {
  pendente: 'bg-acento-suave text-acento-escuro',
  pago: 'bg-sucesso-suave text-marca',
  enviado: 'bg-sucesso-suave text-marca',
  entregue: 'bg-sucesso-suave text-marca',
  cancelado: 'bg-erro-suave text-erro',
};

// ---------------------------------------------
// Etiqueta de situação do pedido
// Compartilhada entre as telas do cliente e o painel admin: o tom vem da
// própria situação em minúsculas, sem precisar de um mapa à parte em cada
// tela que a usa. O rótulo fica sozinho no nó de texto do elemento — nunca
// concatenado com data ou outro conteúdo — porque os testes localizam a
// etiqueta por esse texto (findByText('Pago'), findByText('Enviado')).
// ---------------------------------------------
export function EtiquetaDeSituacao({
  situacao,
  rotulo,
}: PropsDaEtiquetaDeSituacao) {
  const tom =
    TONS[situacao.toLowerCase()] ?? 'bg-superficie-sutil text-tinta-media';

  return (
    <span
      className={`inline-flex items-center rounded-pilula px-3 py-1.5 text-base font-semibold ${tom}`}
    >
      {rotulo}
    </span>
  );
}
