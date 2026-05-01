import { DIAS_MES_PADRAO } from '../../app/config'
import { IRRADIACAO_FALLBACK } from '../../utils/irradiacao'
import { DEFAULT_PERFORMANCE_RATIO, normalizePerformanceRatio } from '../energy/generation'
import {
  PRECO_PLACA_RS,
  MATERIAL_CA_PERCENT_DO_KIT,
  CREA_GO_RS,
  CREA_DF_RS,
  INSTALACAO_GO_POR_MODULO_RS,
  INSTALACAO_DF_POR_MODULO_RS,
} from '../finance/constants'

export type Rede = 'mono' | 'trifasico'

export interface PotenciaSistemaParams {
  consumoKwhMes: number | null | undefined
  irradiacao: number | null | undefined
  performanceRatio: number | null | undefined
  diasMes?: number | null | undefined
  potenciaModuloWp?: number | null | undefined
}

export interface PotenciaSistemaResultado {
  potenciaKwp: number
  quantidadeModulos: number | null
}

export interface ProjectedCostsParams {
  consumoKwhMes: number | null | undefined
  uf?: string | null | undefined
  tarifaCheia?: number | null | undefined
  descontoPercentual?: number | null | undefined
  irradiacao?: number | null | undefined
  performanceRatio?: number | null | undefined
  diasMes?: number | null | undefined
  potenciaModuloWp?: number | null | undefined
  margemLucroPct?: number | null | undefined
  comissaoVendaPct?: number | null | undefined
}

export interface ProjectedCostsResult {
  potenciaKwp: number
  quantidadeModulos: number
  kitBase: number
  kitAtualizado: number
  projeto: number
  materialCA: number
  instalacao: number
  art: number
  placa: number
  custoBaseProjeto: number
  /** CAPEX base do leasing (sem incluir a primeira mensalidade) */
  custoCapexLeasing: number
  /** Custo final leasing = custoCapexLeasing + primeiraMensalidade */
  custoFinalLeasing: number
  custoFinalVenda: number
  comissaoLeasing: number
  primeiraMensalidade: number
  comissaoVenda: number
}

type Anchor = { kwp: number; custoFinal: number; kitValor: number; rede: Rede }

const monoAnchors: Anchor[] = [
  { kwp: 2.7, custoFinal: 7912.83, kitValor: 4138.79, rede: 'mono' },
  { kwp: 4.32, custoFinal: 10063.53, kitValor: 5590.18, rede: 'mono' },
  { kwp: 8.1, custoFinal: 16931.2, kitValor: 9416.0, rede: 'mono' },
  { kwp: 15.66, custoFinal: 30328.53, kitValor: 17647.64, rede: 'mono' },
  { kwp: 23.22, custoFinal: 44822.0, kitValor: 26982.46, rede: 'mono' },
]

const triAnchors: Anchor[] = [
  { kwp: 23.22, custoFinal: 46020.29, kitValor: 27904.22, rede: 'trifasico' },
  { kwp: 38.88, custoFinal: 73320.83, kitValor: 46665.64, rede: 'trifasico' },
]

const MAX_KWP = 90

const KIT_REAJUSTE_MULTIPLIER = 1.185
// Constantes importadas de src/lib/finance/constants.ts para garantir consistência entre engines
const MATERIAL_CA_PERCENT_KIT = MATERIAL_CA_PERCENT_DO_KIT
const INSTALACAO_GO_POR_MODULO = INSTALACAO_GO_POR_MODULO_RS
const INSTALACAO_DF_POR_MODULO = INSTALACAO_DF_POR_MODULO_RS
const ART_GO = CREA_GO_RS
const ART_DF = CREA_DF_RS
const PRECO_PLACA_RS_ESTIMATIVA = PRECO_PLACA_RS
const PROJETO_TABLE: Array<{ max_kwp: number; valor: number }> = [
  { max_kwp: 6, valor: 400 },
  { max_kwp: 10, valor: 500 },
  { max_kwp: 20, valor: 700 },
  { max_kwp: 30, valor: 1000 },
  { max_kwp: 50, valor: 1200 },
  { max_kwp: Infinity, valor: 2500 },
]

