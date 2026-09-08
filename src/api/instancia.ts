import { ApiClient } from './cliente';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------
// Instância única do cliente
// Precisa ser única na aplicação inteira: é ela que guarda o access token em
// memória e serializa a renovação. Duas instâncias teriam tokens distintos e
// disputariam o refresh rotativo, derrubando a sessão.
// ---------------------------------------------
export const apiClient = new ApiClient({ baseUrl });
