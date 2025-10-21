export type SimulationInput = {
  id: string
  label?: string
  desconto: number
  capex: number
  anos: number
  inflacaoEnergeticaAA: number
  ipcaAA: number
  tarifaCheiaInicial: number
  tarifaComDesconto?: number
  indexarTarifaComDesconto?: boolean
  kcKWhMes: number
  omMensal?: number
  seguroMensal?: number
  inicioYYYYMM?: string
}

export type SimulationMonth = {
  mesIndex: number
  ano: number
  tarifaCheia: number
  tarifaDesconto: number
  encargoTUSDporKWh: number
  custoTUSDmensal: number
  receitaBruta: number
  om: number
  seguro: number
  fluxoLiquido: number
  economiaCliente: number
  acumuladoLiquido: number
}

export type SimulationKPI = {
  receitaTotal: number
  custosVariaveisTotais: number
  lucroLiquido: number
  roiPercent: number
  paybackMeses: number | null
  retornoMesBrutoPercent: number
  economiaClienteMes1: number
  economiaClienteAcumulada: number
  tusdTotal: number
}

export type SimulationResult = {
  input: SimulationInput
  meses: SimulationMonth[]
  kpi: SimulationKPI
}

export type TusdConfig = {
  baseFactor: number
  percentByYear: Record<number, number>
  /** Percentual utilizado para anos anteriores ao primeiro configurado. */
  fallbackPercent?: number
  /** Percentual utilizado para anos posteriores ao último configurado. */
  defaultPercent?: number
}

export const DEFAULT_TUSD_CONFIG: TusdConfig = {
  baseFactor: 0.27,
  percentByYear: {
    2025: 0.45,
    2026: 0.6,
    2027: 0.75,
    2028: 0.9,
    2029: 1,
  },
  fallbackPercent: 0,
  defaultPercent: 1,
}

type YearMonth = { year: number; month: number }

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

export function percentualTUSD(ano: number, config: TusdConfig = DEFAULT_TUSD_CONFIG): number {
  const explicit = config.percentByYear[ano]
  if (typeof explicit === 'number') {
    return clamp01(explicit)
  }

  const years = Object.keys(config.percentByYear)
    .map((y) => Number.parseInt(y, 10))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b)

  if (years.length === 0) {
    return clamp01(config.defaultPercent ?? 0)
  }

  const minYear = years[0]
  const maxYear = years[years.length - 1]

  if (ano < minYear) {
    return clamp01(config.fallbackPercent ?? 0)
  }

  if (ano > maxYear) {
    return clamp01(config.defaultPercent ?? config.percentByYear[maxYear] ?? 1)
  }

  const closest = years.reduce((closestYear, current) => {
    if (current <= ano) {
      return current
    }
    return closestYear
  }, years[0])

  const percent = config.percentByYear[closest]
  return clamp01(typeof percent === 'number' ? percent : config.defaultPercent ?? 1)
}

export function parseYYYYMM(value?: string | null): YearMonth | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed)
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }
  return { year, month }
}

export function formatYYYYMM({ year, month }: YearMonth): string {
  const safeMonth = Math.min(Math.max(month, 1), 12)
  return `${year}-${String(safeMonth).padStart(2, '0')}`
}

export function getCurrentYearMonth(): YearMonth {
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

export function addMonths(base: YearMonth, monthsToAdd: number): YearMonth {
  const totalMonths = base.year * 12 + (base.month - 1) + monthsToAdd
  const year = Math.floor(totalMonths / 12)
  const month = (totalMonths % 12) + 1
  return { year, month }
}

export function computeTarifaCheia(
  tarifaInicial: number,
  inflacaoEnergeticaAA: number,
  mesIndex: number,
): number {
  if (mesIndex <= 1) return tarifaInicial
  const steps = Math.floor((mesIndex - 1) / 12)
  if (!Number.isFinite(steps) || steps <= 0) return tarifaInicial
  return tarifaInicial * Math.pow(1 + inflacaoEnergeticaAA, steps)
}

type TarifaDescontoOptions = {
  tarifaCheia: number
  desconto: number
  tarifaComDescontoInicial?: number
  indexar: boolean
  inflacaoEnergeticaAA: number
  mesIndex: number
}

export function computeTarifaDesconto({
  tarifaCheia,
  desconto,
  tarifaComDescontoInicial,
  indexar,
  inflacaoEnergeticaAA,
  mesIndex,
}: TarifaDescontoOptions): number {
  if (!Number.isFinite(tarifaComDescontoInicial)) {
    return tarifaCheia * (1 - desconto)
  }

  if (!indexar || mesIndex <= 1) {
    return tarifaComDescontoInicial as number
  }

  const steps = Math.floor((mesIndex - 1) / 12)
  if (!Number.isFinite(steps) || steps <= 0) {
    return tarifaComDescontoInicial as number
  }

  return (tarifaComDescontoInicial as number) * Math.pow(1 + inflacaoEnergeticaAA, steps)
}

function findPaybackMeses(meses: SimulationMonth[], capex: number): number | null {
  let acumulado = 0
  for (const mes of meses) {
    acumulado += mes.fluxoLiquido
    if (acumulado >= capex) {
      return mes.mesIndex
    }
  }
  return null
}

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0)

