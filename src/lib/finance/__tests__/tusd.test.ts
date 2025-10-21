import { describe, expect, it } from 'vitest'

import {
  PESO_TUSD_PADRAO,
  SIMULTANEIDADE_PADRAO,
  calcTusdNaoCompensavel,
  fatorAnoTUSD,
  type TUSDInput,
} from '../tusd'

const createInput = (partial: Partial<TUSDInput> = {}): TUSDInput => ({
  ano: 2025,
  tipoCliente: 'residencial',
  consumoMensal_kWh: 600,
  tarifaCheia_R_kWh: 0.964,
  pesoTUSD: PESO_TUSD_PADRAO,
  ...partial,
})

describe('fatorAnoTUSD', () => {
  it('segue a regra de transição de 2025 a 2029', () => {
    expect(fatorAnoTUSD(2025)).toBe(0.45)
    expect(fatorAnoTUSD(2026)).toBe(0.6)
    expect(fatorAnoTUSD(2027)).toBe(0.75)
    expect(fatorAnoTUSD(2028)).toBe(0.9)
    expect(fatorAnoTUSD(2029)).toBe(1)
    expect(fatorAnoTUSD(2035)).toBe(1)
  })
})

describe('calcTusdNaoCompensavel', () => {
  it('prioriza simultaneidade informada manualmente', () => {
    const resultado = calcTusdNaoCompensavel(
      createInput({
        consumoMensal_kWh: 800,
        tipoCliente: 'comercial',
        simultaneidadePadrao: 0.55,
      }),
    )

    expect(resultado.simultaneidadeUsada).toBeCloseTo(0.55, 6)
    expect(resultado.kWhInstantaneo).toBeCloseTo(440, 6)
    expect(resultado.kWhCompensado).toBeCloseTo(360, 6)
  })

  it('utiliza configuração padrão quando disponível', () => {
    const resultado = calcTusdNaoCompensavel(
      createInput({ tipoCliente: 'comercial', subTipo: 'diurno', consumoMensal_kWh: 500 }),
    )

    expect(resultado.simultaneidadeUsada).toBeCloseTo(
      SIMULTANEIDADE_PADRAO.comercial.diurno,
      6,
    )
    expect(resultado.kWhInstantaneo).toBeCloseTo(350, 6)
    expect(resultado.kWhCompensado).toBeCloseTo(150, 6)
  })

  it('faz fallback seguro para 30% de simultaneidade quando subtipo é inválido', () => {
    const resultado = calcTusdNaoCompensavel(
      createInput({ tipoCliente: 'industrial', subTipo: 'inexistente', consumoMensal_kWh: 500 }),
    )

    expect(resultado.simultaneidadeUsada).toBeCloseTo(0.3, 6)
    expect(resultado.kWhInstantaneo).toBeCloseTo(150, 6)
    expect(resultado.kWhCompensado).toBeCloseTo(350, 6)
  })

  it('zera custo quando não há consumo compensado', () => {
    const resultado = calcTusdNaoCompensavel(
      createInput({ consumoMensal_kWh: 0, tipoCliente: 'hibrido', subTipo: 'padrao' }),
    )

    expect(resultado.custoTUSD_Mes_R).toBe(0)
    expect(resultado.kWhInstantaneo).toBe(0)
    expect(resultado.kWhCompensado).toBe(0)
  })

  it('replica os exemplos fornecidos na documentação', () => {
    const residenciaPadrao = calcTusdNaoCompensavel(
      createInput({ ano: 2025, tipoCliente: 'residencial', subTipo: 'padrao' }),
    )
    const comercioDiurno = calcTusdNaoCompensavel(
      createInput({ ano: 2025, tipoCliente: 'comercial', subTipo: 'diurno' }),
    )
    const residenciaBaterias = calcTusdNaoCompensavel(
      createInput({ ano: 2025, tipoCliente: 'residencial', subTipo: 'baterias' }),
    )

    expect(residenciaPadrao.kWhInstantaneo).toBeCloseTo(180, 6)
    expect(residenciaPadrao.kWhCompensado).toBeCloseTo(420, 6)
    expect(residenciaPadrao.tusdNaoComp_R_kWh).toBeCloseTo(0.117126, 6)
    expect(residenciaPadrao.custoTUSD_Mes_R).toBeCloseTo(49.19892, 5)
    expect(Number(residenciaPadrao.custoTUSD_Mes_R.toFixed(2))).toBeCloseTo(49.2, 2)

    expect(comercioDiurno.kWhInstantaneo).toBeCloseTo(420, 6)
    expect(comercioDiurno.kWhCompensado).toBeCloseTo(180, 6)
    expect(comercioDiurno.tusdNaoComp_R_kWh).toBeCloseTo(0.117126, 6)
    expect(comercioDiurno.custoTUSD_Mes_R).toBeCloseTo(21.08268, 5)
    expect(Number(comercioDiurno.custoTUSD_Mes_R.toFixed(2))).toBeCloseTo(21.08, 2)

    expect(residenciaBaterias.kWhInstantaneo).toBeCloseTo(360, 6)
    expect(residenciaBaterias.kWhCompensado).toBeCloseTo(240, 6)
    expect(residenciaBaterias.tusdNaoComp_R_kWh).toBeCloseTo(0.117126, 6)
    expect(residenciaBaterias.custoTUSD_Mes_R).toBeCloseTo(28.11024, 5)
    expect(Number(residenciaBaterias.custoTUSD_Mes_R.toFixed(2))).toBeCloseTo(28.11, 2)
  })

  it('gera snapshot dos exemplos residencial e comercial', () => {
    const snapshot = {
      residenciaPadrao: calcTusdNaoCompensavel(
        createInput({ ano: 2025, tipoCliente: 'residencial', subTipo: 'padrao' }),
      ),
      comercioDiurno: calcTusdNaoCompensavel(
        createInput({ ano: 2025, tipoCliente: 'comercial', subTipo: 'diurno' }),
      ),
    }

    expect(snapshot).toMatchInlineSnapshot(`
      {
        "comercioDiurno": {
          "custoTUSD_Mes_R": 21.08268,
          "fatorAno": 0.45,
          "kWhCompensado": 180,
          "kWhInstantaneo": 420,
          "simultaneidadeUsada": 0.7,
          "tusdNaoComp_R_kWh": 0.117126,
        },
        "residenciaPadrao": {
          "custoTUSD_Mes_R": 49.19892,
          "fatorAno": 0.45,
          "kWhCompensado": 420,
          "kWhInstantaneo": 180,
          "simultaneidadeUsada": 0.3,
          "tusdNaoComp_R_kWh": 0.117126,
        },
      }
    `)
  })
})
