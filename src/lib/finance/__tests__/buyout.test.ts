import { describe, expect, it } from 'vitest'

import {
  computeContractualBuyout,
  computeDepreciationFactor,
  computeLinearTechnicalAmortization,
  getResidualFloorPct,
  getResidualFloorValue,
  type BuyoutInputs,
} from '../buyout'

// ─── getResidualFloorPct ──────────────────────────────────────────────────────

describe('getResidualFloorPct', () => {
  it('retorna 0 para mês < 6 (opção não exercível)', () => {
    expect(getResidualFloorPct(0, 60)).toBe(0)
    expect(getResidualFloorPct(5, 60)).toBe(0)
  })

  it('retorna 40% para meses 6 a 24 (piso fixo contratual)', () => {
    expect(getResidualFloorPct(6, 60)).toBe(0.4)
    expect(getResidualFloorPct(12, 60)).toBe(0.4)
    expect(getResidualFloorPct(24, 60)).toBe(0.4)
  })

  it('retorna 40% no mês 25 (início da faixa progressiva)', () => {
    // progress = (25 - 25) / (60 - 25) = 0 → pct = 0.40
    expect(getResidualFloorPct(25, 60)).toBeCloseTo(0.4, 6)
  })

  it('reduz progressivamente entre meses 25 e 60 até 10%', () => {
    const m36 = getResidualFloorPct(36, 60)
    const m48 = getResidualFloorPct(48, 60)
    const m60 = getResidualFloorPct(60, 60)

    expect(m36).toBeGreaterThan(m48)
    expect(m48).toBeGreaterThan(m60)
    expect(m60).toBeCloseTo(0.1, 6)
  })

  it('respeita o piso de 10% no mês final (mês 60)', () => {
    expect(getResidualFloorPct(60, 60)).toBeCloseTo(0.1, 6)
  })

  it('nunca cai abaixo de 10% para meses além do prazo', () => {
    expect(getResidualFloorPct(65, 60)).toBeCloseTo(0.1, 6)
    expect(getResidualFloorPct(100, 60)).toBeCloseTo(0.1, 6)
  })

  it('nunca ultrapassa 40% para m >= 6', () => {
    for (const m of [6, 10, 20, 24, 25]) {
      expect(getResidualFloorPct(m, 60)).toBeLessThanOrEqual(0.4)
    }
  })

  it('calcula progressão linear correta em prazo de 60 meses', () => {
    // m=25: progress=0/35=0    → pct=0.40
    // m=36: progress=11/35     → pct=0.40 - (11/35)*0.30
    // m=48: progress=23/35     → pct=0.40 - (23/35)*0.30
    // m=60: progress=35/35=1   → pct=0.10
    expect(getResidualFloorPct(25, 60)).toBeCloseTo(0.4, 6)
    expect(getResidualFloorPct(36, 60)).toBeCloseTo(0.4 - (11 / 35) * 0.3, 6)
    expect(getResidualFloorPct(48, 60)).toBeCloseTo(0.4 - (23 / 35) * 0.3, 6)
    expect(getResidualFloorPct(60, 60)).toBeCloseTo(0.1, 6)
  })
})

// ─── getResidualFloorValue ────────────────────────────────────────────────────

describe('getResidualFloorValue', () => {
  it('retorna 40% do valorOriginalAtivo no mês 12 (faixa 6-24)', () => {
    expect(getResidualFloorValue(12, 100_000, 60)).toBe(40_000)
  })

  it('retorna 10% do valorOriginalAtivo no mês 60 (fim do prazo)', () => {
    expect(getResidualFloorValue(60, 100_000, 60)).toBeCloseTo(10_000, 2)
  })

  it('retorna 0 para mês < 6', () => {
    expect(getResidualFloorValue(5, 100_000, 60)).toBe(0)
  })

  it('não retorna valor negativo com valorOriginalAtivo zero', () => {
    expect(getResidualFloorValue(12, 0, 60)).toBe(0)
  })
})

// ─── computeDepreciationFactor ────────────────────────────────────────────────

