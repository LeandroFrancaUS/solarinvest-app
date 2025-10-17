import { estimateMonthlyGenerationKWh } from '../energy/generation'
import { toNumberFlexible } from '../locale/br-number'

const runtimeEnv = (() => {
  if (typeof import.meta !== 'undefined') {
    const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    if (meta) {
      return meta
    }
  }
  if (typeof globalThis !== 'undefined') {
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    if (processEnv) {
      return processEnv
    }
  }
  return {} as Record<string, string | undefined>
})()

const DEBUG_ENABLED =
  runtimeEnv.VITE_PARSER_DEBUG === 'true' || runtimeEnv.VENDAS_PARSER_DEBUG === 'true'

const debugLog = (context: string, payload: unknown): void => {
  if (!DEBUG_ENABLED) {
    return
  }
  console.debug(`[extractVendas:${context}]`, payload)
}

const extractContextLines = (text: string, pattern: RegExp, radius = 2): string[] => {
  const lines = text.split(/\r?\n/)
  const index = lines.findIndex((line) => pattern.test(line))
  if (index === -1) {
    return lines.slice(0, Math.min(lines.length, radius * 2 + 1))
  }
  const start = Math.max(0, index - radius)
  const end = Math.min(lines.length, index + radius + 1)
  return lines.slice(start, end)
}

const cloneRegex = (regex: RegExp): RegExp => new RegExp(regex.source, regex.flags)

const logRegexMiss = (field: string, regex: RegExp, text: string): void => {
  if (!DEBUG_ENABLED) {
    return
  }
  debugLog('regex-miss', {
    campo: field,
    regex: regex.source,
    contexto: extractContextLines(text, cloneRegex(regex)),
  })
}

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
  module_area_m2?: number | null | undefined
}

const RE_CAPEX = /Investimento total\s*\(?(?:CAPEX)?\)?\s*R?\$?\s*([\d.,]+)/i
export const RE_POT_KWP = /Pot[êe]ncia\s+(?:do\s+sistema|instalada)[^\n]*?([\d\.,]+)\s*k\s*w\s*p/i
const RE_GERACAO_KWH_MES = /Gera[çc][aã]o\s+estimada.*?\(?\s*kwh\/m[eê]s\s*\)?\s*([\d.,]+)/i
const RE_QTD_MODULOS = /Quantidade\s+de\s+m[oó]dulos\s*([\d.,]+)\s*(?:un|unid|unidade)?/i
const RE_POT_MODULO_WP = /Pot[êe]ncia\s+(?:da\s+placa|do\s+m[oó]dulo)\s*\(?\s*wp\s*\)?\s*([\d.,]+)/i
const RE_MODELO_MODULO = /Modelo\s+dos\s+m[oó]dulos\s*(.+)/i
const RE_MODELO_INV = /Modelo\s+dos\s+inversores\s*(.+)/i
const RE_ESTRUTURA_FIXACAO = /Estrutura\s+de\s+fixa[çc][aã]o\s*(.+)/i
const RE_ESTRUTURA_UTILIZADA = /Estrutura\s+utilizada[\s\S]*?\n([^\n]{3,})/i
const RE_TIPO_INST = /Tipo\s+de\s+instala[çc][aã]o\s*(.+)/i
const RE_TARIFA = /Tarifa\s+cheia.*?R?\$?\s*([\d.,]+)/i

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

export function maybeFillQuantidadeModulos({
  quantidade_modulos,
  potencia_instalada_kwp,
  potencia_da_placa_wp,
}: {
  quantidade_modulos: number | null
  potencia_instalada_kwp: number | null
  potencia_da_placa_wp: number | null
}): number | null {
  if (Number.isFinite(quantidade_modulos) && (quantidade_modulos ?? 0) > 0) {
    const inteiro = Math.round(Number(quantidade_modulos))
    if (inteiro > 0) {
      debugLog('quantidade-modulos-explicito', {
        quantidade: inteiro,
      })
      return inteiro
    }
    return null
  }

  const potencia = Number.isFinite(potencia_instalada_kwp) ? Number(potencia_instalada_kwp) : NaN
  const moduloWp = Number.isFinite(potencia_da_placa_wp) ? Number(potencia_da_placa_wp) : NaN

  if (potencia > 0 && moduloWp > 0) {
    const estimada = Math.round((potencia * 1000) / moduloWp)
    if (Number.isFinite(estimada) && estimada > 0) {
      debugLog('quantidade-modulos-estimada', {
        potencia_instalada_kwp,
        potencia_da_placa_wp,
        quantidade: estimada,
      })
      return estimada
    }
  }

  debugLog('quantidade-modulos-indefinida', {
    potencia_instalada_kwp,
    potencia_da_placa_wp,
  })
  return null
}

