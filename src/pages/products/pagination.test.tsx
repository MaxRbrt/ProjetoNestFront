import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacao } from './pagination';

describe('Paginacao', () => {
  it('desabilita "anterior" na primeira página', () => {
    render(<Paginacao pagina={1} totalDePaginas={5} aoMudar={vi.fn()} />);

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
  });

  it('desabilita "próxima" na última página', () => {
    render(<Paginacao pagina={5} totalDePaginas={5} aoMudar={vi.fn()} />);

    expect(screen.getByRole('button', { name: /próxima/i })).toBeDisabled();
  });

  it('avisa a página seguinte ao clicar em "próxima"', async () => {
    const aoMudar = vi.fn();
    render(<Paginacao pagina={2} totalDePaginas={5} aoMudar={aoMudar} />);

    await userEvent.click(screen.getByRole('button', { name: /próxima/i }));

    expect(aoMudar).toHaveBeenCalledWith(3);
  });

  it('não renderiza nada quando há uma página só', () => {
    const { container } = render(
      <Paginacao pagina={1} totalDePaginas={1} aoMudar={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
