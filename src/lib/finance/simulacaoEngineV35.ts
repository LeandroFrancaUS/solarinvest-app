import type { DadosTUSD, TarifaAtual, TarifaHistorica } from '../aneel/aneelClient'

export type SimulacaoInput = {
  capex: number
  opexMensal: number
  consumoMensalKwh: number
  energiaVendidaKwhMensal: number
  tarifaInicial: number
  distribuidoraId: string
  anosAnalise: number
  tusdAbsorvidaPercent: number
  taxaDesconto: number
  dadosAneel?: {
    tarifaAtual?: TarifaAtual
    historico?: TarifaHistorica[]
    tusd?: DadosTUSD
  }
  metadata?: {
    planoId?: string
    nome?: string
    tipoSistema?: string
  }
}

export type SimulacaoKpisBasicos = {
  capex: number
  opexAnual: number
  receitaAnualBase: number
  lucroAnualBase: number
  paybackAnos: number | null
}

export type SimulacaoKpisAvancados = {
  roi: number
  vpl: number
  tir: number
  payback: number | null
  margemMedia: number
  lcoeMedio: number
}

export type SimulacaoResultadoCenario = {
  nome: string
  roi: number
  payback: number | null
  receitaTotal: number
  lucroTotal: number
  tarifaSeries: number[]
  tusdSeries: number[]
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
  deltaTarifa?: number[]
  deltaGeracao?: number[]
  deltaCapex?: number[]
  deltaTUSD?: number[]
}

export type SensibilidadeCelula = {
  deltaTarifa: number
  deltaGeracao: number
  deltaCapex: number
  deltaTUSD: number
  roi: number
}

export type SimulacaoSensibilidadeResultado = {
  celulas: SensibilidadeCelula[]
}

export type SerieAnual = {
  ano: number
  receitaBruta: number
  opex: number
  tusdAbsorvida: number
  lucroLiquido: number
  tarifaProjetada: number
  lcoe: number
}

export type SimulacaoResultado = {
  input: SimulacaoInput
  kpisEssenciais: SimulacaoKpisBasicos
  kpisAvancados: SimulacaoKpisAvancados
  seriesAno: SerieAnual[]
  cenarios: {
    base: SimulacaoResultadoCenario
    otimista: SimulacaoResultadoCenario
    pessimista: SimulacaoResultadoCenario
  }
  riscoMonteCarlo?: SimulacaoMonteCarloResultado
  sensibilidade?: SimulacaoSensibilidadeResultado
}

const DEFAULT_TARIFA_GROWTH = 0.08
const DEFAULT_TUSD_GROWTH = 0.05
const DEFAULT_MONTE_CARLO_N = 400

const clampPositive = (value: number) => Math.max(0, value)

const resolveTarifaInicial = (input: SimulacaoInput) =>
  input.dadosAneel?.tarifaAtual?.tarifaConvencional ?? input.tarifaInicial

const resolveTusdAtual = (input: SimulacaoInput) => input.dadosAneel?.tarifaAtual?.tusd ?? input.dadosAneel?.tusd?.atual ?? 0

const calcCrescimentoHistorico = (historico?: TarifaHistorica[]): number => {
  if (!historico || historico.length < 2) {
    return DEFAULT_TARIFA_GROWTH
  }

  const ordenado = [...historico].sort((a, b) => a.ano - b.ano || a.mes - b.mes)
  const primeiro = ordenado[0]
  const ultimo = ordenado[ordenado.length - 1]
  if (!primeiro?.tarifa || !ultimo?.tarifa) {
    return DEFAULT_TARIFA_GROWTH
  }

  const deltaAnos = Math.max(1 / 12, (ultimo.ano + ultimo.mes / 12) - (primeiro.ano + primeiro.mes / 12))
  if (deltaAnos <= 0) {
    return DEFAULT_TARIFA_GROWTH
  }

  const taxa = Math.pow(ultimo.tarifa / primeiro.tarifa, 1 / deltaAnos) - 1
  if (!Number.isFinite(taxa) || taxa <= 0) {
    return DEFAULT_TARIFA_GROWTH
  }

  return Math.min(taxa, 0.25)
}