export function finalizeParsedVendaData(
  input: Partial<ParsedVendaPdfData> & { geracao_estimada_source?: GeracaoSource | null },
): ParsedVendaPdfData {
  const capex_total = sanitizePositive(input.capex_total ?? null)
  const potencia_da_placa_wp = sanitizePositive(input.potencia_da_placa_wp ?? null)
  let potencia_instalada_kwp = sanitizePositive(input.potencia_instalada_kwp ?? null)
  let quantidade_modulos = sanitizePositiveInteger(input.quantidade_modulos ?? null)

  quantidade_modulos = sanitizePositiveInteger(
    maybeFillQuantidadeModulos({
      quantidade_modulos,
      potencia_instalada_kwp,
      potencia_da_placa_wp,
    }),
  )

  if (
    potencia_instalada_kwp == null &&
    quantidade_modulos != null &&
    potencia_da_placa_wp != null
  ) {
    const potencia = (quantidade_modulos * potencia_da_placa_wp) / 1000
    if (Number.isFinite(potencia) && potencia > 0) {
      potencia_instalada_kwp = potencia
      debugLog('potencia-derivada', {
        origem: 'quantidade_modulos_pre_sanitizacao',
        potencia_instalada_kwp: potencia,
        quantidade_modulos,
        potencia_da_placa_wp,
      })
    }
  }

  potencia_instalada_kwp = sanitizePositive(potencia_instalada_kwp ?? null)

  const result: ParsedVendaPdfData = {
    capex_total,
    potencia_instalada_kwp,
    geracao_estimada_kwh_mes: sanitizePositive(input.geracao_estimada_kwh_mes ?? null),
    quantidade_modulos,
    potencia_da_placa_wp,
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
      debugLog('potencia-derivada', {
        origem: 'quantidade_modulos_pos_sanitizacao',
        potencia_instalada_kwp: potencia,
        quantidade_modulos: result.quantidade_modulos,
        potencia_da_placa_wp: result.potencia_da_placa_wp,
      })
    }
  }

  let geracao = result.geracao_estimada_kwh_mes
  let geracaoSource: GeracaoSource | null = result.geracao_estimada_source ?? null

  if (geracao == null && result.potencia_instalada_kwp != null) {
    const estimada = estimateMonthlyGenerationKWh({ potencia_instalada_kwp: result.potencia_instalada_kwp })
    if (estimada > 0) {
      geracao = estimada
      geracaoSource = geracaoSource === 'extracted' ? 'extracted' : 'calculated'
      debugLog('geracao-estimada', {
        potencia_instalada_kwp: result.potencia_instalada_kwp,
        geracao_estimada_kwh_mes: estimada,
      })
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

  const capexMatch = text.match(RE_CAPEX)
  if (!capexMatch) {
    logRegexMiss('capex_total', RE_CAPEX, text)
  }
  const capex_total = toNumberFlexible(capexMatch?.[1])

  const potenciaMatch = text.match(RE_POT_KWP)
  if (!potenciaMatch) {
    logRegexMiss('potencia_instalada_kwp', RE_POT_KWP, text)
  }
  const potencia_instalada_kwp = toNumberFlexible(potenciaMatch?.[1])

  const geracaoMatch = text.match(RE_GERACAO_KWH_MES)
  if (!geracaoMatch) {
    logRegexMiss('geracao_estimada_kwh_mes', RE_GERACAO_KWH_MES, text)
  }
  const geracao_extr = toNumberFlexible(geracaoMatch?.[1])

  const quantidadeMatch = text.match(RE_QTD_MODULOS)
  if (!quantidadeMatch) {
    logRegexMiss('quantidade_modulos', RE_QTD_MODULOS, text)
  }
  const quantidade_modulos = toNumberFlexible(quantidadeMatch?.[1])

  const potenciaModuloMatch = text.match(RE_POT_MODULO_WP)
  if (!potenciaModuloMatch) {
    logRegexMiss('potencia_da_placa_wp', RE_POT_MODULO_WP, text)
  }
  let potencia_da_placa_wp = toNumberFlexible(potenciaModuloMatch?.[1])
  if (potencia_da_placa_wp == null) {
    const fallbackMatch = text.match(/m[óo]dulo[^\n]*?(\d{3,4})\s*(?:wp|w)\b/i)
    if (fallbackMatch) {
      const numeric = fallbackMatch[1].replace(/\D+/g, '')
      if (numeric) {
        const parsed = toNumberFlexible(numeric)
        if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
          potencia_da_placa_wp = parsed
          debugLog('potencia-wp-fallback', {
            contexto: extractContextLines(text, /m[óo]dulo[^\n]*?\d{3,4}\s*(?:wp|w)\b/i),
            potencia_da_placa_wp: parsed,
          })
        }
      }
    }
  }
  const modeloModuloMatch = text.match(RE_MODELO_MODULO)
  if (!modeloModuloMatch) {
    logRegexMiss('modelo_modulo', RE_MODELO_MODULO, text)
  }
  const modelo_modulo = cleanString(modeloModuloMatch?.[1])

  const modeloInversorMatch = text.match(RE_MODELO_INV)
  if (!modeloInversorMatch) {
    logRegexMiss('modelo_inversor', RE_MODELO_INV, text)
  }
  const modelo_inversor = cleanString(modeloInversorMatch?.[1])

  const estruturaMatch = text.match(RE_ESTRUTURA_FIXACAO)
  if (!estruturaMatch) {
    logRegexMiss('estrutura_fixacao', RE_ESTRUTURA_FIXACAO, text)
  }
  let estrutura_fixacao = cleanString(estruturaMatch?.[1])
  if (!estrutura_fixacao) {
    const estruturaUtilizadaMatch = text.match(RE_ESTRUTURA_UTILIZADA)
    if (estruturaUtilizadaMatch) {
      estrutura_fixacao = cleanString(estruturaUtilizadaMatch[1])
      debugLog('estrutura-fallback', {
        contexto: extractContextLines(text, RE_ESTRUTURA_UTILIZADA),
        estrutura_fixacao,
      })
    }
  }
  const tipoMatch = text.match(RE_TIPO_INST)
  if (!tipoMatch) {
    logRegexMiss('tipo_instalacao', RE_TIPO_INST, text)
  }
  const tipo_instalacao = cleanString(tipoMatch?.[1])

  const tarifaMatch = text.match(RE_TARIFA)
  if (!tarifaMatch) {
    logRegexMiss('tarifa_cheia_r_kwh', RE_TARIFA, text)
  }
  const tarifa_cheia_r_kwh = toNumberFlexible(tarifaMatch?.[1])

  const resultado = finalizeParsedVendaData({
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

  debugLog('resultado', resultado)

  return resultado
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
