import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ApiClient } from '../../api/cliente';
import type { MetricasDoPainel } from '../../api/metricas';
import { TelaDeDashboardAdmin } from './tela-de-dashboard-admin';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function metricas(
  periodo: MetricasDoPainel['periodo'] = '7d',
  faturamentoPorDia: number[] = [0, 25980, 0, 0, 0, 103010, 0],
): MetricasDoPainel {
  return {
    periodo,
    fuso: 'America/Sao_Paulo',
    janela: {
      inicio: '2026-09-10T03:00:00.000Z',
      fim: '2026-09-16T17:00:00.000Z',
    },
    resumo: {
      faturamentoEmCentavos: {
        atual: faturamentoPorDia.reduce((soma, valor) => soma + valor, 0),
        anterior: 115170,
      },
      pedidos: { atual: 14, anterior: 14 },
      ticketMedioEmCentavos: { atual: 11726, anterior: 0 },
      taxaDeRecusa: { atual: 0.125, anterior: 0.1 },
    },
    vendasPorDia: faturamentoPorDia.map((valor, indice) => ({
      dia: `2026-09-${String(10 + indice).padStart(2, '0')}`,
      faturamentoEmCentavos: valor,
      pedidos: valor > 0 ? 1 : 0,
    })),
  };
}

function Consulta() {
  return <output data-testid="consulta">{useLocation().search}</output>;
}

function abrir(get: ReturnType<typeof vi.fn>, entrada = '/admin') {
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <TelaDeDashboardAdmin cliente={{ get } as unknown as ApiClient} />
      <Consulta />
    </MemoryRouter>,
  );
}

// ---------------------------------------------
// Dashboard administrativo
// A tela lê um único endpoint de indicadores. O período vive na URL, uma
// troca de período descarta a resposta atrasada da consulta anterior e a
// variação chega como frase — a cor não carrega a informação sozinha.
// ---------------------------------------------
describe('TelaDeDashboardAdmin', () => {
  it('abre em 7 dias e mostra os indicadores com a variação escrita', async () => {
    const get = vi.fn().mockResolvedValue(metricas());
    abrir(get);

    expect(get).toHaveBeenCalledWith(
      '/admin/metricas?periodo=7d',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const faturamento = await screen.findByRole('group', {
      name: 'Faturamento',
    });
    expect(within(faturamento).getByText(/1\.289,90/)).toBeInTheDocument();
    expect(
      within(faturamento).getByText('12% acima do período anterior'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Pedidos' })).getByText(
        'Igual ao período anterior',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Ticket médio' })).getByText(
        'Sem base de comparação',
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', { name: 'Pagamentos recusados' }),
      ).getByText('12,5%'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('troca de período pela URL e ignora a resposta atrasada', async () => {
    let responderAntiga: (valor: MetricasDoPainel) => void = () => {};
    const get = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<MetricasDoPainel>((resolver) => {
            responderAntiga = resolver;
          }),
      )
      .mockResolvedValueOnce(
        metricas('30d', [0, 0, 0, 0, 0, 0, 50000]),
      );
    abrir(get);

    fireEvent.click(screen.getByRole('button', { name: '30 dias' }));

    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(
        '/admin/metricas?periodo=30d',
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('consulta')).toHaveTextContent('periodo=30d');
    await screen.findByText(/500,00/, { selector: 'p' });

    responderAntiga(metricas('7d'));
    await Promise.resolve();

    expect(screen.queryByText(/1\.289,90/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('período desconhecido na URL volta para 7 dias', () => {
    const get = vi.fn().mockResolvedValue(metricas());
    abrir(get, '/admin?periodo=365d');

    expect(get).toHaveBeenCalledWith(
      '/admin/metricas?periodo=7d',
      expect.anything(),
    );
  });

  it('falha mostra aviso e permite tentar de novo', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce(metricas());
    abrir(get);

    expect(
      await screen.findByText('Não foi possível carregar os indicadores.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await screen.findByRole('group', { name: 'Faturamento' }),
    ).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('período sem vendas troca o gráfico por uma frase', async () => {
    const get = vi
      .fn()
      .mockResolvedValue(metricas('7d', [0, 0, 0, 0, 0, 0, 0]));
    abrir(get);

    expect(
      await screen.findByText('Nenhuma venda neste período.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('gráfico tem descrição e tabela com uma linha por dia', async () => {
    const get = vi.fn().mockResolvedValue(metricas());
    abrir(get);

    const grafico = await screen.findByRole('img');
    expect(grafico).toHaveAccessibleName(/Faturamento por dia/);
    expect(grafico).toHaveAccessibleName(/maior venda.*15\/09/i);

    const tabela = screen.getByRole('table', { hidden: true });
    expect(within(tabela).getAllByRole('row', { hidden: true })).toHaveLength(
      8,
    );
  });
});
