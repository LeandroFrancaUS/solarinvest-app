import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import PrintableProposal from '../PrintableProposal'
import { computeROI, type VendaForm } from '../../../lib/finance/roi'
import type { PrintableProposalProps } from '../../../types/printableProposal'
import type { ParsedVendaPdfData } from '../../../lib/pdf/extractVendas'

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

const anosBase = Array.from({ length: 30 }, (_, index) => index + 1)
const createParsedVenda = (overrides: Partial<ParsedVendaPdfData> = {}): ParsedVendaPdfData => ({
  capex_total: null,
  potencia_instalada_kwp: null,
  geracao_estimada_kwh_mes: null,
  quantidade_modulos: null,
  potencia_da_placa_wp: null,
  modelo_modulo: null,
  modelo_inversor: null,
  estrutura_fixacao: null,
  estrutura_fixacao_source: null,
  estrutura_utilizada_tipo_warning: null,
  tipo_instalacao: null,
  tarifa_cheia_r_kwh: null,
  consumo_kwh_mes: null,
  geracao_estimada_source: null,
  module_area_m2: undefined,
  ...overrides,
})

const createPrintableProps = (
  overrides: Partial<PrintableProposalProps> = {},
): PrintableProposalProps => ({
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
  },
  budgetId: 'ORC123',
  anos: anosBase,
  leasingROI: Array.from({ length: 30 }, () => 0),
  financiamentoFluxo: Array.from({ length: 30 }, () => 0),
  financiamentoROI: Array.from({ length: 30 }, () => 0),
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
  areaInstalacao: 0,
  descontoContratualPct: 0,
  parcelasLeasing: [],
  distribuidoraTarifa: 'Copel',
  energiaContratadaKwh: 600,
  tarifaCheia: 0.95,
  vendaResumo: undefined,
  parsedPdfVenda: undefined,
  orcamentoItens: [],
  ...overrides,
})

describe('PrintableProposal (venda direta)', () => {
  it('exibe potência dos módulos a partir do catálogo e autonomia formatada', () => {
    const vendaForm: VendaForm = {
      consumo_kwh_mes: 500,
      tarifa_cheia_r_kwh: 1,
      inflacao_energia_aa_pct: 0,
      taxa_minima_mensal: 50,
      horizonte_meses: 360,
      capex_total: 28000,
      condicao: 'AVISTA',
      modo_pagamento: 'PIX',
      taxa_mdr_pix_pct: 1.5,
      taxa_mdr_debito_pct: 0,
      taxa_mdr_credito_vista_pct: 0,
      taxa_mdr_credito_parcelado_pct: 0,
      entrada_financiamento: 0,
      geracao_estimada_kwh_mes: 600,
      tarifa_r_kwh: 1,
      taxa_minima_r_mes: 50,
      n_parcelas: undefined,
      juros_cartao_aa_pct: undefined,
      juros_cartao_am_pct: undefined,
      n_parcelas_fin: undefined,
      juros_fin_aa_pct: undefined,
      juros_fin_am_pct: undefined,
      taxa_desconto_aa_pct: 8,
      quantidade_modulos: 12,
      potencia_instalada_kwp: 6.6,
      modelo_modulo: undefined,
      modelo_inversor: undefined,
      estrutura_suporte: undefined,
      numero_orcamento_vendor: undefined,
    }

    const retorno = computeROI(vendaForm)
    const props = createPrintableProps({
      numeroModulos: 12,
      energiaContratadaKwh: 500,
      vendaResumo: { form: vendaForm, retorno },
      parsedPdfVenda: createParsedVenda({ potencia_da_placa_wp: 610 }),
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toMatch(/Potência dos módulos<\/dt>\s*<dd>610 Wp<\/dd>/)
    expect(markup).toMatch(/Energia contratada \(kWh\/mês\)<\/dt>\s*<dd>500 kWh\/mês<\/dd>/)
    expect(markup).toMatch(/Tarifa atual \(distribuidora\)<\/dt>\s*<dd>R\$\s*1,000<\/dd>/)
    expect(markup).toMatch(/Inversores<\/dt>\s*<dd>—<\/dd>/)
    expect(markup).not.toMatch(/Área mínima necessária/)
    expect(markup).toMatch(/Autonomia \(%\)<\/dt>\s*<dd>120,0%<\/dd>/)
    expect(markup).toContain('>Item<')
    expect(markup).toContain('TOTAL CAPEX')
    expect(markup).toMatch(/<span>VPL<\/span>\s*<strong>/)
  })

  it('mostra potência dos módulos como indisponível quando não há dados e oculta VPL sem desconto', () => {
    const vendaForm: VendaForm = {
      consumo_kwh_mes: 0,
      tarifa_cheia_r_kwh: 0.95,
      inflacao_energia_aa_pct: 0,
      taxa_minima_mensal: 60,
      horizonte_meses: 360,
      capex_total: 18000,
      condicao: 'PARCELADO',
      modo_pagamento: 'CREDITO',
      taxa_mdr_pix_pct: 0,
      taxa_mdr_debito_pct: 0,
      taxa_mdr_credito_vista_pct: 0,
      taxa_mdr_credito_parcelado_pct: 2,
      n_parcelas: 12,
      juros_cartao_aa_pct: undefined,
      juros_cartao_am_pct: 1.8,
      n_parcelas_fin: undefined,
      juros_fin_aa_pct: undefined,
      juros_fin_am_pct: undefined,
      entrada_financiamento: 0,
      taxa_desconto_aa_pct: undefined,
      geracao_estimada_kwh_mes: 550,
      tarifa_r_kwh: 0.95,
      taxa_minima_r_mes: 60,
      quantidade_modulos: 10,
      potencia_instalada_kwp: 5.5,
      modelo_modulo: undefined,
      modelo_inversor: undefined,
      estrutura_suporte: undefined,
      numero_orcamento_vendor: undefined,
    }

    const retorno = computeROI(vendaForm)
    const props = createPrintableProps({
      numeroModulos: 10,
      energiaContratadaKwh: 0,
      vendaResumo: { form: vendaForm, retorno },
      parsedPdfVenda: createParsedVenda({ potencia_da_placa_wp: null }),
      potenciaModulo: 0,
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).toMatch(/Potência dos módulos<\/dt>\s*<dd>—<\/dd>/)
    expect(markup).toMatch(/Energia contratada \(kWh\/mês\)<\/dt>\s*<dd>—<\/dd>/)
    expect(markup).toMatch(/Autonomia \(%\)<\/dt>\s*<dd>—<\/dd>/)
    expect(markup).toContain('Retorno Financeiro (Venda)')
    expect(markup).not.toMatch(/<span>VPL<\/span>/)
    expect(markup).not.toContain('A geração real pode variar')
    expect(markup).toContain('Não é de responsabilidade da SolarInvest Solutions')
  })

  it('não renderiza a tabela de itens do orçamento', () => {
    const props = createPrintableProps({
      orcamentoItens: [
        {
          produto: 'Módulo Solar 550W',
          descricao: 'Módulo monocristalino',
          codigo: 'MOD-550',
          modelo: 'XYZ-550',
          fabricante: 'Fabricante Solar',
          quantidade: 12,
        },
      ],
    })

    const markup = renderToStaticMarkup(<PrintableProposal {...props} />)

    expect(markup).not.toContain('Itens do orçamento')
    expect(markup).not.toContain('<th>Produto</th>')
    expect(markup).not.toContain('Módulo Solar 550W')
  })
})