export const projetarTarifaAneel = (input: SimulacaoInput): number[] => {
  const crescimento = calcCrescimentoHistorico(input.dadosAneel?.historico)
  const anos = Math.max(1, input.anosAnalise)
  const base = resolveTarifaInicial(input)

  const series: number[] = []
  for (let ano = 0; ano < anos; ano += 1) {
    const fator = Math.pow(1 + crescimento, ano)
    const valor = clampPositive(base * fator)
    series.push(valor)
  }
  return series
}

export const projetarTUSDAneel = (input: SimulacaoInput): number[] => {
  const anos = Math.max(1, input.anosAnalise)
  const crescimento = input.dadosAneel?.tusd?.tendenciaAnual ?? DEFAULT_TUSD_GROWTH
  const base = resolveTusdAtual(input)
  const series: number[] = []
  for (let ano = 0; ano < anos; ano += 1) {
    const fator = Math.pow(1 + crescimento, ano)
    const valor = clampPositive(base * fator)
    series.push(valor)
  }
  return series
}

const energiaMensal = (input: SimulacaoInput) =>
  clampPositive(input.consumoMensalKwh + input.energiaVendidaKwhMensal)

const buildSeries = (
  input: SimulacaoInput,
  overrides?: {
    tarifaSeries?: number[]
    tusdSeries?: number[]
    energiaFactor?: number
  },
): SerieAnual[] => {
  const tarifaSeries = overrides?.tarifaSeries ?? projetarTarifaAneel(input)
  const tusdSeries = overrides?.tusdSeries ?? projetarTUSDAneel(input)
  const energia = energiaMensal(input) * (overrides?.energiaFactor ?? 1)
  const energiaAnual = energia * 12
  const opexAnual = input.opexMensal * 12
  const capexRateado = input.capex / Math.max(1, input.anosAnalise)

  return tarifaSeries.map((tarifa, index) => {
    const tusd = tusdSeries[index] ?? tusdSeries[tusdSeries.length - 1] ?? 0
    const receitaBruta = energiaAnual * tarifa
    const tusdAbsorvida = energiaAnual * tusd * clampPositive(input.tusdAbsorvidaPercent)
    const lucroLiquido = receitaBruta - opexAnual - tusdAbsorvida
    const lcoe = (capexRateado + opexAnual) / Math.max(1, energiaAnual)

    return {
      ano: index + 1,
      receitaBruta,
      opex: opexAnual,
      tusdAbsorvida,
      lucroLiquido,
      tarifaProjetada: tarifa,
      lcoe,
    }
  })
}

export const computeKPIsBasicos = (input: SimulacaoInput): SimulacaoKpisBasicos => {
  const series = buildSeries(input)
  const primeiroAno = series[0]
  const payback = resolvePayback(series, input.capex)

  return {
    capex: input.capex,
    opexAnual: input.opexMensal * 12,
    receitaAnualBase: primeiroAno?.receitaBruta ?? 0,
    lucroAnualBase: primeiroAno?.lucroLiquido ?? 0,
    paybackAnos: payback,
  }
}

const resolvePayback = (series: SerieAnual[], capex: number): number | null => {
  let acumulado = -capex
  for (const item of series) {
    acumulado += item.lucroLiquido
    if (acumulado >= 0) {
      const indice = item.ano
      const excedente = acumulado - item.lucroLiquido
      const delta = item.lucroLiquido === 0 ? 0 : (capex + excedente) / item.lucroLiquido
      return Math.max(0, indice - 1 + delta)
    }
  }
  return null
}

const calcNPV = (input: SimulacaoInput, series: SerieAnual[]) => {
  const taxa = input.taxaDesconto || 0.1
  let npv = -input.capex
  series.forEach((item, index) => {
    const fator = Math.pow(1 + taxa, index + 1)
    npv += item.lucroLiquido / fator
  })
  return npv
}

const calcTIR = (series: SerieAnual[], capex: number): number => {
  const guessRates = [0.05, 0.1, 0.15, 0.2, 0.3]
  const cashflows = [-capex, ...series.map((item) => item.lucroLiquido)]
  const irr = (rate: number) =>
    cashflows.reduce((acc, cf, index) => acc + cf / Math.pow(1 + rate, index), 0)

  let melhor = 0
  let melhorValor = Number.NEGATIVE_INFINITY

  guessRates.forEach((rate) => {
    const valor = irr(rate)
    if (valor > melhorValor) {
      melhor = rate
      melhorValor = valor
    }
  })

  return melhor
}