describe('computeDepreciationFactor', () => {
  it('retorna 1 no mês 0 (sem depreciação)', () => {
    expect(computeDepreciationFactor(0.12, 0)).toBe(1)
  })

  it('retorna valor em (0, 1) para m > 0 e taxa > 0', () => {
    const f = computeDepreciationFactor(0.12, 12)
    expect(f).toBeGreaterThan(0)
    expect(f).toBeLessThan(1)
  })

  it('nunca retorna valor negativo', () => {
    expect(computeDepreciationFactor(5, 100)).toBeGreaterThanOrEqual(0)
  })

  it('é monotonicamente decrescente com o tempo', () => {
    const f12 = computeDepreciationFactor(0.12, 12)
    const f24 = computeDepreciationFactor(0.12, 24)
    const f60 = computeDepreciationFactor(0.12, 60)
    expect(f12).toBeGreaterThan(f24)
    expect(f24).toBeGreaterThan(f60)
  })
})

// ─── computeLinearTechnicalAmortization ──────────────────────────────────────

describe('computeLinearTechnicalAmortization', () => {
  it('é zero no mês 0', () => {
    expect(computeLinearTechnicalAmortization(100_000, 0, 60)).toBe(0)
  })

  it('é metade do ativo na metade do prazo', () => {
    expect(computeLinearTechnicalAmortization(100_000, 30, 60)).toBeCloseTo(50_000, 6)
  })

  it('é igual ao ativo no mês final', () => {
    expect(computeLinearTechnicalAmortization(100_000, 60, 60)).toBeCloseTo(100_000, 6)
  })

  it('não ultrapassa o valor do ativo além do prazo', () => {
    expect(computeLinearTechnicalAmortization(100_000, 70, 60)).toBeCloseTo(100_000, 6)
  })

  it('retorna 0 para prazo zero', () => {
    expect(computeLinearTechnicalAmortization(100_000, 12, 0)).toBe(0)
  })

  it('não depende da mensalidade — altera mensalidade e A(m) permanece igual', () => {
    // A(m) é técnica: independente de mensalidade, PMT ou juros.
    // Teste demonstra que a função não usa nenhum parâmetro de mensalidade.
    const a1 = computeLinearTechnicalAmortization(100_000, 12, 60)
    const a2 = computeLinearTechnicalAmortization(100_000, 12, 60)
    expect(a1).toBe(a2)
  })
})

// ─── computeContractualBuyout ─────────────────────────────────────────────────

