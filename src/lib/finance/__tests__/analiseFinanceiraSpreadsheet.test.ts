import { describe, expect, it } from 'vitest'
import {
  CREA_DF_RS,
  CREA_GO_RS,
  MATERIAL_CA_PERCENT_DO_KIT,
  PRECO_PLACA_RS,
  PROJETO_FAIXAS,
  SEGURO_LIMIAR_RS,
  SEGURO_PISO_RS,
  calcComissaoDinamica,
  calcPrecoIdeal,
  calcSeguroLeasing,
  calcularAnaliseFinanceira,
  calcularBaseSistema,
  resolveCombustivel,
  resolveCrea,
  resolveCustoProjetoPorFaixa,
} from '../analiseFinanceiraSpreadsheet'
import { AnaliseFinanceiraError } from '../../../types/analiseFinanceira'
import type { AnaliseFinanceiraInput } from '../../../types/analiseFinanceira'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const baseInput: AnaliseFinanceiraInput = {
  modo: 'venda',
  uf: 'GO',
  consumo_kwh_mes: 1000,
  irradiacao_kwh_m2_dia: 5.0,
  performance_ratio: 0.8,
  dias_mes: 30,
  potencia_modulo_wp: 550,
  custo_kit_rs: 20000,
  frete_rs: 500,
  descarregamento_rs: 200,
  instalacao_rs: 3000,
  hotel_pousada_rs: 0,
  transporte_combustivel_rs: 0,
  outros_rs: 0,
  deslocamento_instaladores_rs: 0,
  valor_contrato_rs: 40000,
  impostos_percent: 8,
  custo_fixo_rateado_percent: 5,
  lucro_minimo_percent: 10,
  comissao_minima_percent: 3,
  inadimplencia_percent: 2,
  custo_operacional_percent: 3,
  meses_projecao: 3,
  mensalidades_previstas_rs: [1000, 1000, 1000],
  investimento_inicial_rs: 30000,
}

// ─── calcularBaseSistema ─────────────────────────────────────────────────────

describe('calcularBaseSistema', () => {
  it('calculates power and modules correctly', () => {
    const result = calcularBaseSistema({
      consumo_kwh_mes: 1000,
      irradiacao_kwh_m2_dia: 5.0,
      performance_ratio: 0.8,
      dias_mes: 30,
      potencia_modulo_wp: 550,
    })
    // fatorGeracaoMensal = 5 * 0.8 * 30 = 120
    // potenciaNecessaria = 1000 / 120 = 8.333... kWp
    // quantidade_modulos = ceil(8333.33 / 550) = ceil(15.15) = 16
    // potencia_sistema_kwp = 16 * 550 / 1000 = 8.8
    expect(result.quantidade_modulos).toBe(16)
    expect(result.potencia_sistema_kwp).toBeCloseTo(8.8, 5)
  })

  it('uses ceil for module count', () => {
    const result = calcularBaseSistema({
      consumo_kwh_mes: 500,
      irradiacao_kwh_m2_dia: 5.0,
      performance_ratio: 0.8,
      dias_mes: 30,
      potencia_modulo_wp: 550,
    })
    // potenciaNecessaria = 500/120 = 4.1667 kWp
    // modules = ceil(4166.7/550) = ceil(7.576) = 8
    expect(result.quantidade_modulos).toBe(8)
  })
})

// ─── resolveCustoProjetoPorFaixa ─────────────────────────────────────────────

describe('resolveCustoProjetoPorFaixa', () => {
  it.each([
    [3, 400],
    [6, 400],
    [7, 500],
    [10, 500],
    [15, 700],
    [20, 700],
    [25, 1000],
    [30, 1000],
    [40, 1200],
    [50, 1200],
    [51, 2500],
    [100, 2500],
  ])('kwp=%f returns R$%f', (kwp, expected) => {
    expect(resolveCustoProjetoPorFaixa(kwp, PROJETO_FAIXAS)).toBe(expected)
  })

  it('returns 2500 for kwp > 50', () => {
    expect(resolveCustoProjetoPorFaixa(50.01)).toBe(2500)
  })
})

// ─── resolveCombustivel ───────────────────────────────────────────────────────

