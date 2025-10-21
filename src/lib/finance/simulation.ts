import type { TipoSistema } from './roi'
import { calcTusdNaoCompensavel } from './tusd'
import type { TipoClienteTUSD, TUSDSaida, TUSDInput } from './tusd'

export type PerfilConsumo = 'residencial' | 'comercial'

export type Simulacao = {
  id: string
  nome?: string
  createdAt: number
  updatedAt: number
  desconto_pct: number
  capex_solarinvest: number
  anos_contrato: number
  inflacao_energetica_pct: number
  inflacao_ipca_pct: number
  tarifa_cheia_r_kwh_m1: number
  kc_kwh_mes: number
  perfil_consumo: PerfilConsumo
  tusd_pct: number
  seguro_pct: number
  tipo_sistema?: TipoSistema
  obs?: string
  subtrair_tusd_contrato?: boolean
  subtrair_tusd_pos_contrato?: boolean
  tusd_tipo_cliente?: TipoClienteTUSD | null
  tusd_subtipo?: string | null
  tusd_simultaneidade?: number | null
  tusd_tarifa_r_kwh?: number | null
  tusd_ano_referencia?: number | null
}

export type SimulationKPIs = {
  receitaTotal: number
  custosVariaveis: number
  lucroLiquido: number
  roi: number
  paybackMeses: number
  retornoMensalBruto: number
  tusd_nao_comp_r_kwh: number
  custo_tusd_mes_r: number
  kwh_instantaneo: number
  kwh_compensado: number
  simultaneidade_usada: number
  fator_ano_tusd: number
}

const MONTHS_IN_YEAR = 12
const DEFAULT_TUSD_ANO_REFERENCIA = 2025
const SEGURO_REAJUSTE_ANUAL = 0.012
const VALOR_MERCADO_MULTIPLICADOR = 1.29

const clampNumber = (value: number): number => (Number.isFinite(value) ? value : 0)

const monthsFromYears = (anos: number): number => {
  if (!Number.isFinite(anos)) {
    return 0
  }
  return Math.max(0, Math.round(anos * MONTHS_IN_YEAR))
}

export const defaultTUSD = (perfil: PerfilConsumo): number => (perfil === 'comercial' ? 27 : 27)

