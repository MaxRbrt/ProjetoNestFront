import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// ---------------------------------------------
// Preparação comum dos testes
// A limpeza do localStorage entre casos não é zelo: o carrinho persiste nele,
// e um teste que deixa item gravado faz o seguinte começar com estado do
// anterior. Foi exatamente esse vazamento entre testes que, na suíte antiga,
// fez um caso de saída pendente passar por engano — ver a nota sobre
// logout.test.tsx no CLAUDE.md.
// ---------------------------------------------
afterEach(() => {
  cleanup();
  localStorage.clear();
});