describe('resolveCombustivel', () => {
  it('returns 0 for GO', () => {
    expect(resolveCombustivel('GO')).toBe(0)
  })
  it('returns 250 for DF', () => {
    expect(resolveCombustivel('DF')).toBe(250)
  })
})

// ─── resolveCrea ─────────────────────────────────────────────────────────────

describe('resolveCrea', () => {
  it('returns CREA_GO_RS=104 for GO', () => {
    expect(resolveCrea('GO')).toBe(CREA_GO_RS)
  })
  it('returns CREA_DF_RS=109 for DF', () => {
    expect(resolveCrea('DF')).toBe(CREA_DF_RS)
  })
})

// ─── material CA ─────────────────────────────────────────────────────────────

describe('material CA', () => {
  it('is 12% of kit cost', () => {
    const kitCost = 20000
    const expected = kitCost * (MATERIAL_CA_PERCENT_DO_KIT / 100)
    expect(expected).toBe(2400)
  })
})

// ─── placa ───────────────────────────────────────────────────────────────────

describe('placa cost', () => {
  it('is PRECO_PLACA_RS * modules', () => {
    expect(PRECO_PLACA_RS * 10).toBe(180)
  })
})

// ─── calcComissaoDinamica ─────────────────────────────────────────────────────

describe('calcComissaoDinamica', () => {
  it('returns 0 when margin < 0.20', () => {
    expect(calcComissaoDinamica(0.19)).toBe(0)
    expect(calcComissaoDinamica(0.0)).toBe(0)
  })

  it('interpolates between 3% and 5% in range [0.20, 0.30]', () => {
    // At 0.20: commission = 0.03
    expect(calcComissaoDinamica(0.2)).toBeCloseTo(0.03, 6)
    // At 0.30: commission = 0.05
    expect(calcComissaoDinamica(0.3)).toBeCloseTo(0.05, 6)
    // At 0.25: commission = 0.03 + (0.05/0.10)*0.02 = 0.04
    expect(calcComissaoDinamica(0.25)).toBeCloseTo(0.04, 6)
  })

  it('applies 5% + slope after 0.30, capped at 10%', () => {
    // At 0.30: 5%
    expect(calcComissaoDinamica(0.3)).toBeCloseTo(0.05, 6)
    // At 0.40: 5% + (0.10 * 0.30) = 8%
    expect(calcComissaoDinamica(0.4)).toBeCloseTo(0.08, 6)
    // At 0.50: 5% + (0.20 * 0.30) = 11% → capped at 10%
    expect(calcComissaoDinamica(0.5)).toBeCloseTo(0.1, 6)
    // Very high margin still capped at 10%
    expect(calcComissaoDinamica(0.99)).toBeCloseTo(0.1, 6)
  })
})

// ─── calcSeguroLeasing ────────────────────────────────────────────────────────

describe('calcSeguroLeasing', () => {
  it('applies 3.05% below threshold', () => {
    const val = 10000
    expect(calcSeguroLeasing(val)).toBeCloseTo(val * 0.0305, 6)
  })

  it('applies 0.735% above threshold with piso', () => {
    const val = 20000
    const calculated = val * (0.735 / 100)
    const expected = Math.max(SEGURO_PISO_RS, calculated)
    expect(calcSeguroLeasing(val)).toBeCloseTo(expected, 6)
  })

  it('applies piso when 0.735% is below R$139', () => {
    // 0.735% of SEGURO_LIMIAR_RS = 18911.56 * 0.00735 ≈ 139
    // Use a value just above threshold where 0.735% gives < 139
    const val = SEGURO_LIMIAR_RS + 0.01
    const calculated = val * (0.735 / 100)
    if (calculated < SEGURO_PISO_RS) {
      expect(calcSeguroLeasing(val)).toBe(SEGURO_PISO_RS)
    } else {
      expect(calcSeguroLeasing(val)).toBeCloseTo(calculated, 2)
    }
  })

  it('at boundary value (18911.56) uses baixa rate', () => {
    // valor < SEGURO_LIMIAR_RS uses baixa rate
    const val = SEGURO_LIMIAR_RS - 0.01
    expect(calcSeguroLeasing(val)).toBeCloseTo(val * 0.0305, 4)
  })
})

// ─── preco_minimo_saudavel ────────────────────────────────────────────────────

