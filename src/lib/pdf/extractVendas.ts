import { estimateMonthlyGenerationKWh } from '../energy/generation'

export type GeracaoSource = 'extracted' | 'calculated'

export interface ParsedVendaPdfData {
  capex_total: number | null
  potencia_instalada_kwp: number | null
  geracao_estimada_kwh_mes: number | null
  quantidade_modulos: number | null
  potencia_da_placa_wp: number | null
  modelo_modulo: string | null
  modelo_inversor: string | null
  estrutura_fixacao: string | null
  tipo_instalacao: string | null
  tarifa_cheia_r_kwh: number | null
  consumo_kwh_mes: number | null
  geracao_estimada_source: GeracaoSource | null
  module_area_m2?: number | null
}

const RE_CAPEX = /Investimento total\s*\(?(?:CAPEX)?\)?\s*R?\$?\s*([\d.,]+)/i
const RE_POTENCIA_SISTEMA = /Pot[êe]ncia\s+do\s+sistema\s*([\d.,]+)\s*kwp/i
const RE_GERACAO_KWH_MES = /Gera[çc][aã]o\s+estimada.*?\(?\s*kwh\/m[eê]s\s*\)?\s*([\d.,]+)/i
const RE_QTD_MODULOS = /Quantidade\s+de\s+m[oó]dulos\s*([\d.,]+)\s*(?:un|unid|unidade)?/i
const RE_POT_MODULO_WP = /Pot[êe]ncia\s+da\s+placa\s*\(?\s*wp\s*\)?\s*([\d.,]+)/i
const RE_MODELO_MODULO = /Modelo\s+dos\s+m[oó]dulos\s*(.+)/i
const RE_MODELO_INV = /Modelo\s+dos\s+inversores\s*(.+)/i
const RE_ESTRUTURA_FIXACAO = /Estrutura\s+de\s+fixa[çc][aã]o\s*(.+)/i
const RE_ESTRUTURA_UTILIZADA = /Estrutura\s+utilizada[\s\S]*?\n([^\n]{3,})/i
const RE_TIPO_INST = /Tipo\s+de\s+instala[çc][aã]o\s*(.+)/i
const RE_TARIFA = /Tarifa\s+cheia.*?R?\$?\s*([\d.,]+)/i

function brToFloat(input: string | undefined | null): number | null {
  if (!input) {
    return null
  }
  const sanitized = input.replace(/\u00a0/g, '').replace(/\s+/g, '')
  const normalized = sanitized.replace(/\./g, '').replace(',', '.')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) {
    return null
  }
  const value = Number.parseFloat(match[0])
  return Number.isFinite(value) ? value : null
}

function onlyDigits(input: string | undefined | null): number | null {
  if (!input) {
    return null
  }
  const match = input.match(/\d+/)
  if (!match) {
    return null
  }
  const value = Number.parseInt(match[0], 10)
  return Number.isFinite(value) ? value : null
}

function cleanString(value: string | undefined | null): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed || trimmed === '—' || trimmed === '--') {
    return null
  }
  return trimmed
}

function sanitizePositive(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value > 0 ? value : null
}

function sanitizePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

export function finalizeParsedVendaData(
  input: Partial<ParsedVendaPdfData> & { geracao_estimada_source?: GeracaoSource | null },
): ParsedVendaPdfData {
  const result: ParsedVendaPdfData = {
    capex_total: sanitizePositive(input.capex_total ?? null),
    potencia_instalada_kwp: sanitizePositive(input.potencia_instalada_kwp ?? null),
    geracao_estimada_kwh_mes: sanitizePositive(input.geracao_estimada_kwh_mes ?? null),
    quantidade_modulos: sanitizePositiveInteger(input.quantidade_modulos ?? null),
    potencia_da_placa_wp: sanitizePositive(input.potencia_da_placa_wp ?? null),
    modelo_modulo: cleanString(input.modelo_modulo ?? null),
    modelo_inversor: cleanString(input.modelo_inversor ?? null),
    estrutura_fixacao: cleanString(input.estrutura_fixacao ?? null),
    tipo_instalacao: cleanString(input.tipo_instalacao ?? null),
    tarifa_cheia_r_kwh: sanitizePositive(input.tarifa_cheia_r_kwh ?? null),
    consumo_kwh_mes: null,
    geracao_estimada_source: input.geracao_estimada_source ?? null,
  }

  if (
    result.potencia_instalada_kwp == null &&
    result.quantidade_modulos != null &&
    result.potencia_da_placa_wp != null
  ) {
    const potencia = (result.quantidade_modulos * result.potencia_da_placa_wp) / 1000
    if (Number.isFinite(potencia) && potencia > 0) {
      result.potencia_instalada_kwp = potencia
    }
  }

  let geracao = result.geracao_estimada_kwh_mes
  let geracaoSource: GeracaoSource | null = result.geracao_estimada_source ?? null

  if (geracao == null && result.potencia_instalada_kwp != null) {
    const estimada = estimateMonthlyGenerationKWh({ potencia_instalada_kwp: result.potencia_instalada_kwp })
    if (estimada > 0) {
      geracao = estimada
      geracaoSource = geracaoSource === 'extracted' ? 'extracted' : 'calculated'
    }
  }

  if (geracao != null && geracao > 0) {
    result.geracao_estimada_kwh_mes = geracao
    result.consumo_kwh_mes = geracao
    result.geracao_estimada_source = geracaoSource ?? 'extracted'
  } else {
    result.geracao_estimada_kwh_mes = null
    result.consumo_kwh_mes = null
    result.geracao_estimada_source = null
  }

  return result
}

