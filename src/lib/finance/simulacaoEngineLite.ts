import type { TarifaAtualLite, TarifaHistoricaLite } from '../aneel/aneelClientLite'

export type SimulacaoLiteInput = {
  capex: number
  opexMensal: number
  consumoMensalKwh: number
  energiaVendidaKwhMensal: number
  tarifaInicial?: number
  distribuidoraId?: string
  anosAnalise: number
  tusdAbsorvidaPercent: number
  taxaDescontoAnual: number
  tarifaAneel?: TarifaAtualLite
  historicoAneel?: TarifaHistoricaLite[]
}

export type SimulacaoLiteSerieAnoItem = {
  ano: number
  receitaBruta: number
  opex: number
  tusdAbsorvida: number
  lucroLiquido: number
  tarifaProjetada: number
  lcoe: number
  energiaGerada: number
  roiAcumulado: number
}

export type SimulacaoLiteKPIsEssenciais = {
  capexTotal: number
  opexMensal: number
  opexAnual: number
  lucroLiquidoMensal: number
  lucroLiquidoAnual: number
  lucroLiquidoTotal: number
  roiPercent: number
  paybackMeses: number
}

export type SimulacaoLiteKPIsAvancados = {
  vpl: number
  tir: number | null
  lcoe: number
}

export type SimulacaoLiteResultadoCenario = {
  nome: SimulacaoLiteScenarioKey
  serieAno: SimulacaoLiteSerieAnoItem[]
  kpisEssenciais: SimulacaoLiteKPIsEssenciais
  kpisAvancados: SimulacaoLiteKPIsAvancados
}

export type SimulacaoLiteResultado = {
  input: SimulacaoLiteInput
  serieAno: SimulacaoLiteSerieAnoItem[]
  kpisEssenciais: SimulacaoLiteKPIsEssenciais
  kpisAvancados: SimulacaoLiteKPIsAvancados
  cenarios: {
    base: SimulacaoLiteResultadoCenario
    otimista: SimulacaoLiteResultadoCenario
    pessimista: SimulacaoLiteResultadoCenario
  }
}

export type SimulacaoLiteScenarioKey = 'base' | 'otimista' | 'pessimista'

export type SimulacaoLiteScenarioAdjustments = {
  tarifaMultiplier?: number
  energiaMultiplier?: number
  opexMultiplier?: number
}

const DEFAULT_TARIFA_GROWTH = 0.08

const ensurePositive = (value: number, fallback = 0): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

const sortHistorico = (historico: TarifaHistoricaLite[]): TarifaHistoricaLite[] => {
  return [...historico].sort((a, b) => {
    if (a.ano === b.ano) {
      return a.mes - b.mes
    }
    return a.ano - b.ano
  })
}

const fallbackTarifa = (input: SimulacaoLiteInput): number => {
  if (Number.isFinite(input.tarifaInicial) && (input.tarifaInicial ?? 0) > 0) {
    return input.tarifaInicial as number
  }
  if (input.tarifaAneel?.tarifaConvencional && input.tarifaAneel.tarifaConvencional > 0) {
    return input.tarifaAneel.tarifaConvencional
  }
  return 0.85
}

const fallbackTarifaSeries = (input: SimulacaoLiteInput): number[] => {
  const base = fallbackTarifa(input)
  const anos = Math.max(1, Math.floor(input.anosAnalise))
  const series: number[] = []
  for (let i = 1; i <= anos; i += 1) {
    series.push(base * (1 + DEFAULT_TARIFA_GROWTH) ** i)
  }
  return series
}

export const projetarTarifaLinearAneelLite = (input: SimulacaoLiteInput): number[] => {
  const historico = sortHistorico(input.historicoAneel ?? [])
  if (historico.length < 6) {
    return fallbackTarifaSeries(input)
  }
  const valores = historico.map((item) => ensurePositive(item.tarifa, fallbackTarifa(input)))
  const pontos = valores.map((valor, index) => ({ x: index, y: valor }))
  const n = pontos.length
  const sumX = pontos.reduce((acc, p) => acc + p.x, 0)
  const sumY = pontos.reduce((acc, p) => acc + p.y, 0)
  const sumXY = pontos.reduce((acc, p) => acc + p.x * p.y, 0)
  const sumX2 = pontos.reduce((acc, p) => acc + p.x * p.x, 0)
  const denominator = n * sumX2 - sumX ** 2
  if (denominator === 0) {
    return fallbackTarifaSeries(input)
  }
  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  const anos = Math.max(1, Math.floor(input.anosAnalise))
  const lastIndex = pontos[pontos.length - 1]?.x ?? 0
  const series: number[] = []
  for (let ano = 1; ano <= anos; ano += 1) {
    const x = lastIndex + ano * 12
    const value = slope * x + intercept
    series.push(ensurePositive(value, fallbackTarifa(input)))
  }
  return series
}