export const makeSimId = (): string => `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

export const calcValorMercado = (capex: number): number => clampNumber(capex) * VALOR_MERCADO_MULTIPLICADOR

export const calcTarifaComDesconto = (tarifaCheia: number, desconto_pct: number): number => {
  const tarifa = clampNumber(tarifaCheia)
  const descontoFrac = clampNumber(desconto_pct) / 100
  return tarifa * (1 - descontoFrac)
}

export const projectTarifaCheia = (
  tarifaInicial: number,
  inflacaoEnergeticaPct: number,
  mesIndex: number,
): number => {
  const base = clampNumber(tarifaInicial)
  if (mesIndex <= 1) {
    return base
  }
  const inflacao = clampNumber(inflacaoEnergeticaPct)
  const crescimentoMensal = Math.pow(1 + inflacao / 100, 1 / MONTHS_IN_YEAR) - 1
  return base * Math.pow(1 + crescimentoMensal, mesIndex - 1)
}

const resolveTusdTipoCliente = (sim: Simulacao): TipoClienteTUSD => {
  if (sim.tusd_tipo_cliente) {
    return sim.tusd_tipo_cliente
  }

  if (sim.tipo_sistema === 'HIBRIDO') {
    return 'hibrido'
  }

  return sim.perfil_consumo === 'comercial' ? 'comercial' : 'residencial'
}

const resolveTusdSubtipo = (sim: Simulacao): string | null => {
  const raw = typeof sim.tusd_subtipo === 'string' ? sim.tusd_subtipo.trim() : ''
  return raw.length > 0 ? raw : null
}

const resolveTusdOpcional = (value?: number | null): number | null => {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return null
  }
  return Number(value)
}

const resolveTusdAnoBase = (sim: Simulacao): number => {
  const ano = resolveTusdOpcional(sim.tusd_ano_referencia)
  if (typeof ano === 'number' && ano > 0) {
    return Math.trunc(ano)
  }
  return DEFAULT_TUSD_ANO_REFERENCIA
}

const resolveTusdAnoParaMes = (sim: Simulacao, mes: number): number => {
  const indiceMes = Number.isFinite(mes) ? Math.max(1, Math.trunc(mes)) : 1
  const offsetMeses = indiceMes - 1
  const anosAdicionais = Math.floor(offsetMeses / MONTHS_IN_YEAR)
  return resolveTusdAnoBase(sim) + anosAdicionais
}

const makeTusdInput = (sim: Simulacao, mes: number, tarifaCheia: number): TUSDInput => {
  const consumo = clampNumber(sim.kc_kwh_mes)
  const tarifa = clampNumber(tarifaCheia)

  return {
    ano: resolveTusdAnoParaMes(sim, mes),
    tipoCliente: resolveTusdTipoCliente(sim),
    subTipo: resolveTusdSubtipo(sim),
    consumoMensal_kWh: consumo,
    tarifaCheia_R_kWh: tarifa,
    tusd_R_kWh: resolveTusdOpcional(sim.tusd_tarifa_r_kwh),
    pesoTUSD: resolveTusdOpcional(sim.tusd_pct),
    simultaneidadePadrao: resolveTusdOpcional(sim.tusd_simultaneidade),
  }
}

export const calcTusdDetalhesMensal = (
  sim: Simulacao,
  mes: number,
  tarifaCheia: number,
): TUSDSaida => {
  const input = makeTusdInput(sim, mes, tarifaCheia)
  return calcTusdNaoCompensavel(input)
}

export const calcTusdEncargo = (sim: Simulacao, mes: number): TUSDSaida => {
  const tarifaCheia = projectTarifaCheia(sim.tarifa_cheia_r_kwh_m1, sim.inflacao_energetica_pct, mes)
  return calcTusdDetalhesMensal(sim, mes, tarifaCheia)
}

type SimulationContext = {
  mesesContrato: number
  valorMercado: number
  receitaMensal: number[]
  opexMensal: number[]
  economiaLiquidaMensal: number[]
  tusdMensal: number[]
  somaReceita: number
  somaOpex: number
  somaEconomiaLiquida: number
  somaTusd: number
  kc: number
  tarifaInicial: number
  inflacaoEnergeticaPct: number
  subtrairTusdContrato: boolean
  subtrairTusdPosContrato: boolean
}

const computeSimulationContext = (sim: Simulacao): SimulationContext => {
  const mesesContrato = monthsFromYears(sim.anos_contrato)
  const descontoPct = clampNumber(sim.desconto_pct)
  const kc = clampNumber(sim.kc_kwh_mes)
  const tarifaInicial = clampNumber(sim.tarifa_cheia_r_kwh_m1)
  const inflacaoEnergetica = clampNumber(sim.inflacao_energetica_pct)
  const valorMercado = calcValorMercado(clampNumber(sim.capex_solarinvest))
  const seguroPctAnual = clampNumber(sim.seguro_pct)
  const seguroAnualBase = valorMercado * (seguroPctAnual / 100)
  const subtrairTusdContrato = sim.subtrair_tusd_contrato ?? true
  const subtrairTusdPosContrato = sim.subtrair_tusd_pos_contrato ?? true

  const receitaMensal: number[] = []
  const opexMensal: number[] = []
  const economiaLiquidaMensal: number[] = []
  const tusdMensal: number[] = []

  let somaReceita = 0
  let somaOpex = 0
  let somaEconomiaLiquida = 0
  let somaTusd = 0

  for (let mes = 1; mes <= mesesContrato; mes += 1) {
    const tarifaCheia = projectTarifaCheia(tarifaInicial, inflacaoEnergetica, mes)
    const tarifaDesconto = calcTarifaComDesconto(tarifaCheia, descontoPct)
    const tusdDetalhes = calcTusdDetalhesMensal(sim, mes, tarifaCheia)
    const tusdValor = tusdDetalhes.custoTUSD_Mes_R
    const receita = kc * tarifaDesconto
    const anoCorrente = Math.ceil(mes / MONTHS_IN_YEAR)
    const seguroAnualReajustado = seguroAnualBase * Math.pow(1 + SEGURO_REAJUSTE_ANUAL, Math.max(0, anoCorrente - 1))
    const opex = seguroAnualReajustado / MONTHS_IN_YEAR
    const economiaBruta = kc * (tarifaCheia - tarifaDesconto)
    const economiaLiquida = subtrairTusdContrato ? economiaBruta - tusdValor : economiaBruta

    receitaMensal.push(receita)
    opexMensal.push(opex)
    economiaLiquidaMensal.push(economiaLiquida)
    tusdMensal.push(tusdValor)

    somaReceita += receita
    somaOpex += opex
    somaEconomiaLiquida += economiaLiquida
    somaTusd += tusdValor
  }

  return {
    mesesContrato,
    valorMercado,
    receitaMensal,
    opexMensal,
    economiaLiquidaMensal,
    tusdMensal,
    somaReceita,
    somaOpex,
    somaEconomiaLiquida,
    somaTusd,
    kc,
    tarifaInicial,
    inflacaoEnergeticaPct: inflacaoEnergetica,
    subtrairTusdContrato,
    subtrairTusdPosContrato,
  }
}

export const calcEconomiaContrato = (sim: Simulacao): number => {
  const contexto = computeSimulationContext(sim)
  return contexto.somaEconomiaLiquida + contexto.valorMercado + contexto.somaOpex
}

export const calcEconomiaHorizonte = (sim: Simulacao, anos: number): number => {
  const contexto = computeSimulationContext(sim)
  const mesesTotal = monthsFromYears(anos)
  const economiaContratoBase =
    contexto.somaEconomiaLiquida + contexto.valorMercado + contexto.somaOpex
  if (mesesTotal <= contexto.mesesContrato) {
    return economiaContratoBase
  }

  let economiaPosContrato = 0
  for (let mes = contexto.mesesContrato + 1; mes <= mesesTotal; mes += 1) {
    const tarifaCheia = projectTarifaCheia(contexto.tarifaInicial, contexto.inflacaoEnergeticaPct, mes)
    const tusdDetalhes = calcTusdDetalhesMensal(sim, mes, tarifaCheia)
    const tusdValor = tusdDetalhes.custoTUSD_Mes_R
    const economia = contexto.kc * tarifaCheia - (contexto.subtrairTusdPosContrato ? tusdValor : 0)
    economiaPosContrato += economia
  }

  return economiaContratoBase + economiaPosContrato
}

const calcularPayback = (contexto: SimulationContext, capex: number): number => {
  if (capex <= 0) {
    return 0
  }
  let acumulado = 0
  for (let index = 0; index < contexto.mesesContrato; index += 1) {
    const fluxo = contexto.receitaMensal[index] - contexto.opexMensal[index]
    acumulado += fluxo
    if (acumulado >= capex) {
      return index + 1
    }
  }
  return Number.POSITIVE_INFINITY
}

const calcularRetornoMensal = (roi: number, meses: number): number => {
  if (!Number.isFinite(roi) || meses <= 0) {
    return 0
  }
  const base = 1 + roi
  if (base <= 0) {
    return -1
  }
  return Math.pow(base, 1 / meses) - 1
}

export const calcKPIs = (sim: Simulacao): SimulationKPIs => {
  const contexto = computeSimulationContext(sim)
  const capex = clampNumber(sim.capex_solarinvest)
  const receitaTotal = contexto.somaReceita
  const custosVariaveis = contexto.somaOpex
  const lucroLiquido = receitaTotal - capex - custosVariaveis
  const tusdResumoMes1 = calcTusdEncargo(sim, 1)

  let roi: number
  if (capex === 0) {
    if (lucroLiquido > 0) {
      roi = Number.POSITIVE_INFINITY
    } else if (lucroLiquido < 0) {
      roi = Number.NEGATIVE_INFINITY
    } else {
      roi = 0
    }
  } else {
    roi = lucroLiquido / capex
  }

  const paybackMeses = calcularPayback(contexto, capex)
  const retornoMensalBruto = Number.isFinite(roi)
    ? calcularRetornoMensal(roi, Math.max(contexto.mesesContrato, 1))
    : Number.POSITIVE_INFINITY

  return {
    receitaTotal,
    custosVariaveis,
    lucroLiquido,
    roi,
    paybackMeses,
    retornoMensalBruto,
    tusd_nao_comp_r_kwh: tusdResumoMes1.tusdNaoComp_R_kWh,
    custo_tusd_mes_r: tusdResumoMes1.custoTUSD_Mes_R,
    kwh_instantaneo: tusdResumoMes1.kWhInstantaneo,
    kwh_compensado: tusdResumoMes1.kWhCompensado,
    simultaneidade_usada: tusdResumoMes1.simultaneidadeUsada,
    fator_ano_tusd: tusdResumoMes1.fatorAno,
  }
}
