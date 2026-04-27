import { useMemo } from 'react'
import { type SimulationState } from '../../selectors'
import { calcularTaxaMinima } from '../../utils/calcs'
import { calcPotenciaSistemaKwp } from '../../lib/pricing/pricingPorKwp'
import { DEFAULT_TUSD_ANO_REFERENCIA } from '../../lib/finance/tusd'
import { useAfInputStore } from './useAfInputStore'
import {
  selectAfConsumoOverride,
  selectAfIrradiacaoOverride,
  selectAfPROverride,
  selectAfDiasOverride,
  selectAfModuloWpOverride,
  selectAfNumModulosOverride,
  selectAfMesesProjecao,
} from './afInputSelectors'

export interface TarifaContexto {
  kcKwhMes: number
  tarifaCheia: number
  descontoConsiderado: number

  inflacaoAa: number
  taxaMinima: number
  taxaMinimaInputEmpty: boolean

  tipoRede: string

  tusdPercent: number
  tusdTipoCliente: string
  tusdSubtipo: string
  tusdSimultaneidade: number
  tusdTarifaRkwh: number
  tusdAnoReferencia: number

  mesReajuste: number
  mesReferencia: number

  encargosFixos: number
  cidKwhBase: number

  baseIrradiacao: number
  eficienciaNormalizada: number
  diasMesNormalizado: number

  potenciaModulo: number

  ufTarifa: string

  aplicaTaxaMinima: boolean
}

export function useAfSimEstadoMensalidade(ctx: TarifaContexto): SimulationState | null {
  const afConsumoOverride = useAfInputStore(selectAfConsumoOverride)
  const afIrradiacaoOverride = useAfInputStore(selectAfIrradiacaoOverride)
  const afPROverride = useAfInputStore(selectAfPROverride)
  const afDiasOverride = useAfInputStore(selectAfDiasOverride)
  const afModuloWpOverride = useAfInputStore(selectAfModuloWpOverride)
  const afNumModulosOverride = useAfInputStore(selectAfNumModulosOverride)
  const afMesesProjecao = useAfInputStore(selectAfMesesProjecao)

  return useMemo<SimulationState | null>(() => {
    const resolveOverride = (override: number, fallback: number, def: number) => {
      const v = override > 0 ? override : fallback
      return v > 0 ? v : def
    }
    const consumo = resolveOverride(afConsumoOverride, ctx.kcKwhMes, 0)
    if (consumo <= 0) return null

    const irr = resolveOverride(afIrradiacaoOverride, ctx.baseIrradiacao, 5.0)
    const pr = resolveOverride(afPROverride, ctx.eficienciaNormalizada, 0.8)
    const dias = resolveOverride(afDiasOverride, ctx.diasMesNormalizado, 30)
    const modulo = resolveOverride(afModuloWpOverride, ctx.potenciaModulo, 550)

    let potenciaKwp = 0
    if (afNumModulosOverride != null && afNumModulosOverride > 0) {
      potenciaKwp = (afNumModulosOverride * modulo) / 1000
    } else {
      const computed = calcPotenciaSistemaKwp({
        consumoKwhMes: consumo,
        irradiacao: irr,
        performanceRatio: pr,
        diasMes: dias,
        potenciaModuloWp: modulo,
      })
      potenciaKwp = computed?.potenciaKwp ?? 0
    }
    const afGeracaoKwh = potenciaKwp * irr * pr * dias

    const tusdPercentual = Math.max(0, ctx.tusdPercent)
    const tusdSubtipoNorm = ctx.tusdSubtipo.trim()
    return {
      kcKwhMes: consumo,
      consumoMensalKwh: consumo,
      geracaoMensalKwh: Math.max(0, afGeracaoKwh),
      prazoMeses: afMesesProjecao,
      entradaRs: 0,
      modoEntrada: 'NONE',
      // Tariff/TUSD fields — same normalization used in simulationState and afSimState
      tarifaCheia: Math.max(0, ctx.tarifaCheia),
      desconto: Math.max(0, Math.min(ctx.descontoConsiderado / 100, 1)),
      inflacaoAa: Math.max(-0.99, ctx.inflacaoAa / 100),
      taxaMinima: ctx.taxaMinimaInputEmpty
        ? calcularTaxaMinima(ctx.tipoRede, Math.max(0, ctx.tarifaCheia))
        : Number.isFinite(ctx.taxaMinima) ? Math.max(0, ctx.taxaMinima) : 0,
      aplicaTaxaMinima: ctx.aplicaTaxaMinima,
      tipoRede: ctx.tipoRede,
      tusdPercent: tusdPercentual,
      tusdPercentualFioB: tusdPercentual,
      tusdTipoCliente: ctx.tusdTipoCliente,
      tusdSubtipo: tusdSubtipoNorm.length > 0 ? tusdSubtipoNorm : null,
      tusdSimultaneidade: ctx.tusdSimultaneidade != null ? Math.max(0, ctx.tusdSimultaneidade) : null,
      tusdTarifaRkwh: ctx.tusdTarifaRkwh != null ? Math.max(0, ctx.tusdTarifaRkwh) : null,
      tusdAnoReferencia: Number.isFinite(ctx.tusdAnoReferencia)
        ? Math.max(1, Math.trunc(ctx.tusdAnoReferencia))
        : DEFAULT_TUSD_ANO_REFERENCIA,
      mesReajuste: Math.min(Math.max(Math.round(ctx.mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(ctx.mesReferencia) || 1, 1), 12),
      encargosFixos: ctx.encargosFixos,
      cidKwhBase: ctx.cidKwhBase,
      // Fields not consulted by selectMensalidades — safe zero defaults
      vm0: 0,
      depreciacaoAa: 0,
      ipcaAa: 0,
      inadimplenciaAa: 0,
      tributosAa: 0,
      custosFixosM: 0,
      opexM: 0,
      seguroM: 0,
      cashbackPct: 0,
      pagosAcumManual: 0,
      duracaoMeses: 0,
    }
  }, [
    afConsumoOverride, ctx.kcKwhMes,
    afIrradiacaoOverride, ctx.baseIrradiacao,
    afPROverride, ctx.eficienciaNormalizada,
    afDiasOverride, ctx.diasMesNormalizado,
    afModuloWpOverride, ctx.potenciaModulo,
    afNumModulosOverride,
    afMesesProjecao,
    ctx.tarifaCheia, ctx.descontoConsiderado, ctx.inflacaoAa, ctx.taxaMinima, ctx.taxaMinimaInputEmpty,
    ctx.tipoRede, ctx.tusdPercent, ctx.tusdTipoCliente, ctx.tusdSubtipo, ctx.tusdSimultaneidade,
    ctx.tusdTarifaRkwh, ctx.tusdAnoReferencia, ctx.mesReajuste, ctx.mesReferencia,
    ctx.aplicaTaxaMinima, ctx.encargosFixos, ctx.cidKwhBase,
  ])
}