const buildSerieAno = (
  input: SimulacaoLiteInput,
  tarifasProjetadas: number[],
  adjustments: SimulacaoLiteScenarioAdjustments = {},
): SimulacaoLiteSerieAnoItem[] => {
  const anos = Math.min(tarifasProjetadas.length, Math.max(1, Math.floor(input.anosAnalise)))
  const energiaMensalBase = Math.max(0, input.energiaVendidaKwhMensal)
  const energiaMensal = energiaMensalBase * (adjustments.energiaMultiplier ?? 1)
  const opexMensalAjustado = input.opexMensal * (adjustments.opexMultiplier ?? 1)
  const opexAnual = opexMensalAjustado * 12
  const tusdPercent = Math.max(0, Math.min(1, input.tusdAbsorvidaPercent))
  const serie: SimulacaoLiteSerieAnoItem[] = []
  let lucroAcumulado = 0
  const baseAno = new Date().getFullYear()
  for (let index = 0; index < anos; index += 1) {
    const tarifa = (tarifasProjetadas[index] ?? tarifasProjetadas[tarifasProjetadas.length - 1] ?? 0) *
      (adjustments.tarifaMultiplier ?? 1)
    const receitaBruta = energiaMensal * 12 * tarifa
    const tusdAbsorvida = receitaBruta * tusdPercent
    const lucroLiquido = receitaBruta - opexAnual - tusdAbsorvida
    lucroAcumulado += lucroLiquido
    const energiaAnual = energiaMensal * 12
    const custoAcumulado = input.capex + opexAnual * (index + 1)
    const energiaAcumulada = energiaAnual * (index + 1)
    const lcoe = energiaAcumulada > 0 ? custoAcumulado / energiaAcumulada : 0
    const roiAcumulado = input.capex > 0 ? (lucroAcumulado / input.capex) * 100 : 0
    serie.push({
      ano: baseAno + index,
      receitaBruta,
      opex: opexAnual,
      tusdAbsorvida,
      lucroLiquido,
      tarifaProjetada: tarifa,
      lcoe,
      energiaGerada: energiaAnual,
      roiAcumulado,
    })
  }
  return serie
}

const calcPaybackMeses = (capex: number, serie: SimulacaoLiteSerieAnoItem[]): number => {
  if (capex <= 0) {
    return 0
  }
  let acumulado = 0
  let meses = 0
  for (const ano of serie) {
    const lucroMensal = ano.lucroLiquido / 12
    for (let mes = 0; mes < 12; mes += 1) {
      meses += 1
      acumulado += lucroMensal
      if (acumulado >= capex) {
        return meses
      }
    }
  }
  return Number.POSITIVE_INFINITY
}

export const computeKPIsEssenciaisLite = (
  input: SimulacaoLiteInput,
  serieAno: SimulacaoLiteSerieAnoItem[] = [],
): SimulacaoLiteKPIsEssenciais => {
  const opexMensal = Math.max(0, input.opexMensal)
  const opexAnual = opexMensal * 12
  const lucroLiquidoTotal = serieAno.reduce((acc, item) => acc + item.lucroLiquido, 0)
  const lucroLiquidoAnual = serieAno[0]?.lucroLiquido ?? 0
  const lucroLiquidoMensal = lucroLiquidoAnual / 12
  const roiPercent = input.capex > 0 ? (lucroLiquidoTotal / input.capex) * 100 : 0
  const paybackMeses = calcPaybackMeses(input.capex, serieAno)
  return {
    capexTotal: input.capex,
    opexMensal,
    opexAnual,
    lucroLiquidoMensal,
    lucroLiquidoAnual,
    lucroLiquidoTotal,
    roiPercent,
    paybackMeses,
  }
}