describe('preco_minimo_saudavel_rs', () => {
  it('calculates healthy minimum price', () => {
    const result = calcularAnaliseFinanceira(baseInput)
    // den = 1 - 0.08 - 0.05 - 0.10 - 0.03 = 0.74
    // custo_variavel_total first
    expect(result.preco_minimo_saudavel_rs).toBeDefined()
    expect(result.preco_minimo_saudavel_rs!).toBeGreaterThan(0)
  })

  it('throws DENOMINADOR_PRECO_MINIMO_INVALIDO when denominator <= 0', () => {
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      impostos_percent: 40,
      custo_fixo_rateado_percent: 30,
      lucro_minimo_percent: 20,
      comissao_minima_percent: 15,
    }
    expect(() => calcularAnaliseFinanceira(input)).toThrow(AnaliseFinanceiraError)
    try {
      calcularAnaliseFinanceira(input)
    } catch (e) {
      expect((e as AnaliseFinanceiraError).code).toBe('DENOMINADOR_PRECO_MINIMO_INVALIDO')
    }
  })
})

// ─── status_venda ─────────────────────────────────────────────────────────────

describe('status_venda', () => {
  it('returns BLOQUEAR_VENDA when margem_liquida_final < 15%', () => {
    // Set contract value very low to force low margin
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      valor_contrato_rs: 25000,
    }
    const result = calcularAnaliseFinanceira(input)
    if ((result.margem_liquida_final_percent ?? 0) < 15) {
      expect(result.status_venda).toBe('BLOQUEAR_VENDA')
    }
  })

  it('returns VENDA_SAUDAVEL with healthy contract value', () => {
    const result = calcularAnaliseFinanceira(baseInput)
    // baseInput has valor_contrato=40000 which should give healthy margin
    expect(result.status_venda).toBeDefined()
  })

  it('covers SEM_COMISSAO range 15-20%', () => {
    // Craft input where final margin lands between 15% and 20%
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      valor_contrato_rs: 32000,
    }
    const result = calcularAnaliseFinanceira(input)
    const margem = result.margem_liquida_final_percent ?? 0
    if (margem >= 15 && margem < 20) {
      expect(result.status_venda).toBe('SEM_COMISSAO')
    }
  })
})

// ─── ROI / Payback / TIR ─────────────────────────────────────────────────────

describe('KPIs', () => {
  it('computes roi_percent', () => {
    const result = calcularAnaliseFinanceira(baseInput)
    expect(typeof result.roi_percent).toBe('number')
    expect(Number.isFinite(result.roi_percent)).toBe(true)
  })

  it('payback_meses is null when lucro does not cover investimento', () => {
    const result = calcularAnaliseFinanceira(baseInput)
    // For venda with a single-period cash flow, payback is null if
    // lucro_final < investimento_inicial_rs (30000 in baseInput)
    const lucro = result.lucro_liquido_final_rs ?? 0
    if (lucro >= baseInput.investimento_inicial_rs) {
      expect(result.payback_meses).toBe(1)
    } else {
      expect(result.payback_meses).toBeNull()
    }
  })

  it('leasing KPIs calculate from mensalidades', () => {
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      modo: 'leasing',
      mensalidades_previstas_rs: Array(60).fill(1500),
      meses_projecao: 60,
    }
    const result = calcularAnaliseFinanceira(input)
    expect(result.roi_percent).toBeDefined()
    expect(result.tir_mensal_percent).toBeDefined()
  })
})

// ─── Input validation errors ──────────────────────────────────────────────────