export const computeKPIsAvancados = (
  input: SimulacaoInput,
  seriesAno: SerieAnual[],
): SimulacaoKpisAvancados => {
  const receitaTotal = seriesAno.reduce((acc, item) => acc + item.receitaBruta, 0)
  const lucroTotal = seriesAno.reduce((acc, item) => acc + item.lucroLiquido, 0)
  const roi = input.capex === 0 ? 0 : (lucroTotal - input.capex) / input.capex
  const payback = resolvePayback(seriesAno, input.capex)
  const vpl = calcNPV(input, seriesAno)
  const tir = calcTIR(seriesAno, input.capex)
  const margemMedia = receitaTotal === 0 ? 0 : lucroTotal / receitaTotal
  const lcoeMedio = seriesAno.reduce((acc, item) => acc + item.lcoe, 0) / Math.max(1, seriesAno.length)

  return {
    roi,
    vpl,
    tir,
    payback,
    margemMedia,
    lcoeMedio,
  }
}

const buildCenario = (
  input: SimulacaoInput,
  label: string,
  ajustes: { tarifa?: number; tusd?: number; energia?: number; capex?: number },
): SimulacaoResultadoCenario => {
  const tarifaSeries = projetarTarifaAneel(input).map((valor) => valor * (ajustes.tarifa ?? 1))
  const tusdSeries = projetarTUSDAneel(input).map((valor) => valor * (ajustes.tusd ?? 1))
  const inputCenario: SimulacaoInput = { ...input, capex: ajustes.capex ?? input.capex }
  const series = buildSeries(inputCenario, {
    tarifaSeries,
    tusdSeries,
    energiaFactor: ajustes.energia,
  })
  const kpis = computeKPIsAvancados(inputCenario, series)
  return {
    nome: label,
    roi: kpis.roi,
    payback: kpis.payback,
    receitaTotal: series.reduce((acc, item) => acc + item.receitaBruta, 0),
    lucroTotal: series.reduce((acc, item) => acc + item.lucroLiquido, 0),
    tarifaSeries,
    tusdSeries,
  }
}

export const computeCenariosPadrao = (
  input: SimulacaoInput,
): { base: SimulacaoResultadoCenario; otimista: SimulacaoResultadoCenario; pessimista: SimulacaoResultadoCenario } => ({
  base: buildCenario(input, 'Base', {}),
  otimista: buildCenario(input, 'Otimista', { tarifa: 1.08, tusd: 0.95, energia: 1.05 }),
  pessimista: buildCenario(input, 'Pessimista', { tarifa: 0.92, tusd: 1.1, energia: 0.95, capex: input.capex * 1.05 }),
})

const hashString = (value: string): number => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    const chr = value.charCodeAt(index)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return Math.abs(hash)
}

