import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// ---------------------------------------------
// Configuração da aplicação
// A porta 3001 é fixa e strictPort impede o Vite de escolher outra quando ela
// está ocupada — o backend só libera no CORS a origem declarada em
// FRONTEND_URL, e subir em outra porta quebraria login e refresh de um jeito
// difícil de diagnosticar.
// ---------------------------------------------
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
  },
});
