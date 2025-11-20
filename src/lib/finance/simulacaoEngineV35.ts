import { fetchDadosTUSD, fetchHistoricoTarifas, fetchTarifasDistribuidora, type DadosTUSD, type TarifaAtual, type TarifaHistorica } from '../aneel/aneelClient'

export type SimulacaoInput = {
  id?: string
  tipoSistema: 'leasing' | 'venda' | 'hibrido' | 'offgrid'
  capex: number
  opexMensal: number
  consumoMensalKwh: number
  energiaVendidaKwhMensal: number
  tarifaInicial: number
  distribuidoraId?: string
  anosAnalise: number
  tusdAbsorvidaPercent: number
  taxaDesconto: number
  inflacaoEnergiaBasePercent?: number
  dadosAneel?: {
    tarifaAtual?: TarifaAtual
    historico?: TarifaHistorica[]
    tusd?: DadosTUSD
  }
  inadimplenciaEsperadaMeses?: number
  valorResidualPercent?: number
}

export type SimulacaoResultadoCenario = {
  nome: 'base' | 'otimista' | 'pessimista'
  serieReceita: number[]
  serieOpex: number[]
  roiTotalPercent: number
  paybackMeses: number
}

export type SimulacaoMonteCarloResultado = {
  n: number
  roiSamples: number[]
  lucroSamples: number[]
  estatisticas: {
    roiMedio: number
    roiP5: number
    roiP50: number
    roiP95: number
    probRoiNegativo: number
    lucroMedio: number
    probPrejuizo: number
    desvioPadraoRoi: number
  }
}

export type SensibilidadeParametros = {
  deltasTarifa: number[]
  deltasGeracao: number[]
  deltasCapex: number[]
  deltasTUSD: number[]
}

export type SensibilidadeCelula = {
  deltaTarifa: number
  deltaGeracao: number
  deltaCapex: number
  deltaTUSD: number
  roiAnualPercent: number
}

export type SimulacaoSensibilidadeResultado = {
  celulas: SensibilidadeCelula[]
}

export type SimulacaoResultado = {
  input: SimulacaoInput
  kpisEssenciais: {
    paybackMeses: number
    roiTotalPercent: number
    roiAnualPercent: number
    margemLiquidaPercent: number
    opexSobreReceitaPercent: number
  }
  kpisAvancados: {
    tirRealPercent: number
    vpl: number
    lcoe: number
    spreadEnergiaPercent: number
  }
  seriesAno: Array<{
    ano: number
    receitaBruta: number
    opex: number
    tusdAbsorvida: number
    lucroLiquido: number
    tarifaProjetada: number
    lcoeAno: number
  }>
  cenarios: {
    base: SimulacaoResultadoCenario
    otimista: SimulacaoResultadoCenario
    pessimista: SimulacaoResultadoCenario
  }
  riscoMonteCarlo?: SimulacaoMonteCarloResultado
  sensibilidade?: SimulacaoSensibilidadeResultado
}

const ensurePositive = (value: number, fallback: number) => (Number.isFinite(value) && value > 0 ? value : fallback)

const regressionSlope = (historico: TarifaHistorica[]) => {
  if (historico.length < 2) return 0
  const xs = historico.map((_, idx) => idx)
  const ys = historico.map((item) => item.tarifa)
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
  const num = xs.reduce((sum, x, idx) => sum + (x - meanX) * (ys[idx] - meanY), 0)
  const den = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
  return den === 0 ? 0 : num / den
}

export async function enrichInputWithAneel(input: SimulacaoInput): Promise<SimulacaoInput> {
  if (!input.distribuidoraId) return input
  const [tarifaAtual, historico, tusd] = await Promise.all([
    fetchTarifasDistribuidora(input.distribuidoraId),
    fetchHistoricoTarifas(input.distribuidoraId),
    fetchDadosTUSD(input.distribuidoraId),
  ])
  return { ...input, dadosAneel: { tarifaAtual, historico, tusd } }
}

export function projetarTarifa(input: SimulacaoInput): number[] {
  const anos = Math.max(1, input.anosAnalise)
  const inflacao = ensurePositive(input.inflacaoEnergiaBasePercent ?? 0.08, 0.08)
  const historico = input.dadosAneel?.historico
  const curva: number[] = []
  const slope = historico && historico.length > 1 ? regressionSlope(historico) : 0
  const baseTarifa = input.dadosAneel?.tarifaAtual?.tarifaConvencional ?? input.tarifaInicial

  for (let i = 0; i < anos; i += 1) {
    const projection = historico && slope !== 0 ? baseTarifa + slope * i : baseTarifa * (1 + inflacao) ** i
    curva.push(Math.max(0.1, projection))
  }

  return curva
}

