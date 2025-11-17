export type TarifaAtualLite = {
  distribuidoraId: string
  tarifaConvencional: number
  tusd: number
}

export type TarifaHistoricaLite = {
  ano: number
  mes: number
  tarifa: number
}

const API_BASE = '/api/aneel'

const DEFAULT_TARIFA: TarifaAtualLite = {
  distribuidoraId: 'desconhecida',
  tarifaConvencional: 0.85,
  tusd: 0.35,
}

const buildUrl = (path: string): string => {
  const sanitizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}?path=${encodeURIComponent(sanitizedPath)}`
}

const safeParseNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'string' ? Number(value) : (value as number)
  return Number.isFinite(parsed) ? Number(parsed) : fallback
}

async function requestAneel<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(buildUrl(path))
    if (!response.ok) {
      return null
    }
    const data = (await response.json()) as { data?: T } | T
    if (data && typeof data === 'object' && 'data' in data) {
      return (data as { data: T }).data
    }
    return data as T
  } catch (error) {
    console.error('Erro ao consultar ANEEL LITE', error)
    return null
  }
}

export async function fetchTarifaAtualDistribuidora(codDistribuidora: string): Promise<TarifaAtualLite> {
  if (!codDistribuidora) {
    return { ...DEFAULT_TARIFA }
  }
  const payload = await requestAneel<{ tarifaConvencional: number; tusd: number }>(
    `/distribuidoras/${encodeURIComponent(codDistribuidora)}/tarifa-lite`,
  )
  if (!payload) {
    return { ...DEFAULT_TARIFA, distribuidoraId: codDistribuidora }
  }
  return {
    distribuidoraId: codDistribuidora,
    tarifaConvencional: safeParseNumber(payload.tarifaConvencional, DEFAULT_TARIFA.tarifaConvencional),
    tusd: safeParseNumber(payload.tusd, DEFAULT_TARIFA.tusd),
  }
}

export async function fetchHistoricoTarifasCurtas(
  codDistribuidora: string,
): Promise<TarifaHistoricaLite[]> {
  if (!codDistribuidora) {
    return []
  }
  const payload = await requestAneel<Array<{ ano: number; mes: number; tarifa: number }>>(
    `/distribuidoras/${encodeURIComponent(codDistribuidora)}/historico-tarifas-lite?limit=36`,
  )
  if (!Array.isArray(payload)) {
    return []
  }
  return payload
    .map((item) => ({
      ano: Number.isFinite(item.ano) ? item.ano : 0,
      mes: Number.isFinite(item.mes) ? item.mes : 1,
      tarifa: safeParseNumber(item.tarifa, DEFAULT_TARIFA.tarifaConvencional),
    }))
    .filter((item) => item.ano > 0 && item.mes > 0)
}
