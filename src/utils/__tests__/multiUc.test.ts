import { describe, expect, it } from 'vitest'

import { calcularMultiUc, ESCALONAMENTO_PADRAO } from '../multiUc'
import type { MultiUcClasse } from '../../types/multiUc'

describe('calcularMultiUc', () => {
  it('distribui créditos e calcula TUSD/TE por UC com rateio percentual', () => {
    const resultado = calcularMultiUc({
      energiaGeradaTotalKWh: 1000,
      distribuicaoPorPercentual: true,
      ucs: [
        {
          id: 'UC-1',
          classe: 'B1_Residencial' as MultiUcClasse,
          consumoKWh: 600,
          rateioPercentual: 50,
          manualRateioKWh: null,
          tarifas: { TE: 0.5, TUSD_total: 0.4, TUSD_FioB: 0.25 },
        },
        {
          id: 'UC-2',
          classe: 'B3_Comercial' as MultiUcClasse,
          consumoKWh: 600,
          rateioPercentual: 50,
          manualRateioKWh: null,
          tarifas: { TE: 0.65, TUSD_total: 0.5, TUSD_FioB: 0.32 },
        },
      ],
      parametrosMLGD: {
        anoVigencia: 2025,
        escalonamentoPadrao: ESCALONAMENTO_PADRAO,
        overrideEscalonamento: false,
      },
    })

    expect(resultado.errors).toHaveLength(0)
    expect(resultado.totalTusd).toBeCloseTo(218.25, 2)
    expect(resultado.totalTe).toBeCloseTo(115, 2)
    expect(resultado.totalContrato).toBeCloseTo(333.25, 2)

    const ucResidencial = resultado.ucs.find((uc) => uc.id === 'UC-1')
    const ucComercial = resultado.ucs.find((uc) => uc.id === 'UC-2')

    expect(ucResidencial).toBeDefined()
    expect(ucComercial).toBeDefined()
    if (!ucResidencial || !ucComercial) {
      return
    }

    expect(ucResidencial.creditosKWh).toBeCloseTo(500, 3)
    expect(ucResidencial.kWhFaturados).toBeCloseTo(100, 3)
    expect(ucResidencial.tusdNaoCompensavel).toBeCloseTo(56.25, 2)
    expect(ucResidencial.tusdNaoCompensada).toBeCloseTo(40, 2)
    expect(ucResidencial.tusdMensal).toBeCloseTo(96.25, 2)
    expect(ucResidencial.teMensal).toBeCloseTo(50, 2)

    expect(ucComercial.creditosKWh).toBeCloseTo(500, 3)
    expect(ucComercial.kWhFaturados).toBeCloseTo(100, 3)
    expect(ucComercial.tusdNaoCompensavel).toBeCloseTo(72, 2)
    expect(ucComercial.tusdNaoCompensada).toBeCloseTo(50, 2)
    expect(ucComercial.tusdMensal).toBeCloseTo(122, 2)
    expect(ucComercial.teMensal).toBeCloseTo(65, 2)
  })

  it('lida com rateio desequilibrado destacando sobras de créditos', () => {
    const resultado = calcularMultiUc({
      energiaGeradaTotalKWh: 1000,
      distribuicaoPorPercentual: true,
      ucs: [
        {
          id: 'UC-B3',
          classe: 'B3_Comercial' as MultiUcClasse,
          consumoKWh: 900,
          rateioPercentual: 80,
          manualRateioKWh: null,
          tarifas: { TE: 0.65, TUSD_total: 0.5, TUSD_FioB: 0.32 },
        },
        {
          id: 'UC-B1',
          classe: 'B1_Residencial' as MultiUcClasse,
          consumoKWh: 150,
          rateioPercentual: 20,
          manualRateioKWh: null,
          tarifas: { TE: 0.5, TUSD_total: 0.4, TUSD_FioB: 0.25 },
        },
      ],
      parametrosMLGD: {
        anoVigencia: 2025,
        escalonamentoPadrao: ESCALONAMENTO_PADRAO,
        overrideEscalonamento: false,
      },
    })

    const ucResidencial = resultado.ucs.find((uc) => uc.id === 'UC-B1')
    const ucComercial = resultado.ucs.find((uc) => uc.id === 'UC-B3')
    expect(ucResidencial).toBeDefined()
    expect(ucComercial).toBeDefined()
    if (!ucResidencial || !ucComercial) {
      return
    }

    expect(ucResidencial.kWhFaturados).toBeCloseTo(0, 5)
    expect(ucResidencial.kWhCompensados).toBeCloseTo(150, 3)
    expect(ucComercial.kWhFaturados).toBeCloseTo(100, 3)
    expect(ucComercial.kWhCompensados).toBeCloseTo(800, 3)

    expect(resultado.sobraCreditosKWh).toBeCloseTo(50, 3)
    expect(
      resultado.warnings.some((mensagem) => mensagem.includes('50.00 kWh')),
    ).toBe(true)
  })

  it('aplica escalonamento crescente do Fio B conforme o ano', () => {
    const baseInput = {
      energiaGeradaTotalKWh: 800,
      distribuicaoPorPercentual: true,
      ucs: [
        {
          id: 'UC-ML',
          classe: 'B3_Comercial' as MultiUcClasse,
          consumoKWh: 800,
          rateioPercentual: 100,
          manualRateioKWh: null,
          tarifas: { TE: 0.6, TUSD_total: 0.48, TUSD_FioB: 0.3 },
        },
      ],
    }

    const resultado2025 = calcularMultiUc({
      ...baseInput,
      parametrosMLGD: {
        anoVigencia: 2025,
        escalonamentoPadrao: ESCALONAMENTO_PADRAO,
        overrideEscalonamento: false,
      },
    })
    const resultado2029 = calcularMultiUc({
      ...baseInput,
      parametrosMLGD: {
        anoVigencia: 2029,
        escalonamentoPadrao: ESCALONAMENTO_PADRAO,
        overrideEscalonamento: false,
      },
    })

    const uc2025 = resultado2025.ucs[0]
    const uc2029 = resultado2029.ucs[0]

    expect(resultado2025.escalonamentoPercentual).toBeCloseTo(0.45, 4)
    expect(resultado2029.escalonamentoPercentual).toBeCloseTo(1, 4)
    expect(uc2029.tusdNaoCompensavel).toBeGreaterThan(uc2025.tusdNaoCompensavel)
  })

  it('emite avisos quando as tarifas estão incompletas', () => {
    const resultado = calcularMultiUc({
      energiaGeradaTotalKWh: 500,
      distribuicaoPorPercentual: true,
      ucs: [
        {
          id: 'UC-1',
          classe: 'B1_Residencial' as MultiUcClasse,
          consumoKWh: 400,
          rateioPercentual: 100,
          manualRateioKWh: null,
          tarifas: { TE: 0, TUSD_total: 0, TUSD_FioB: 0 },
        },
      ],
      parametrosMLGD: {
        anoVigencia: 2025,
        escalonamentoPadrao: ESCALONAMENTO_PADRAO,
        overrideEscalonamento: false,
      },
    })

    expect(resultado.warnings.some((mensagem) => mensagem.includes('tarifas incompletas'))).toBe(true)
  })
})