export function projetarTUSD(input: SimulacaoInput): number[] {
  const anos = Math.max(1, input.anosAnalise)
  const tendencia = input.dadosAneel?.tusd?.tendenciaAnual ?? 0.03
  const base = input.dadosAneel?.tusd?.atual ?? 0.35
  return Array.from({ length: anos }, (_, idx) => Math.max(0.05, base * (1 + tendencia) ** idx))
}

export function computeKPIsBasicos(input: SimulacaoInput) {
  const receitaMensal = input.energiaVendidaKwhMensal * input.tarifaInicial
  const margem = receitaMensal - input.opexMensal
  const paybackMeses = margem > 0 ? Math.ceil(input.capex / margem) : Infinity
  const receitaTotal = receitaMensal * 12 * input.anosAnalise
  const lucroTotal = receitaTotal - input.opexMensal * 12 * input.anosAnalise - input.capex
  const roiTotalPercent = input.capex > 0 ? (lucroTotal / input.capex) * 100 : 0
  const roiAnualPercent = input.capex > 0 ? (margem * 12 / input.capex) * 100 : 0
  const margemLiquidaPercent = receitaMensal > 0 ? (margem / receitaMensal) * 100 : 0
  const opexSobreReceitaPercent = receitaMensal > 0 ? (input.opexMensal / receitaMensal) * 100 : 0

  return { paybackMeses, roiTotalPercent, roiAnualPercent, margemLiquidaPercent, opexSobreReceitaPercent }
}

export function computeKPIsAvancados(input: SimulacaoInput, seriesAno: SimulacaoResultado['seriesAno']) {
  const cashflows = seriesAno.map((serie) => serie.lucroLiquido)
  cashflows.unshift(-input.capex)
  const taxa = ensurePositive(input.taxaDesconto, 0.1)
  let vpl = -input.capex
  cashflows.slice(1).forEach((cf, idx) => {
    vpl += cf / (1 + taxa) ** (idx + 1)
  })

  const tirRealPercent = internalRateOfReturn(cashflows) * 100
  const totalEnergia = input.energiaVendidaKwhMensal * 12 * input.anosAnalise
  const lcoe = totalEnergia > 0 ? (input.capex + input.opexMensal * 12 * input.anosAnalise) / totalEnergia : 0
  const spreadEnergiaPercent = seriesAno.length
    ? ((seriesAno[0].tarifaProjetada - lcoe) / seriesAno[0].tarifaProjetada) * 100
    : 0

  return { tirRealPercent, vpl, lcoe, spreadEnergiaPercent }
}

function internalRateOfReturn(cashflows: number[], guess = 0.1): number {
  let rate = guess
  for (let i = 0; i < 50; i += 1) {
    const npv = cashflows.reduce((acc, cf, idx) => acc + cf / (1 + rate) ** idx, 0)
    const derivative = cashflows.reduce((acc, cf, idx) => acc - (idx * cf) / (1 + rate) ** (idx + 1), 0)
    if (!Number.isFinite(derivative) || derivative === 0) break
    const nextRate = rate - npv / derivative
    if (!Number.isFinite(nextRate)) break
    if (Math.abs(nextRate - rate) < 1e-6) return nextRate
    rate = nextRate
  }
  return rate
}

export function computeSeriesAno(input: SimulacaoInput): SimulacaoResultado['seriesAno'] {
  const tarifas = projetarTarifa(input)
  const tusd = projetarTUSD(input)
  const inadimplencia = input.inadimplenciaEsperadaMeses ?? 0
  const series = tarifas.map((tarifa, idx) => {
    const receitaBruta = input.energiaVendidaKwhMensal * tarifa * 12
    const opex = input.opexMensal * 12
    const tusdAbsorvida = tusd[idx] * input.tusdAbsorvidaPercent * 12 * input.consumoMensalKwh
    const perdaInadimplencia = (inadimplencia / 12) * receitaBruta
    const lucroLiquido = receitaBruta - opex - tusdAbsorvida - perdaInadimplencia
    const lcoeAno = input.energiaVendidaKwhMensal > 0 ? (opex + input.capex / input.anosAnalise) / (input.energiaVendidaKwhMensal * 12) : 0
    return {
      ano: idx + 1,
      receitaBruta,
      opex,
      tusdAbsorvida,
      lucroLiquido,
      tarifaProjetada: tarifa,
      lcoeAno,
    }
  })
  return series
}