const clampPositive = (value: number): number => (value <= 0 ? 1 : value)

export function calcPotenciaSistemaKwp({
  consumoKwhMes,
  irradiacao,
  performanceRatio,
  diasMes,
  potenciaModuloWp,
}: PotenciaSistemaParams): PotenciaSistemaResultado | null {
  const consumo = Number(consumoKwhMes)
  if (!Number.isFinite(consumo) || consumo <= 0) {
    return null
  }

  const irradiacaoSegura =
    Number.isFinite(irradiacao) && Number(irradiacao) > 0 ? Number(irradiacao) : IRRADIACAO_FALLBACK
  const dias = Number.isFinite(diasMes) && Number(diasMes) > 0 ? Number(diasMes) : DIAS_MES_PADRAO
  const prNormalizado = normalizePerformanceRatio(performanceRatio ?? DEFAULT_PERFORMANCE_RATIO)
  const pr = prNormalizado > 0 ? prNormalizado : normalizePerformanceRatio(DEFAULT_PERFORMANCE_RATIO)

  if (irradiacaoSegura <= 0 || pr <= 0 || dias <= 0) {
    return null
  }

  const fatorGeracaoMensal = irradiacaoSegura * pr * dias
  if (!Number.isFinite(fatorGeracaoMensal) || fatorGeracaoMensal <= 0) {
    return null
  }

  const potenciaNecessaria = consumo / fatorGeracaoMensal
  if (!Number.isFinite(potenciaNecessaria) || potenciaNecessaria <= 0) {
    return null
  }

  let quantidadeModulos: number | null = null
  let potenciaKwp = potenciaNecessaria

  const moduloWp = Number(potenciaModuloWp)
  if (Number.isFinite(moduloWp) && moduloWp > 0) {
    const estimativaModulos = Math.ceil((potenciaNecessaria * 1000) / moduloWp)
    if (Number.isFinite(estimativaModulos) && estimativaModulos > 0) {
      quantidadeModulos = estimativaModulos
      potenciaKwp = (quantidadeModulos * moduloWp) / 1000
    }
  }

  return {
    potenciaKwp: Math.round(potenciaKwp * 100) / 100,
    quantidadeModulos,
  }
}

export function getRedeByPotencia(kwp: number): Rede {
  return kwp > triAnchors[0]!.kwp ? 'trifasico' : 'mono'
}

const interpolate = (kwp: number, anchors: Anchor[]): { custoFinal: number; kitValor: number } => {
  if (kwp <= anchors[0]!.kwp) {
    return { custoFinal: anchors[0]!.custoFinal, kitValor: anchors[0]!.kitValor }
  }

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i]!
    const b = anchors[i + 1]!
    if (kwp >= a.kwp && kwp <= b.kwp) {
      const t = (kwp - a.kwp) / (b.kwp - a.kwp)
      const custoFinal = a.custoFinal + t * (b.custoFinal - a.custoFinal)
      const kitValor = a.kitValor + t * (b.kitValor - a.kitValor)
      return { custoFinal, kitValor }
    }
  }

  const last = anchors[anchors.length - 1]!
  const penultimate = anchors[anchors.length - 2]!
  const slopeCusto = (last.custoFinal - penultimate.custoFinal) / (last.kwp - penultimate.kwp)
  const slopeKit = (last.kitValor - penultimate.kitValor) / (last.kwp - penultimate.kwp)
  const custoFinal = last.custoFinal + slopeCusto * (kwp - last.kwp)
  const kitValor = last.kitValor + slopeKit * (kwp - last.kwp)
  return { custoFinal, kitValor }
}

export function calcPricingPorKwp(
  kwp: number,
): { rede: Rede; custoFinal: number; kitValor: number } | null {
  if (!Number.isFinite(kwp) || kwp <= 0 || kwp > MAX_KWP) {
    return null
  }

  const rede = getRedeByPotencia(kwp)
  const anchors = rede === 'mono' ? monoAnchors : triAnchors
  const { custoFinal, kitValor } = interpolate(kwp, anchors)

  return {
    rede,
    custoFinal: clampPositive(custoFinal),
    kitValor: clampPositive(kitValor),
  }
}

