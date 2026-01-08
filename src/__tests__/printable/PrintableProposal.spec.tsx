import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import PrintableProposal from '../../components/print/PrintableProposal'
import type { PrintableProposalProps } from '../../types/printableProposal'

const DEFAULT_COLORS = ['#FFA500', '#FF7F50', '#FFD700'] as const

const createPrintableProps = (overrides: Partial<PrintableProposalProps> = {}): PrintableProposalProps => ({
  cliente: {
    nome: 'Cliente Teste',
    documento: '000.000.000-00',
    rg: '12.345.678-9',
    estadoCivil: 'Solteiro(a)',
    email: 'cliente@teste.com',
    telefone: '(41) 99999-9999',
    cep: '80000-000',
    distribuidora: 'Copel',
    uc: '123456',
    endereco: 'Rua das Flores, 100',
    enderecoInstalacaoUcGeradora: 'Rua das Flores, 100',
    cidade: 'Curitiba',
    uf: 'PR',
    temIndicacao: false,
    indicacaoNome: '',
    herdeiros: [''],
    nomeSindico: '',
    cpfSindico: '',
    contatoSindico: '',
  },
  budgetId: 'ORC123',
  anos: Array.from({ length: 30 }, (_, index) => index + 1),
  leasingROI: Array.from({ length: 30 }, (_, index) => (index + 1) * 1000),
  financiamentoFluxo: Array.from({ length: 30 }, () => 0),
  financiamentoROI: Array.from({ length: 30 }, (_, index) => (index + 1) * 500),
  mostrarFinanciamento: true,
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
  capex: 25000,
  tipoProposta: 'VENDA_DIRETA',
  geracaoMensalKwh: 500,
  potenciaModulo: 550,
  numeroModulos: 12,
  potenciaInstaladaKwp: 6.6,
  tipoInstalacao: 'fibrocimento',
  tipoSistema: 'ON_GRID',
  tipoRede: 'monofasico',
  areaInstalacao: 15,
  descontoContratualPct: 0,
  parcelasLeasing: [],
  distribuidoraTarifa: 'Copel',
  energiaContratadaKwh: 450,
  tarifaCheia: 0.95,
  orcamentoItens: [],
  vendaResumo: undefined,
  parsedPdfVenda: undefined,
  composicaoUfv: undefined,
  vendaSnapshot: undefined,
  informacoesImportantesObservacao: null,
  multiUcResumo: null,
  vendasConfigSnapshot: undefined,
  valorTotalProposta: 25000,
  economiaEstimativaValor: null,
  economiaEstimativaHorizonteAnos: null,
  custoImplantacaoReferencia: null,
  modoVenda: undefined,
  ucGeradora: {
    numero: '123456',
    endereco: 'Rua das Flores, 100 — Curitiba / PR — CEP 80000-000',
  },
  ucsBeneficiarias: [
    {
      numero: '654321',
      endereco: 'Av. das Torres, 500 — Curitiba / PR',
      rateioPercentual: 60,
    },
    {
      numero: '777888',
      endereco: 'Rua Central, 120 — Londrina / PR',
      rateioPercentual: 40,
    },
  ],
  ...overrides,
})

describe('printable proposal guard rails', () => {
  test('printable proposal renders with minimal props', () => {
    const props = createPrintableProps({ mostrarFinanciamento: false })
    expect(() => renderToStaticMarkup(<PrintableProposal {...props} />)).not.toThrow()
  })

  test('printable proposal layout snapshot', () => {
    const markup = renderToStaticMarkup(<PrintableProposal {...createPrintableProps()} />)
    expect(markup).toMatchSnapshot()
  })

  test('printable proposal uses local chart palette', () => {
    const { container } = render(<PrintableProposal {...createPrintableProps()} />)
    const chartSection = container.querySelector('#economia-30-anos')

    expect(chartSection).not.toBeNull()
    expect(chartSection?.getAttribute('data-chart-palette')).toBe(DEFAULT_COLORS.join(','))
    expect(chartSection?.getAttribute('style')).toContain(`--print-chart-color-primary: ${DEFAULT_COLORS[0]}`)
  })
})
