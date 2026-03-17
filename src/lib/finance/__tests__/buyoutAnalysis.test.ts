import { describe, expect, it } from 'vitest'

import { analyzeBuyoutWindow, buildRoiProgression } from '../buyoutAnalysis'
import type { SimulationState } from '../../../selectors'

const baseState: SimulationState = {
  kcKwhMes: 600,
  tarifaCheia: 1.14,
  desconto: 0.2,
  inflacaoAa: 0.04,
  prazoMeses: 60,
  taxaMinima: 0,
  encargosFixos: 0,
  entradaRs: 0,
  modoEntrada: 'NAO_REDUZ',
  vm0: 100000,
  depreciacaoAa: 0.12,
  ipcaAa: 0.04,
  inadimplenciaAa: 0,
  tributosAa: 0,
  custosFixosM: 0,
  opexM: 0,
  seguroM: 0,
  cashbackPct: 0,
  pagosAcumManual: 0,
  duracaoMeses: 60,
  geracaoMensalKwh: 600,
  consumoMensalKwh: 600,
  mesReajuste: 6,
  mesReferencia: 1,
  tusdPercent: 27,
  tusdPercentualFioB: 27,
  tusdTipoCliente: 'residencial',
  tusdSubtipo: null,
  tusdSimultaneidade: null,
  tusdTarifaRkwh: null,
  tusdAnoReferencia: 2025,
  aplicaTaxaMinima: false,
  cidKwhBase: 0,
  tipoRede: 'nenhum',
}

describe('buyoutAnalysis', () => {
  it('analisa melhor/pior janela até mês 36 e progressão de ROI', () => {
    const janela = analyzeBuyoutWindow(baseState, 7, 36)
    const roiProgression = buildRoiProgression(baseState, 7, 45, 6)

    console.table(
      roiProgression.map((item) => ({
        mes: item.mes,
        roiSolarinvestPct: Number((item.roiSolarinvest * 100).toFixed(2)),
        valorBuyout: item.valorBuyout,
        ganhoLiquidoCliente: item.ganhoLiquidoCliente,
      })),
    )

    expect(janela.meses.length).toBe(30)
    expect(janela.melhorMesCliente?.mes).toBe(36)
    expect(janela.melhorMesSolarinvest?.mes).toBe(7)
    expect(janela.piorMesSolarinvest?.mes).toBe(36)

    expect(roiProgression.map((item) => item.mes)).toEqual([7, 13, 19, 25, 31, 37, 43, 45])
    expect(roiProgression[0].roiSolarinvest).toBeGreaterThan(roiProgression[roiProgression.length - 1].roiSolarinvest)
    expect(roiProgression.every((item) => item.ganhoLiquidoCliente < 0)).toBe(true)
  })
})