const calcVpl = (input: SimulacaoLiteInput, serie: SimulacaoLiteSerieAnoItem[]): number => {
  const taxa = Math.max(0, input.taxaDescontoAnual)
  let vpl = -input.capex
  serie.forEach((item, index) => {
    vpl += item.lucroLiquido / (1 + taxa) ** (index + 1)
  })
  return vpl
}

const calcIrr = (cashFlows: number[]): number | null => {
  if (cashFlows.length < 2) {
    return null
  }
  let rate = 0.1
  for (let i = 0; i < 100; i += 1) {
    let npv = 0
    let derivative = 0
    cashFlows.forEach((cf, index) => {
      const t = index
      const denominator = (1 + rate) ** t
      npv += cf / denominator
      if (t > 0) {
        derivative -= (t * cf) / (1 + rate) ** (t + 1)
      }
    })
    if (Math.abs(derivative) < 1e-8) {
      break
    }
    const nextRate = rate - npv / derivative
    if (!Number.isFinite(nextRate) || nextRate <= -0.9999) {
      break
    }
    if (Math.abs(nextRate - rate) < 1e-6) {
      return nextRate
    }
    rate = nextRate
  }
  return rate > -0.9999 ? rate : null
}

const calcLcoe = (input: SimulacaoLiteInput, serie: SimulacaoLiteSerieAnoItem[]): number => {
  const energiaTotal = serie.reduce((acc, item) => acc + item.energiaGerada, 0)
  const custoTotal = input.capex + serie.reduce((acc, item) => acc + item.opex, 0)
  return energiaTotal > 0 ? custoTotal / energiaTotal : 0
}

export const computeKPIsAvancadosLite = (
  input: SimulacaoLiteInput,
  serieAno: SimulacaoLiteSerieAnoItem[] = [],
): SimulacaoLiteKPIsAvancados => {
  const vpl = calcVpl(input, serieAno)
  const cashFlows = [-input.capex, ...serieAno.map((item) => item.lucroLiquido)]
  const tir = calcIrr(cashFlows)
  const lcoe = calcLcoe(input, serieAno)
  return { vpl, tir, lcoe }
}

const buildScenario = (
  nome: SimulacaoLiteScenarioKey,
  input: SimulacaoLiteInput,
  tarifasProjetadas: number[],
  adjustments: SimulacaoLiteScenarioAdjustments,
): SimulacaoLiteResultadoCenario => {
  const serieAno = buildSerieAno(input, tarifasProjetadas, adjustments)
  return {
    nome,
    serieAno,
    kpisEssenciais: computeKPIsEssenciaisLite(input, serieAno),
    kpisAvancados: computeKPIsAvancadosLite(input, serieAno),
  }
}

export const gerarCenariosLite = (
  input: SimulacaoLiteInput,
  tarifasBase?: number[],
): {
  base: SimulacaoLiteResultadoCenario
  otimista: SimulacaoLiteResultadoCenario
  pessimista: SimulacaoLiteResultadoCenario
} => {
  const tarifasProjetadas = tarifasBase ?? projetarTarifaLinearAneelLite(input)
  const base = buildScenario('base', input, tarifasProjetadas, {})
  const otimista = buildScenario('otimista', input, tarifasProjetadas, {
    tarifaMultiplier: 1.1,
    energiaMultiplier: 1.05,
    opexMultiplier: 0.95,
  })
  const pessimista = buildScenario('pessimista', input, tarifasProjetadas, {
    tarifaMultiplier: 0.95,
    energiaMultiplier: 0.95,
    opexMultiplier: 1.05,
  })
  return { base, otimista, pessimista }
}

export const runSimulacaoLite = (input: SimulacaoLiteInput): SimulacaoLiteResultado => {
  const tarifasProjetadas = projetarTarifaLinearAneelLite(input)
  const serieAno = buildSerieAno(input, tarifasProjetadas)
  const kpisEssenciais = computeKPIsEssenciaisLite(input, serieAno)
  const kpisAvancados = computeKPIsAvancadosLite(input, serieAno)
  const cenarios = gerarCenariosLite(input, tarifasProjetadas)
  return {
    input,
    serieAno,
    kpisEssenciais,
    kpisAvancados,
    cenarios,
  }
}