export function formatBRL(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0
  return safeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

const resolveProjetoValor = (kwp: number): number => {
  const safeKwp = Number.isFinite(kwp) ? Math.max(0, kwp) : 0
  for (const faixa of PROJETO_TABLE) {
    if (safeKwp <= faixa.max_kwp) {
      return faixa.valor
    }
  }
  return 2500
}

const resolveUf = (value?: string | null): 'GO' | 'DF' | 'OUTROS' => {
  const normalized = (value ?? '').trim().toUpperCase()
  if (normalized === 'GO') return 'GO'
  if (normalized === 'DF') return 'DF'
  return 'OUTROS'
}

export function calcProjectedCostsByConsumption({
  consumoKwhMes,
  uf,
  tarifaCheia,
  descontoPercentual,
  irradiacao,
  performanceRatio,
  diasMes,
  potenciaModuloWp,
  margemLucroPct,
  comissaoVendaPct,
}: ProjectedCostsParams): ProjectedCostsResult | null {
  const potencia = calcPotenciaSistemaKwp({
    consumoKwhMes,
    irradiacao,
    performanceRatio,
    diasMes,
    potenciaModuloWp,
  })

  if (!potencia) return null

  const pricing = calcPricingPorKwp(potencia.potenciaKwp)
  if (!pricing) return null

  const consumo = Number.isFinite(consumoKwhMes) ? Math.max(0, Number(consumoKwhMes)) : 0
  const quantidadeModulos =
    Number.isFinite(potencia.quantidadeModulos) && (potencia.quantidadeModulos ?? 0) > 0
      ? Math.max(1, Math.round(potencia.quantidadeModulos ?? 0))
      : Math.max(1, Math.round((potencia.potenciaKwp * 1000) / 545))

  const ufNormalizada = resolveUf(uf)
  const projeto = resolveProjetoValor(potencia.potenciaKwp)
  const art = ufNormalizada === 'DF' ? ART_DF : ART_GO
  const instalacao = quantidadeModulos * (ufNormalizada === 'DF' ? INSTALACAO_DF_POR_MODULO : INSTALACAO_GO_POR_MODULO)
  const kitBase = pricing.kitValor
  const kitAtualizado = kitBase * KIT_REAJUSTE_MULTIPLIER
  const materialCA = kitAtualizado * MATERIAL_CA_PERCENT_KIT
  const placa = quantidadeModulos * PRECO_PLACA_RS_ESTIMATIVA

  const custoBaseProjeto = kitAtualizado + projeto + materialCA + instalacao + art + placa
  const margem = Number.isFinite(margemLucroPct) ? Math.max(0, Number(margemLucroPct)) : 0.3
  const custoFinalLeasing = custoBaseProjeto * (1 + margem)

  const comissaoVenda = Number.isFinite(comissaoVendaPct)
    ? Math.max(0, Number(comissaoVendaPct))
    : 0.05
  const tarifa = Number.isFinite(tarifaCheia) ? Math.max(0, Number(tarifaCheia)) : 0
  const descontoFrac = Number.isFinite(descontoPercentual)
    ? Math.max(0, Math.min(1, Number(descontoPercentual) / 100))
    : 0
  const tarifaComDesconto = tarifa * (1 - descontoFrac)
  const primeiraMensalidade = consumo * tarifaComDesconto
  const comissaoLeasing = primeiraMensalidade

  const custoFinalLeasingComMensalidade = custoFinalLeasing + primeiraMensalidade
  const comissaoVendaValor = custoFinalLeasingComMensalidade * comissaoVenda
  const custoFinalVenda = custoFinalLeasingComMensalidade + comissaoVendaValor

  return {
    potenciaKwp: potencia.potenciaKwp,
    quantidadeModulos,
    kitBase,
    kitAtualizado,
    projeto,
    materialCA,
    instalacao,
    art,
    placa,
    custoBaseProjeto,
    custoCapexLeasing: custoFinalLeasing,
    custoFinalLeasing: custoFinalLeasingComMensalidade,
    custoFinalVenda,
    comissaoLeasing,
    primeiraMensalidade,
    comissaoVenda: comissaoVendaValor,
  }
}
