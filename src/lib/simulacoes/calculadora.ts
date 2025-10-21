export type SegmentoCliente = 'residencial' | 'comercial'

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
  segmento: SegmentoCliente
  tusdPercentEnergia: number
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
  valorMercadoUsina: number
  opexTotal: number
  economiaAcumuladaContrato: number
  economia15Anos: number
  economia20Anos: number
  economia30Anos: number
  tusdTotal: number
}

export type SimulationResult = {
  input: SimulationInput
  meses: SimulationMonth[]
  kpi: SimulationKPI
}

type YearMonth = { year: number; month: number }

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

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

const clampPercent = (value: number) => (Number.isFinite(value) ? clamp01(value) : 0)

const computeValorMercadoUsina = (capex: number) => capex * 1.29

const computeEconomiaMensalSemOpex = (
  mesIndex: number,
  input: SimulationInput,
  inicio: YearMonth,
  tusdPercent: number,
) => {
  const { year: ano } = addMonths(inicio, mesIndex - 1)
  const tarifaCheia = computeTarifaCheia(input.tarifaCheiaInicial, input.inflacaoEnergeticaAA, mesIndex)
  const tarifaDesconto = computeTarifaDesconto({
    tarifaCheia,
    desconto: input.desconto,
    ...(input.tarifaComDesconto !== undefined ? { tarifaComDescontoInicial: input.tarifaComDesconto } : {}),
    indexar: input.indexarTarifaComDesconto ?? true,
    inflacaoEnergeticaAA: input.inflacaoEnergeticaAA,
    mesIndex,
  })

  const encargoTUSDporKWh = tarifaCheia * tusdPercent
  const custoTUSDmensal = input.kcKWhMes * encargoTUSDporKWh
  const custoBaseCliente = input.kcKWhMes * tarifaCheia
  const custoCliente = input.kcKWhMes * tarifaDesconto + custoTUSDmensal
  const economiaCliente = custoBaseCliente - custoCliente

  return {
    ano,
    tarifaCheia,
    tarifaDesconto,
    encargoTUSDporKWh,
    custoTUSDmensal,
    economiaCliente,
  }
}

export function runSimulation(input: SimulationInput): SimulationResult {
  const mesesTotais = Math.max(1, Math.round(input.anos * 12))
  const inicio = parseYYYYMM(input.inicioYYYYMM) ?? getCurrentYearMonth()
  const meses: SimulationMonth[] = []
  let acumuladoLiquido = 0
  const tusdPercent = clampPercent(input.tusdPercentEnergia)
  const valorMercadoUsina = computeValorMercadoUsina(input.capex)

  for (let m = 1; m <= mesesTotais; m += 1) {
    const dadosMensais = computeEconomiaMensalSemOpex(m, input, inicio, tusdPercent)
    const { ano, tarifaCheia, tarifaDesconto, encargoTUSDporKWh, custoTUSDmensal, economiaCliente } =
      dadosMensais

    const fatorIPCA = Math.pow(1 + (input.ipcaAA ?? 0), Math.floor((m - 1) / 12))
    const om = (input.omMensal ?? 0) * fatorIPCA
    const seguro = (input.seguroMensal ?? 0) * fatorIPCA

    const receitaBruta = input.kcKWhMes * tarifaDesconto
    const fluxoLiquido = receitaBruta - om - seguro
    acumuladoLiquido += fluxoLiquido

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
  const opexTotal = custosVariaveisTotais
  const lucroLiquido = receitaTotal - input.capex - custosVariaveisTotais
  const roiPercent = input.capex > 0 ? (lucroLiquido / input.capex) * 100 : 0
  const paybackMeses = input.capex > 0 ? findPaybackMeses(meses, input.capex) : null
  const retornoMesBrutoPercent = input.capex > 0 ? (receitaTotal / meses.length / input.capex) * 100 : 0
  const economiaClienteMes1 = meses[0]?.economiaCliente ?? 0
  const economiaClienteAcumulada = sum(meses.map((item) => item.economiaCliente))
  const economiaAcumuladaContrato = economiaClienteAcumulada + valorMercadoUsina + opexTotal

  const computeEconomiaHorizonte = (anos: number) => {
    const horizonteMeses = Math.max(mesesTotais, Math.round(anos * 12))
    if (horizonteMeses <= mesesTotais) {
      return economiaAcumuladaContrato
    }

    let economiaExtra = 0
    for (let m = mesesTotais + 1; m <= horizonteMeses; m += 1) {
      const dadosMensais = computeEconomiaMensalSemOpex(m, input, inicio, tusdPercent)
      economiaExtra += dadosMensais.economiaCliente
    }

    return economiaAcumuladaContrato + economiaExtra
  }

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
      valorMercadoUsina,
      opexTotal,
      economiaAcumuladaContrato,
      economia15Anos: computeEconomiaHorizonte(15),
      economia20Anos: computeEconomiaHorizonte(20),
      economia30Anos: computeEconomiaHorizonte(30),
      tusdTotal,
    },
  }
}

export function runSimulations(inputs: SimulationInput[]): SimulationResult[] {
  return inputs.map((input) => runSimulation(input))
}