export function parseVendaPdfText(text: string): ParsedVendaPdfData {
  if (!text || typeof text !== 'string') {
    return finalizeParsedVendaData({})
  }

  const capex_total = brToFloat(text.match(RE_CAPEX)?.[1])
  const potencia_instalada_kwp = brToFloat(text.match(RE_POTENCIA_SISTEMA)?.[1])
  const geracao_extr = brToFloat(text.match(RE_GERACAO_KWH_MES)?.[1])
  const quantidade_modulos = onlyDigits(text.match(RE_QTD_MODULOS)?.[1])
  let potencia_da_placa_wp = brToFloat(text.match(RE_POT_MODULO_WP)?.[1])
  if (potencia_da_placa_wp == null) {
    const fallbackMatch = text.match(/m[óo]dulo[^\n]*?(\d{3,4})\s*(?:wp|w)\b/i)
    if (fallbackMatch) {
      const numeric = fallbackMatch[1].replace(/\D+/g, '')
      if (numeric) {
        const parsed = Number.parseInt(numeric, 10)
        if (Number.isFinite(parsed) && parsed > 0) {
          potencia_da_placa_wp = parsed
        }
      }
    }
  }
  const modelo_modulo = cleanString(text.match(RE_MODELO_MODULO)?.[1])
  const modelo_inversor = cleanString(text.match(RE_MODELO_INV)?.[1])
  let estrutura_fixacao = cleanString(text.match(RE_ESTRUTURA_FIXACAO)?.[1])
  if (!estrutura_fixacao) {
    const estruturaUtilizadaMatch = text.match(RE_ESTRUTURA_UTILIZADA)
    if (estruturaUtilizadaMatch) {
      estrutura_fixacao = cleanString(estruturaUtilizadaMatch[1])
    }
  }
  const tipo_instalacao = cleanString(text.match(RE_TIPO_INST)?.[1])
  const tarifa_cheia_r_kwh = brToFloat(text.match(RE_TARIFA)?.[1])

  return finalizeParsedVendaData({
    capex_total,
    potencia_instalada_kwp,
    geracao_estimada_kwh_mes: geracao_extr,
    quantidade_modulos,
    potencia_da_placa_wp,
    modelo_modulo,
    modelo_inversor,
    estrutura_fixacao,
    tipo_instalacao,
    tarifa_cheia_r_kwh,
    geracao_estimada_source: geracao_extr != null ? 'extracted' : null,
  })
}

export function mergeParsedVendaPdfData(
  ...sources: (Partial<ParsedVendaPdfData> & { geracao_estimada_source?: GeracaoSource | null })[]
): ParsedVendaPdfData {
  const accumulator: Partial<ParsedVendaPdfData> & { geracao_estimada_source?: GeracaoSource | null } = {}
  let sourcePriority: GeracaoSource | null = null

  sources.forEach((source) => {
    if (!source) {
      return
    }
    const entries = Object.entries(source) as [keyof ParsedVendaPdfData | 'geracao_estimada_source', unknown][]
    entries.forEach(([key, value]) => {
      if (value == null) {
        return
      }
      if (key === 'geracao_estimada_source') {
        const typed = value as GeracaoSource
        if (typed === 'extracted') {
          sourcePriority = 'extracted'
        } else if (typed === 'calculated' && sourcePriority == null) {
          sourcePriority = 'calculated'
        }
        return
      }
      const current = accumulator[key as keyof ParsedVendaPdfData]
      if (current == null) {
        accumulator[key as keyof ParsedVendaPdfData] = value as never
      }
    })
  })

  if (sourcePriority) {
    accumulator.geracao_estimada_source = sourcePriority
  }

  return finalizeParsedVendaData(accumulator)
}
