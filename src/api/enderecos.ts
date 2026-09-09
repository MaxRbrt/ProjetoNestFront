import type { ApiClient } from './cliente';

export interface Endereco {
  id: number;
  apelido: string;
  destinatario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  principal: boolean;
  criadoEm: string;
}

export interface DadosDeEndereco {
  apelido: string;
  destinatario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  principal?: boolean;
}

// ---------------------------------------------
// Sem paginação de propósito: ninguém cadastra dezenas de endereços de
// entrega, e o checkout precisa da lista inteira para pré-selecionar o
// principal — mesmo contrato do backend (EnderecosController.listar).
// ---------------------------------------------
export function listarEnderecos(
  cliente: ApiClient,
  signal?: AbortSignal,
): Promise<Endereco[]> {
  return cliente.get<Endereco[]>('/addresses', { signal });
}

export function criarEndereco(
  cliente: ApiClient,
  dados: DadosDeEndereco,
): Promise<Endereco> {
  return cliente.post<Endereco>('/addresses', dados);
}

export function atualizarEndereco(
  cliente: ApiClient,
  id: number,
  dados: Partial<DadosDeEndereco>,
): Promise<Endereco> {
  return cliente.patch<Endereco>(`/addresses/${id}`, dados);
}

export function removerEndereco(cliente: ApiClient, id: number): Promise<void> {
  return cliente.delete<void>(`/addresses/${id}`);
}
