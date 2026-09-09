// ---------------------------------------------
// Unidades federativas válidas
// Espelha src/modules/enderecos/dto/uf.ts do backend — lista fechada em vez
// de aceitar qualquer texto de 2 letras, mesmo motivo: "XX" só falharia
// muito mais longe da causa se validado apenas no servidor.
// ---------------------------------------------
export const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