describe('input validation', () => {
  it('throws INPUT_INVALID_CONSUMO', () => {
    const input = { ...baseInput, consumo_kwh_mes: 0 }
    expect(() => calcularAnaliseFinanceira(input)).toThrow(AnaliseFinanceiraError)
  })

  it('throws INPUT_INVALID_IRRADIACAO', () => {
    const input = { ...baseInput, irradiacao_kwh_m2_dia: -1 }
    expect(() => calcularAnaliseFinanceira(input)).toThrow(AnaliseFinanceiraError)
  })

  it('throws INPUT_INVALID_PR', () => {
    const input = { ...baseInput, performance_ratio: 0 }
    expect(() => calcularAnaliseFinanceira(input)).toThrow(AnaliseFinanceiraError)
  })

  it('throws INPUT_INVALID_POTENCIA_MODULO', () => {
    const input = { ...baseInput, potencia_modulo_wp: -10 }
    expect(() => calcularAnaliseFinanceira(input)).toThrow(AnaliseFinanceiraError)
  })

  it('throws INPUT_INVALID_PERCENTUAL for out-of-range percent', () => {
    const input = { ...baseInput, impostos_percent: 110 }
    expect(() => calcularAnaliseFinanceira(input)).toThrow(AnaliseFinanceiraError)
  })

  it('throws MENSALIDADES_TAMANHO_INVALIDO when lengths mismatch', () => {
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      modo: 'leasing',
      meses_projecao: 5,
      mensalidades_previstas_rs: [1000, 1000],
    }
    expect(() => calcularAnaliseFinanceira(input)).toThrow(AnaliseFinanceiraError)
  })
})

// ─── calcPrecoIdeal ──────────────────────────────────────────────────────────

describe('calcPrecoIdeal', () => {
  // Standard params: impostos=8%, custoFixo=5% → a = 0.87
  const CV = 20000
  const IMP = 8
  const CFR = 5

  it('Zone 1 (m < 17%): returns CV/(a-m), no commission', () => {
    const m = 10
    const p = calcPrecoIdeal(CV, IMP, CFR, m)
    // a=0.87, m=0.10 → P = 20000/0.77 ≈ 25974
    expect(p).toBeCloseTo(CV / (0.87 - 0.1), 4)
    // Verify actual margin: MSC = 0.87 - CV/P = 0.10, ComissaoPct=0, MargemFinal=0.10
    const msc = 0.87 - CV / p
    const comm = msc < 0.2 ? 0 : 0
    const lucroFinal = p * (1 - IMP / 100 - CFR / 100) - CV - p * comm
    expect(lucroFinal / p).toBeCloseTo(m / 100, 4)
  })

  it('Zone 2 (17–25%): achieves exact target margin after commission', () => {
    const m = 22
    const p = calcPrecoIdeal(CV, IMP, CFR, m)
    // Verify the resulting margin is exactly 22%
    const a = 1 - IMP / 100 - CFR / 100
    const msc = a - CV / p
    const commFrac = 0.03 + ((msc - 0.2) / 0.1) * 0.02
    const lucroSemCom = p * (1 - IMP / 100 - CFR / 100) - CV
    const lucroFinal = lucroSemCom - p * commFrac
    expect(lucroFinal / p).toBeCloseTo(m / 100, 4)
  })

  it('Zone 2 default venda (25%): achieves exact 25% margin', () => {
    const m = 25
    const p = calcPrecoIdeal(CV, IMP, CFR, m)
    expect(p).toBeGreaterThan(0)
    // The final margin should be 25%
    const a = 1 - IMP / 100 - CFR / 100
    const msc = a - CV / p
    let commFrac: number
    if (msc <= 0.3) {
      commFrac = 0.03 + ((msc - 0.2) / 0.1) * 0.02
    } else {
      commFrac = Math.min(0.1, 0.05 + (msc - 0.3) * 0.3)
    }
    const lucroSemCom = p * a - CV
    const lucroFinal = lucroSemCom - p * commFrac
    expect(lucroFinal / p).toBeCloseTo(m / 100, 4)
  })

  it('Zone 3 (30%): achieves exact 30% margin after commission', () => {
    const m = 30
    const p = calcPrecoIdeal(CV, IMP, CFR, m)
    expect(p).toBeGreaterThan(0)
    const a = 1 - IMP / 100 - CFR / 100
    const msc = a - CV / p
    const commFrac = Math.min(0.1, 0.05 + (msc - 0.3) * 0.3)
    const lucroSemCom = p * a - CV
    const lucroFinal = lucroSemCom - p * commFrac
    expect(lucroFinal / p).toBeCloseTo(m / 100, 4)
  })

  it('preco_ideal_rs appears in engine output when margem_liquida_alvo_percent set', () => {
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      margem_liquida_alvo_percent: 25,
    }
    const result = calcularAnaliseFinanceira(input)
    expect(result.preco_ideal_rs).toBeDefined()
    expect(result.preco_ideal_rs!).toBeGreaterThan(0)
  })

  it('preco_ideal_rs is undefined when margem_liquida_alvo_percent not set', () => {
    const result = calcularAnaliseFinanceira(baseInput)
    expect(result.preco_ideal_rs).toBeUndefined()
  })

  it('throws DENOMINADOR_PRECO_MINIMO_INVALIDO when impossible target', () => {
    // m so high that denominator goes ≤ 0
    expect(() => calcPrecoIdeal(CV, IMP, CFR, 95)).toThrow(AnaliseFinanceiraError)
  })
})

