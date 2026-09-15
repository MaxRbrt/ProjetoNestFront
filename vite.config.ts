import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// ---------------------------------------------
// Configuração da aplicação
// A porta 3001 é fixa e strictPort impede o Vite de escolher outra quando ela
// está ocupada — o backend só libera no CORS a origem declarada em
// FRONTEND_URL, e subir em outra porta quebraria login e refresh de um jeito
// difícil de diagnosticar.
//
// defineConfig vem de vitest/config, não de vite: é o que dá tipo ao bloco
// `test` abaixo. Trocar essa importação de volta faz o TypeScript recusar o
// bloco inteiro — foi assim que a configuração vivia antes de a suíte ser
// removida na auditoria de 2026-09-04.
// ---------------------------------------------
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3001,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Só src: o padrão do Vitest varre a raiz inteira e pegava um teste que
    // morava em .superpowers/sdd/, diretório local e ignorado pelo git. A
    // suíte precisa ser a mesma para quem clona o repositório, senão "todos
    // os testes passam" quer dizer coisas diferentes em máquinas diferentes.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
