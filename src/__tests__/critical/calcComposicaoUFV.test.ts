import { describe, expect, it } from 'vitest'

import {
  calcularComposicaoUFV,
  type Inputs,
} from '../../lib/venda/calcComposicaoUFV'

const createInput = (overrides: Partial<Inputs> = {}): Inputs => ({
  projeto: 1000,
  instalacao: 2000,
  material_ca: 1500,
  crea: 0,
  art: 0,
  placa: 2500,
  comissao_liquida_input: 5,
  comissao_tipo: 'percentual',
  comissao_percent_base: 'venda_total',
  teto_comissao_percent: 10,
  margem_operacional_padrao_percent: 30,
  margem_manual_valor: 0,
  usar_margem_manual: false,
  valor_total_orcamento: 0,
  descontos: 500,
  preco_minimo_percent_sobre_capex: 0,
  arredondar_venda_para: 1,
  desconto_max_percent_sem_aprovacao: 4,
  workflow_aprovacao_ativo: true,
  regime: 'lucro_presumido',
  imposto_retido_aliquota: 0,
  impostosRegime: {
    lucro_presumido: [{ nome: 'ISS', aliquota_percent: 2 }],
  },
  incluirImpostosNoCAPEX: false,
  ...overrides,
})

describe('calcularComposicaoUFV', () => {
  it('aplica margem automática e comissiona sobre a venda total', () => {
    const input = createInput({ valor_total_orcamento: 1000 })
    const resultado = calcularComposicaoUFV(input)

    expect(resultado.capex_base).toBeCloseTo(7000, 4)
    expect(resultado.margem_operacional_valor).toBeCloseTo(2400, 2)
    expect(resultado.comissao_liquida_valor).toBeCloseTo(520.99, 2)
    expect(resultado.venda_total).toBeCloseTo(9880.99, 2)
    expect(resultado.venda_liquida).toBeCloseTo(9380.99, 2)
    expect(resultado.impostos_regime_valor).toBeCloseTo(resultado.venda_total * 0.02, 2)
    expect(resultado.imposto_retido_valor).toBe(0)
    expect(resultado.desconto_requer_aprovacao).toBe(true)
    expect(resultado.preco_minimo_aplicado).toBe(false)
    expect(resultado.arredondamento_aplicado).toBeCloseTo(0, 4)
  })

  it('usa margem manual e aplica arredondamento e impostos adicionais', () => {
    const input = createInput({
      usar_margem_manual: true,
      margem_manual_valor: 500,
      comissao_tipo: 'valor',
      comissao_liquida_input: 350,
      descontos: 0,
      preco_minimo_percent_sobre_capex: 10,
      arredondar_venda_para: 100,
      imposto_retido_aliquota: 5,
      incluirImpostosNoCAPEX: true,
    })

    const resultado = calcularComposicaoUFV(input)

    expect(resultado.venda_total).toBeCloseTo(7900, 2)
    expect(resultado.margem_operacional_valor).toBeCloseTo(500, 2)
    expect(resultado.comissao_liquida_valor).toBeCloseTo(350, 4)
    expect(resultado.venda_total_sem_guardrails).toBeCloseTo(7850, 2)
    expect(resultado.arredondamento_aplicado).toBeCloseTo(50, 2)
    expect(resultado.preco_minimo_aplicado).toBe(false)
    expect(resultado.imposto_retido_valor).toBeCloseTo(395, 2)
    expect(resultado.impostos_regime_valor).toBeCloseTo(158, 2)
    expect(resultado.impostos_totais_valor).toBeCloseTo(553, 2)
    expect(resultado.capex_total).toBeCloseTo(7553, 2)
    expect(resultado.desconto_requer_aprovacao).toBe(false)
  })

  it('eleva a venda ao preço mínimo quando necessário', () => {
    const input = createInput({
      margem_operacional_padrao_percent: 0,
      comissao_liquida_input: 0,
      descontos: 0,
      preco_minimo_percent_sobre_capex: 15,
      arredondar_venda_para: 100,
    })

    const resultado = calcularComposicaoUFV(input)

    expect(resultado.venda_total_sem_guardrails).toBeCloseTo(7000, 2)
    expect(resultado.preco_minimo).toBeCloseTo(8050, 2)
    expect(resultado.venda_total).toBeCloseTo(8100, 2)
    expect(resultado.preco_minimo_aplicado).toBe(true)
    expect(resultado.arredondamento_aplicado).toBeCloseTo(50, 2)
    expect(resultado.margem_operacional_valor).toBeCloseTo(1100, 2)
    expect(resultado.desconto_requer_aprovacao).toBe(false)
  })

  it('permite sobrescrever manualmente o CAPEX base', () => {
    const input = createInput({
      capex_base_manual: 12000,
      valor_total_orcamento: 1000,
    })

    const resultado = calcularComposicaoUFV(input)

    expect(resultado.capex_base).toBeCloseTo(12000, 4)
    expect(resultado.margem_operacional_valor).toBeCloseTo(3900, 2)
    expect(resultado.venda_total).toBeGreaterThan(resultado.capex_base)
  })
})