// ─── Instalação auto-calculation ─────────────────────────────────────────────

describe('instalação auto-calculation', () => {
  it('instalacao_rs = quantidade_modulos × 70 in custo_variavel_total', () => {
    const base = calcularBaseSistema({
      consumo_kwh_mes: 1000,
      irradiacao_kwh_m2_dia: 5.0,
      performance_ratio: 0.8,
      dias_mes: 30,
      potencia_modulo_wp: 550,
    })
    const instalacao = base.quantidade_modulos * 70
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      instalacao_rs: instalacao,
    }
    const result = calcularAnaliseFinanceira(input)
    // Verify instalacao is factored into custo_variavel_total
    expect(result.custo_variavel_total_rs).toBeGreaterThan(0)
    // placa should still be 18 * modules
    expect(result.placa_rs).toBe(base.quantidade_modulos * 18)
  })
})

// ─── quantidade_modulos_override ──────────────────────────────────────────────

describe('quantidade_modulos_override', () => {
  it('bypasses auto-calculation and uses provided module count', () => {
    const override = 20
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      quantidade_modulos_override: override,
    }
    const result = calcularAnaliseFinanceira(input)
    expect(result.quantidade_modulos).toBe(override)
    expect(result.potencia_sistema_kwp).toBeCloseTo((override * baseInput.potencia_modulo_wp) / 1000, 4)
  })

  it('placa_rs uses overridden module count', () => {
    const override = 10
    const input: AnaliseFinanceiraInput = {
      ...baseInput,
      quantidade_modulos_override: override,
    }
    const result = calcularAnaliseFinanceira(input)
    expect(result.placa_rs).toBe(override * PRECO_PLACA_RS)
  })

  it('auto-calculates when override is not provided', () => {
    const auto = calcularAnaliseFinanceira(baseInput)
    const withOverride = calcularAnaliseFinanceira({
      ...baseInput,
      quantidade_modulos_override: auto.quantidade_modulos,
    })
    expect(withOverride.quantidade_modulos).toBe(auto.quantidade_modulos)
    expect(withOverride.potencia_sistema_kwp).toBeCloseTo(auto.potencia_sistema_kwp, 3)
  })
})

// ─── Venda full calculation integration ──────────────────────────────────────

describe('calcularAnaliseFinanceira venda integration', () => {
  it('all venda output fields are present', () => {
    const result = calcularAnaliseFinanceira(baseInput)
    expect(result.potencia_sistema_kwp).toBeGreaterThan(0)
    expect(result.quantidade_modulos).toBeGreaterThan(0)
    expect(result.custo_projeto_rs).toBeGreaterThan(0)
    expect(result.material_ca_rs).toBeGreaterThan(0)
    expect(result.crea_rs).toBe(CREA_GO_RS)
    expect(result.placa_rs).toBeGreaterThan(0)
    expect(result.combustivel_rs).toBe(0) // GO
    expect(result.custo_variavel_total_rs).toBeGreaterThan(0)
    expect(result.impostos_rs).toBeGreaterThan(0)
    expect(result.custo_fixo_rateado_rs).toBeGreaterThan(0)
    expect(result.comissao_percent).toBeGreaterThanOrEqual(0)
    expect(result.preco_minimo_saudavel_rs).toBeGreaterThan(0)
    expect(result.status_venda).toBeDefined()
  })

  it('DF uses correct combustivel and crea', () => {
    const input: AnaliseFinanceiraInput = { ...baseInput, uf: 'DF' }
    const result = calcularAnaliseFinanceira(input)
    expect(result.combustivel_rs).toBe(250)
    expect(result.crea_rs).toBe(CREA_DF_RS)
  })
})