export function runSimulation(
  input: SimulationInput,
  tusdConfig: TusdConfig = DEFAULT_TUSD_CONFIG,
): SimulationResult {
  const mesesTotais = Math.max(1, Math.round(input.anos * 12))
  const inicio = parseYYYYMM(input.inicioYYYYMM) ?? getCurrentYearMonth()
  const meses: SimulationMonth[] = []
  let acumuladoLiquido = 0

  for (let m = 1; m <= mesesTotais; m += 1) {
    const { year: ano } = addMonths(inicio, m - 1)
    const tarifaCheia = computeTarifaCheia(input.tarifaCheiaInicial, input.inflacaoEnergeticaAA, m)
    const tarifaDesconto = computeTarifaDesconto({
      tarifaCheia,
      desconto: input.desconto,
      ...(input.tarifaComDesconto !== undefined
        ? { tarifaComDescontoInicial: input.tarifaComDesconto }
        : {}),
      indexar: input.indexarTarifaComDesconto ?? true,
      inflacaoEnergeticaAA: input.inflacaoEnergeticaAA,
      mesIndex: m,
    })

    const percentual = percentualTUSD(ano, tusdConfig)
    const encargoTUSDporKWh = tarifaCheia * tusdConfig.baseFactor * percentual
    const custoTUSDmensal = input.kcKWhMes * encargoTUSDporKWh

    const fatorIPCA = Math.pow(1 + (input.ipcaAA ?? 0), Math.floor((m - 1) / 12))
    const om = (input.omMensal ?? 0) * fatorIPCA
    const seguro = (input.seguroMensal ?? 0) * fatorIPCA

    const receitaBruta = input.kcKWhMes * tarifaDesconto
    const fluxoLiquido = receitaBruta - om - seguro
    acumuladoLiquido += fluxoLiquido

    const custoBaseCliente = input.kcKWhMes * tarifaCheia
    const custoCliente = input.kcKWhMes * tarifaDesconto + custoTUSDmensal
    const economiaCliente = custoBaseCliente - custoCliente

    meses.push({
      mesIndex: m,
      ano,
      tarifaCheia,
      tarifaDesconto,
      encargoTUSDporKWh,
      custoTUSDmensal,
      receitaBruta,
      om,
      seguro,
      fluxoLiquido,
      economiaCliente,
      acumuladoLiquido,
    })
  }

  const receitaTotal = sum(meses.map((item) => item.receitaBruta))
  const custosVariaveisTotais = sum(meses.map((item) => item.om + item.seguro))
  const tusdTotal = sum(meses.map((item) => item.custoTUSDmensal))
  const lucroLiquido = receitaTotal - input.capex - custosVariaveisTotais
  const roiPercent = input.capex > 0 ? (lucroLiquido / input.capex) * 100 : 0
  const paybackMeses = input.capex > 0 ? findPaybackMeses(meses, input.capex) : null
  const retornoMesBrutoPercent = input.capex > 0 ? (receitaTotal / meses.length / input.capex) * 100 : 0
  const economiaClienteMes1 = meses[0]?.economiaCliente ?? 0
  const economiaClienteAcumulada = sum(meses.map((item) => item.economiaCliente))

  return {
    input,
    meses,
    kpi: {
      receitaTotal,
      custosVariaveisTotais,
      lucroLiquido,
      roiPercent,
      paybackMeses,
      retornoMesBrutoPercent,
      economiaClienteMes1,
      economiaClienteAcumulada,
      tusdTotal,
    },
  }
}

export function runSimulations(
  inputs: SimulationInput[],
  tusdConfig: TusdConfig = DEFAULT_TUSD_CONFIG,
): SimulationResult[] {
  return inputs.map((input) => runSimulation(input, tusdConfig))
}

