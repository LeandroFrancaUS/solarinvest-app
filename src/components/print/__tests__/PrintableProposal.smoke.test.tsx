import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { render } from '@testing-library/react'
import { Boundary } from '../../../app/Boundary'
import PrintableProposal from '../PrintableProposal'
import type { PrintableProposalProps } from '../../../types/printableProposal'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Label: () => null,
  LabelList: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  YAxis: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const createProps = (): PrintableProposalProps => ({
  cliente: {
    nome: 'Cliente Teste',
    documento: '000.000.000-00',
    email: 'cliente@teste.com',
    telefone: '(41) 99999-9999',
    cep: '80000-000',
    distribuidora: 'Copel',
    uc: '123456',
    endereco: 'Rua das Flores, 100',
    cidade: 'Curitiba',
    uf: 'PR',
    temIndicacao: false,
    indicacaoNome: '',
  },
  budgetId: 'ORC123',
  anos: [1, 2, 3],
  leasingROI: [0, 0, 0],
  financiamentoFluxo: [0, 0, 0],
  financiamentoROI: [0, 0, 0],
  mostrarFinanciamento: false,
  tabelaBuyout: [],
  buyoutResumo: {
    vm0: 0,
    cashbackPct: 0,
    depreciacaoPct: 0,
    inadimplenciaPct: 0,
    tributosPct: 0,
    infEnergia: 0,
    ipca: 0,
    custosFixos: 0,
    opex: 0,
    seguro: 0,
    duracao: 0,
  },
  capex: 30000,
  tipoProposta: 'VENDA_DIRETA',
  geracaoMensalKwh: 600,
  potenciaModulo: 550,
  numeroModulos: 12,
  potenciaInstaladaKwp: 6.6,
  tipoInstalacao: 'TELHADO',
  tipoSistema: 'ON_GRID',
  areaInstalacao: 10,
  descontoContratualPct: 0,
  parcelasLeasing: [],
  leasingValorDeMercadoEstimado: null,
  leasingPrazoContratualMeses: null,
  leasingValorInstalacaoCliente: null,
  leasingDataInicioOperacao: null,
  leasingValorMercadoProjetado: null,
  leasingInflacaoEnergiaAa: null,
  distribuidoraTarifa: 'Copel',
  energiaContratadaKwh: 600,
  tarifaCheia: 0.95,
  vendaResumo: undefined,
  parsedPdfVenda: undefined,
  orcamentoItens: [],
  composicaoUfv: undefined,
  vendaSnapshot: undefined,
  informacoesImportantesObservacao: null,
  multiUcResumo: null,
})

describe('PrintableProposal smoke', () => {
  it('renderiza dentro do Boundary sem lançar erros', () => {
    const props = createProps()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      let renderResult: ReturnType<typeof render> | undefined
      expect(() => {
        renderResult = render(
          <Boundary>
            <PrintableProposal {...props} />
          </Boundary>,
        )
      }).not.toThrow()

      const container = renderResult?.container
      expect(container?.textContent ?? '').toContain('Proposta de Venda Solar')

      const hasReferenceError = consoleErrorSpy.mock.calls.some((callArgs: unknown[]) =>
        callArgs.some(
          (arg: unknown) =>
            typeof arg === 'string' && arg.includes('Cannot access uninitialized variable'),
        ),
      )

      expect(hasReferenceError).toBe(false)
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})
