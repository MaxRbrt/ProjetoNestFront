import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelaDeEntrada } from './tela-de-entrada';

const entrarMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../auth/contexto-de-sessao', () => ({
  useSessao: () => ({ entrar: entrarMock, saidaNaoConfirmada: false }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function DestinoObservado() {
  const local = useLocation();
  return <p data-testid="destino">{local.pathname + local.search}</p>;
}

function renderizar(caminhoInicial: string) {
  render(
    <MemoryRouter initialEntries={[caminhoInicial]}>
      <Routes>
        <Route path="/entrar" element={<TelaDeEntrada />} />
        <Route path="*" element={<DestinoObservado />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function preencherEEnviar() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'quem@exemplo.com' },
  });
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'senha-qualquer' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByTestId('destino');
}

// ---------------------------------------------
// Destino pós-login de TelaDeEntrada
// caminhoInternoSeguro é a única porta de entrada para "?retorno=": um valor
// interno válido vira destino de navegação, e um valor externo (tentativa de
// redirecionamento aberto) é descartado e cai no destino padrão "/".
// ---------------------------------------------
describe('TelaDeEntrada', () => {
  it('após login bem-sucedido navega para o caminho de "?retorno="', async () => {
    renderizar('/entrar?retorno=%2Fprodutos%2F9');
    await preencherEEnviar();
    expect(screen.getByTestId('destino')).toHaveTextContent('/produtos/9');
  });

  it('ignora "?retorno=" para fora da origem e vai para "/"', async () => {
    renderizar('/entrar?retorno=%2F%2Fevil.com');
    await preencherEEnviar();
    expect(screen.getByTestId('destino')).toHaveTextContent('/');
  });
});