export function computeCenariosPadrao(input: SimulacaoInput) {
  const baseSeries = computeSeriesAno(input)

  const otimistaTarifa = input.tarifaInicial * 1.1
  const pessimistaTarifa = input.tarifaInicial * 0.9

  const mkCenario = (nome: SimulacaoResultadoCenario['nome'], tarifaRef: number) => {
    const receitaMensal = input.energiaVendidaKwhMensal * tarifaRef
    const margem = receitaMensal - input.opexMensal
    const paybackMeses = margem > 0 ? Math.ceil(input.capex / margem) : Infinity
    const receitaTotal = receitaMensal * 12 * input.anosAnalise
    const lucroTotal = receitaTotal - input.opexMensal * 12 * input.anosAnalise - input.capex
    const roiTotalPercent = input.capex > 0 ? (lucroTotal / input.capex) * 100 : 0
    return {
      nome,
      serieReceita: baseSeries.map((serie, idx) => serie.receitaBruta * (tarifaRef / input.tarifaInicial) ** idx),
      serieOpex: baseSeries.map((serie) => serie.opex),
      roiTotalPercent,
      paybackMeses,
    }
  }

  return {
    base: mkCenario('base', input.tarifaInicial),
    otimista: mkCenario('otimista', otimistaTarifa),
    pessimista: mkCenario('pessimista', pessimistaTarifa),
  }
}

export function runMonteCarlo(input: SimulacaoInput, nSimulacoes: number): SimulacaoMonteCarloResultado {
  const samplesRoi: number[] = []
  const samplesLucro: number[] = []
  const baseTarifas = projetarTarifa(input)
  const baseTUSD = projetarTUSD(input)

  for (let i = 0; i < nSimulacoes; i += 1) {
    const fatorTarifa = 1 + (Math.random() - 0.5) * 0.2
    const fatorGeracao = 1 + (Math.random() - 0.5) * 0.2
    const fatorTUSD = 1 + (Math.random() - 0.5) * 0.2
    const fatorOpex = 1 + Math.random() * 0.1

    const receita = baseTarifas.reduce((acc, tarifa) => acc + tarifa * fatorTarifa * input.energiaVendidaKwhMensal * fatorGeracao, 0)
    const opex = input.opexMensal * 12 * input.anosAnalise * fatorOpex
    const tusdAbs = baseTUSD.reduce((acc, tusd) => acc + tusd * fatorTUSD * input.tusdAbsorvidaPercent * input.consumoMensalKwh, 0)
    const lucro = receita - opex - tusdAbs - input.capex
    const roi = input.capex > 0 ? (lucro / input.capex) * 100 : 0
    samplesRoi.push(roi)
    samplesLucro.push(lucro)
  }

  const sortedRoi = [...samplesRoi].sort((a, b) => a - b)
  const p = (percent: number) => sortedRoi[Math.floor((percent / 100) * sortedRoi.length)]
  const roiMedio = samplesRoi.reduce((a, b) => a + b, 0) / samplesRoi.length
  const lucroMedio = samplesLucro.reduce((a, b) => a + b, 0) / samplesLucro.length
  const probRoiNegativo = samplesRoi.filter((roi) => roi < 0).length / samplesRoi.length
  const probPrejuizo = samplesLucro.filter((l) => l < 0).length / samplesLucro.length
  const desvioPadraoRoi = Math.sqrt(
    samplesRoi.reduce((acc, roi) => acc + (roi - roiMedio) ** 2, 0) / samplesRoi.length,
  )

  return {
    n: nSimulacoes,
    roiSamples: samplesRoi,
    lucroSamples: samplesLucro,
    estatisticas: {
      roiMedio,
      roiP5: p(5),
      roiP50: p(50),
      roiP95: p(95),
      probRoiNegativo,
      lucroMedio,
      probPrejuizo,
      desvioPadraoRoi,
    },
  }
}

export function computeSensibilidade(input: SimulacaoInput, parametros: SensibilidadeParametros): SimulacaoSensibilidadeResultado {
  const celulas: SensibilidadeCelula[] = []
  parametros.deltasTarifa.forEach((deltaTarifa) => {
    parametros.deltasGeracao.forEach((deltaGeracao) => {
      parametros.deltasCapex.forEach((deltaCapex) => {
        parametros.deltasTUSD.forEach((deltaTUSD) => {
          const receitaMensal = input.energiaVendidaKwhMensal * (1 + deltaGeracao) * input.tarifaInicial * (1 + deltaTarifa)
          const opexMensal = input.opexMensal
          const capex = input.capex * (1 + deltaCapex)
          const margem = receitaMensal - opexMensal - input.tusdAbsorvidaPercent * (1 + deltaTUSD)
          const roiAnualPercent = capex > 0 ? ((margem * 12) / capex) * 100 : 0
          celulas.push({ deltaTarifa, deltaGeracao, deltaCapex, deltaTUSD, roiAnualPercent })
        })
      })
    })
  })
  return { celulas }
}

export function buildResultadoCompleto(input: SimulacaoInput): SimulacaoResultado {
  const seriesAno = computeSeriesAno(input)
  const kpisEssenciais = computeKPIsBasicos(input)
  const kpisAvancados = computeKPIsAvancados(input, seriesAno)
  const cenarios = computeCenariosPadrao(input)

  return { input, kpisEssenciais, kpisAvancados, seriesAno, cenarios }
}