const mulberry32 = (seed: number) => {
  let t = seed + 0x6d2b79f5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const runMonteCarlo = (
  input: SimulacaoInput,
  nSimulacoes: number = DEFAULT_MONTE_CARLO_N,
): SimulacaoMonteCarloResultado => {
  const baseSeries = buildSeries(input)
  const seed = hashString(JSON.stringify(input))
  const random = mulberry32(seed)
  const roiSamples: number[] = []
  const lucroSamples: number[] = []

  for (let i = 0; i < nSimulacoes; i += 1) {
    const fatorTarifa = 1 + (random() * 0.2 - 0.1)
    const fatorGeracao = 1 + (random() * 0.14 - 0.07)
    const fatorTUSD = 1 + (random() * 0.16 - 0.08)
    const fatorOpex = 1 + (random() * 0.12 - 0.06)

    const tarifaSeries = baseSeries.map((item) => item.tarifaProjetada * fatorTarifa)
    const tusdSeries = projetarTUSDAneel(input).map((valor) => valor * fatorTUSD)
    const series = buildSeries(
      { ...input, opexMensal: input.opexMensal * fatorOpex },
      { tarifaSeries, tusdSeries, energiaFactor: fatorGeracao },
    )

    const kpis = computeKPIsAvancados(input, series)
    const lucroTotal = series.reduce((acc, item) => acc + item.lucroLiquido, 0)
    roiSamples.push(kpis.roi)
    lucroSamples.push(lucroTotal)
  }

  const estatisticas = buildEstatisticasMonteCarlo(roiSamples, lucroSamples)
  return {
    n: nSimulacoes,
    roiSamples,
    lucroSamples,
    estatisticas,
  }
}

const percentile = (samples: number[], p: number) => {
  if (samples.length === 0) {
    return 0
  }
  const ordenado = [...samples].sort((a, b) => a - b)
  const index = Math.min(ordenado.length - 1, Math.max(0, Math.round(p * (ordenado.length - 1))))
  return ordenado[index]
}

const buildEstatisticasMonteCarlo = (roiSamples: number[], lucroSamples: number[]) => {
  const roiMedio = roiSamples.reduce((acc, value) => acc + value, 0) / Math.max(1, roiSamples.length)
  const lucroMedio = lucroSamples.reduce((acc, value) => acc + value, 0) / Math.max(1, lucroSamples.length)
  const roiP5 = percentile(roiSamples, 0.05)
  const roiP50 = percentile(roiSamples, 0.5)
  const roiP95 = percentile(roiSamples, 0.95)
  const probRoiNegativo = roiSamples.length
    ? roiSamples.filter((value) => value < 0).length / roiSamples.length
    : 0
  const probPrejuizo = lucroSamples.length
    ? lucroSamples.filter((value) => value < 0).length / lucroSamples.length
    : 0
  const media = roiMedio
  const desvioPadraoRoi = Math.sqrt(
    roiSamples.reduce((acc, value) => acc + (value - media) ** 2, 0) /
      Math.max(1, roiSamples.length),
  )

  return {
    roiMedio,
    roiP5,
    roiP50,
    roiP95,
    probRoiNegativo,
    lucroMedio,
    probPrejuizo,
    desvioPadraoRoi,
  }
}

const defaultSensibilidadeParametros: Required<SensibilidadeParametros> = {
  deltaTarifa: [0, 0.05, 0.1, 0.15],
  deltaGeracao: [-0.1, -0.05, 0.05, 0.1],
  deltaCapex: [-0.2, -0.1, 0.1, 0.2],
  deltaTUSD: [0, 0.25, 0.5, 1],
}

export const computeSensibilidade = (
  input: SimulacaoInput,
  parametros: SensibilidadeParametros = {},
): SimulacaoSensibilidadeResultado => {
  const cfg = { ...defaultSensibilidadeParametros, ...parametros }
  const celulas: SensibilidadeCelula[] = []

  cfg.deltaTarifa.forEach((deltaTarifa) => {
    cfg.deltaGeracao.forEach((deltaGeracao) => {
      cfg.deltaCapex.forEach((deltaCapex) => {
        cfg.deltaTUSD.forEach((deltaTUSD) => {
          const tarifaSeries = projetarTarifaAneel(input).map((valor) => valor * (1 + deltaTarifa))
          const tusdSeries = projetarTUSDAneel(input).map((valor) => valor * (1 + deltaTUSD))
          const series = buildSeries(
            { ...input, capex: input.capex * (1 + deltaCapex) },
            { tarifaSeries, tusdSeries, energiaFactor: 1 + deltaGeracao },
          )
          const kpis = computeKPIsAvancados(input, series)
          celulas.push({
            deltaTarifa,
            deltaGeracao,
            deltaCapex,
            deltaTUSD,
            roi: kpis.roi,
          })
        })
      })
    })
  })

  return { celulas }
}

export const executarSimulacaoV35 = (
  input: SimulacaoInput,
  options?: { incluirRisco?: boolean; incluirSensibilidade?: boolean; nMonteCarlo?: number },
): SimulacaoResultado => {
  const seriesAno = buildSeries(input)
  const kpisEssenciais = computeKPIsBasicos(input)
  const kpisAvancados = computeKPIsAvancados(input, seriesAno)
  const cenarios = computeCenariosPadrao(input)

  const resultado: SimulacaoResultado = {
    input,
    kpisEssenciais,
    kpisAvancados,
    seriesAno,
    cenarios,
  }

  if (options?.incluirRisco) {
    resultado.riscoMonteCarlo = runMonteCarlo(input, options.nMonteCarlo)
  }

  if (options?.incluirSensibilidade) {
    resultado.sensibilidade = computeSensibilidade(input)
  }

  return resultado
}