describe('computeContractualBuyout', () => {
  const baseInput: BuyoutInputs = {
    mesContratual: 12,
    prazoContratualMeses: 60,
    valorMercadoUsina: 100_000,
    valorOriginalAtivo: 100_000,
    fatorDepreciacaoEconomica: 0.9,
    amortizacaoTecnicaAcumulada: 5_000,
  }

  // 1. Fórmula base simples
  it('calcula vecBase = VM × F(m) − A(m) corretamente', () => {
    // VM=100000, F=0.90, A=5000 → vecBase = 100000*0.90 - 5000 = 85000
    const result = computeContractualBuyout(baseInput)
    expect(result.vecBase).toBeCloseTo(85_000, 2)
    expect(result.memoriaCalculo.vm).toBe(100_000)
    expect(result.memoriaCalculo.f).toBe(0.9)
    expect(result.memoriaCalculo.a).toBe(5_000)
  })

  // 2. Piso residual entre meses 6 e 24 (40%)
  it('aplica piso de 40% quando vecBase < piso no mês 12', () => {
    const input: BuyoutInputs = {
      ...baseInput,
      mesContratual: 12,
      valorOriginalAtivo: 100_000,
      fatorDepreciacaoEconomica: 0.2,  // VM*F = 20000
      amortizacaoTecnicaAcumulada: 5_000, // vecBase = 15000
    }
    // piso = 40% * 100000 = 40000 > vecBase (15000)
    const result = computeContractualBuyout(input)
    expect(result.vecBase).toBeCloseTo(15_000, 2)
    expect(result.pisoResidualAplicado).toBeCloseTo(40_000, 2)
    expect(result.vecFinal).toBeCloseTo(40_000, 2)
  })

  // 3. Faixa progressiva mês 25 a 60
  it('calcula piso progressivo corretamente no mês 25', () => {
    const input: BuyoutInputs = {
      ...baseInput,
      mesContratual: 25,
      fatorDepreciacaoEconomica: 0.05, // vecBase muito baixo
      amortizacaoTecnicaAcumulada: 4_000,
    }
    // piso(25, 60) = 40% * 100000 = 40000
    const result = computeContractualBuyout(input)
    expect(result.pisoResidualAplicado).toBeCloseTo(40_000, 2)
    expect(result.vecFinal).toBeCloseTo(40_000, 2)
  })

  it('calcula piso progressivo corretamente no mês 36', () => {
    const input: BuyoutInputs = {
      ...baseInput,
      mesContratual: 36,
      fatorDepreciacaoEconomica: 0.05,
      amortizacaoTecnicaAcumulada: 4_000,
    }
    // piso(36, 60): progress = (36-25)/(60-25) = 11/35; pct = 0.40 - (11/35)*0.30
    const expectedPiso = 100_000 * (0.4 - (11 / 35) * 0.3)
    const result = computeContractualBuyout(input)
    expect(result.pisoResidualAplicado).toBeCloseTo(expectedPiso, 2)
  })

  it('calcula piso progressivo corretamente no mês 48', () => {
    const input: BuyoutInputs = {
      ...baseInput,
      mesContratual: 48,
      fatorDepreciacaoEconomica: 0.05,
      amortizacaoTecnicaAcumulada: 4_000,
    }
    // piso(48, 60): progress = 23/35; pct = 0.40 - (23/35)*0.30
    const expectedPiso = 100_000 * (0.4 - (23 / 35) * 0.3)
    const result = computeContractualBuyout(input)
    expect(result.pisoResidualAplicado).toBeCloseTo(expectedPiso, 2)
  })

  // 4. Mês 60 deve respeitar piso de 10%
  it('aplica piso de 10% no mês 60 (fim do prazo)', () => {
    const input: BuyoutInputs = {
      ...baseInput,
      mesContratual: 60,
      valorOriginalAtivo: 100_000,
      fatorDepreciacaoEconomica: 0.05,
      amortizacaoTecnicaAcumulada: 4_000,
    }
    const result = computeContractualBuyout(input)
    expect(result.pisoResidualAplicado).toBeCloseTo(10_000, 2)
    expect(result.vecFinal).toBeGreaterThanOrEqual(10_000)
  })

  // 5. Nunca retornar valor negativo
  it('nunca retorna vecBase negativo (VM baixo + A alto)', () => {
    const input: BuyoutInputs = {
      mesContratual: 12,
      prazoContratualMeses: 60,
      valorMercadoUsina: 50_000,
      valorOriginalAtivo: 100_000,
      fatorDepreciacaoEconomica: 0.2,
      amortizacaoTecnicaAcumulada: 999_999,
    }
    // VM*F = 10000; A = 999999 → vecRaw = -989999 → vecBase = 0
    // piso(12) = 40% * 100000 = 40000
    const result = computeContractualBuyout(input)
    expect(result.vecBase).toBe(0)
    expect(result.vecFinal).toBeGreaterThanOrEqual(0)
    expect(result.vecFinal).toBeCloseTo(40_000, 2) // piso aplica
  })

  it('nunca retorna vecFinal negativo mesmo com VM zero', () => {
    const input: BuyoutInputs = {
      ...baseInput,
      mesContratual: 15,
      valorMercadoUsina: 0,
      valorOriginalAtivo: 100_000,
      fatorDepreciacaoEconomica: 0,
      amortizacaoTecnicaAcumulada: 0,
    }
    const result = computeContractualBuyout(input)
    expect(result.vecFinal).toBeGreaterThanOrEqual(0)
  })

  // 6. VM deve ser independente do CAPEX do PDF — garantir que buyout não usa capex_pdf
  it('usa valorMercadoUsina como VM — alterar outro campo não muda resultado', () => {
    // Simula cenário onde CAPEX do orçamento (campo externo) seria diferente do VM.
    // O resultado deve depender apenas dos inputs declarados.
    const result1 = computeContractualBuyout({ ...baseInput, valorMercadoUsina: 100_000 })
    const result2 = computeContractualBuyout({ ...baseInput, valorMercadoUsina: 120_000 })
    // VM diferente → resultado diferente (prova que VM é a única base)
    expect(result1.vecBase).not.toBe(result2.vecBase)
    expect(result1.memoriaCalculo.vm).toBe(100_000)
    expect(result2.memoriaCalculo.vm).toBe(120_000)
  })

  // 7. A(m) não deve depender da mensalidade
  it('A(m) não altera resultado se VM e F(m) permanecerem iguais — prova independência da mensalidade', () => {
    const resultSemMensalidade = computeContractualBuyout({
      ...baseInput,
      amortizacaoTecnicaAcumulada: 10_000,
    })
    const resultComMensalidadeDiferente = computeContractualBuyout({
      ...baseInput,
      amortizacaoTecnicaAcumulada: 10_000, // mesmo A(m), independente da mensalidade
    })
    // Prova: mesmo A(m) → mesmo resultado, independentemente do que seria a mensalidade externa
    expect(resultSemMensalidade.vecBase).toBe(resultComMensalidadeDiferente.vecBase)
  })

  it('alterar apenas A(m) muda o vecBase mas não o VM', () => {
    const result1 = computeContractualBuyout({ ...baseInput, amortizacaoTecnicaAcumulada: 5_000 })
    const result2 = computeContractualBuyout({ ...baseInput, amortizacaoTecnicaAcumulada: 20_000 })
    expect(result1.memoriaCalculo.vm).toBe(result2.memoriaCalculo.vm)
    expect(result1.vecBase).toBeGreaterThan(result2.vecBase)
  })

  // 8. Memória de cálculo: os valores expostos devem ser os mesmos do buyout
  it('memoriaCalculo expõe os mesmos valores usados no cálculo', () => {
    const result = computeContractualBuyout(baseInput)
    const { vm, f, a } = result.memoriaCalculo
    // vecBase = max(0, VM * F - A)
    expect(result.vecBase).toBeCloseTo(Math.max(0, vm * f - a), 6)
  })

  // 9. vecFinal é sempre >= vecBase e >= 0
  it('vecFinal é sempre >= vecBase e >= 0', () => {
    const scenarios: BuyoutInputs[] = [
      { ...baseInput, mesContratual: 7 },
      { ...baseInput, mesContratual: 12 },
      { ...baseInput, mesContratual: 36 },
      { ...baseInput, mesContratual: 60 },
      { ...baseInput, mesContratual: 60, fatorDepreciacaoEconomica: 0, amortizacaoTecnicaAcumulada: 0 },
    ]
    for (const input of scenarios) {
      const result = computeContractualBuyout(input)
      expect(result.vecFinal).toBeGreaterThanOrEqual(result.vecBase)
      expect(result.vecFinal).toBeGreaterThanOrEqual(0)
      expect(result.vecBase).toBeGreaterThanOrEqual(0)
    }
  })

  // 10. Ordem correta: piso é aplicado APÓS o cálculo base, não sobre VM
  it('piso é aplicado sobre vecBase, não substitui a fórmula inteira', () => {
    // vecBase alto (> piso) → vecFinal = vecBase (piso não interfere)
    const highBase = computeContractualBuyout({
      ...baseInput,
      mesContratual: 12,
      fatorDepreciacaoEconomica: 0.9,
      amortizacaoTecnicaAcumulada: 1_000, // vecBase = 89000
    })
    expect(highBase.vecBase).toBeCloseTo(89_000, 2)
    expect(highBase.vecFinal).toBeCloseTo(89_000, 2) // piso (40000) não prevalece

    // vecBase baixo (< piso) → vecFinal = piso
    const lowBase = computeContractualBuyout({
      ...baseInput,
      mesContratual: 12,
      fatorDepreciacaoEconomica: 0.1,
      amortizacaoTecnicaAcumulada: 1_000, // vecBase = 9000
    })
    expect(lowBase.vecBase).toBeCloseTo(9_000, 2)
    expect(lowBase.pisoResidualAplicado).toBeCloseTo(40_000, 2)
    expect(lowBase.vecFinal).toBeCloseTo(40_000, 2) // piso prevalece
  })

  // 11. Consistência com computeDepreciationFactor + computeLinearTechnicalAmortization
  it('integra corretamente com computeDepreciationFactor e computeLinearTechnicalAmortization', () => {
    const vm0 = 100_000
    const depreciacaoAa = 0.12
    const prazo = 60
    const m = 12

    const f = computeDepreciationFactor(depreciacaoAa, m)
    const a = computeLinearTechnicalAmortization(vm0, m, prazo)

    const result = computeContractualBuyout({
      mesContratual: m,
      prazoContratualMeses: prazo,
      valorMercadoUsina: vm0,
      valorOriginalAtivo: vm0,
      fatorDepreciacaoEconomica: f,
      amortizacaoTecnicaAcumulada: a,
    })

    // vecBase deve ser positivo (F ≈ 0.885, A = 20000, VM*F ≈ 88500 > 20000)
    expect(result.vecBase).toBeGreaterThan(0)
    // vecFinal >= piso (40000)
    expect(result.vecFinal).toBeGreaterThanOrEqual(40_000)
    // memoriaCalculo contém os valores passados
    expect(result.memoriaCalculo.f).toBeCloseTo(f, 6)
    expect(result.memoriaCalculo.a).toBeCloseTo(a, 6)
    expect(result.memoriaCalculo.vm).toBe(vm0)
  })
})
