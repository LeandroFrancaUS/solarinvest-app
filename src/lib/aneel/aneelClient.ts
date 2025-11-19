const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const LOCAL_STORAGE_KEY = 'aneel-cache'

export type TarifaAtual = {
  distribuidoraId: string
  inicioVigencia: string
  fimVigencia?: string | null
  tarifaConvencional: number
  tusd: number
  bandeiraAtual?: string | null
}

export type TarifaHistorica = {
  ano: number
  mes: number
  tarifa: number
  tusd?: number | null
}

export type DadosTUSD = {
  mediaHistorica: number
  atual: number
  tendenciaAnual: number
}

type CacheEntry<T> = {
  timestamp: number
  data: T
}

const memoryCache = new Map<string, CacheEntry<unknown>>()

const now = () => Date.now()

const getLocalStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    return window.localStorage
  } catch (_error) {
    return undefined
  }
}

const storage = getLocalStorage()

type Resource = 'tarifas' | 'historico' | 'tusd'

const buildCacheKey = (resource: Resource, codDistribuidora: string) => `${resource}:${codDistribuidora}`

const readCache = <T>(resource: Resource, codDistribuidora: string): T | undefined => {
  const key = buildCacheKey(resource, codDistribuidora)
  const entry = memoryCache.get(key)
  const nowTs = now()

  if (entry && nowTs - entry.timestamp < CACHE_TTL_MS) {
    return entry.data as T
  }

  if (!storage) {
    return undefined
  }

  const serialized = storage.getItem(`${LOCAL_STORAGE_KEY}:${key}`)
  if (!serialized) {
    return undefined
  }

  try {
    const parsed = JSON.parse(serialized) as CacheEntry<T>
    if (nowTs - parsed.timestamp < CACHE_TTL_MS) {
      memoryCache.set(key, parsed)
      return parsed.data
    }
  } catch (_error) {
    storage.removeItem(`${LOCAL_STORAGE_KEY}:${key}`)
  }

  return undefined
}

const writeCache = <T>(resource: Resource, codDistribuidora: string, data: T) => {
  const key = buildCacheKey(resource, codDistribuidora)
  const entry: CacheEntry<T> = { timestamp: now(), data }
  memoryCache.set(key, entry)

  if (!storage) {
    return
  }

  try {
    storage.setItem(`${LOCAL_STORAGE_KEY}:${key}`, JSON.stringify(entry))
  } catch (_error) {
    // Falha silenciosa para ambientes sem quota de localStorage
  }
}

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeTarifaAtual = (raw: Partial<TarifaAtual>, fallbackId: string): TarifaAtual => {
  const record = raw as Record<string, unknown>
  const bandeiraExtra = typeof record.bandeira === 'string' ? (record.bandeira as string) : null
  const tarifaConvencional =
    raw.tarifaConvencional ?? toNumber(record.tarifa ?? record.valor ?? record.preco)
  const tusdValor = raw.tusd ?? toNumber(record.tusdAtual ?? record.tusd)

  return {
    distribuidoraId: raw.distribuidoraId ?? fallbackId,
    inicioVigencia: raw.inicioVigencia ?? new Date().toISOString(),
    fimVigencia: raw.fimVigencia ?? null,
    tarifaConvencional: toNumber(tarifaConvencional),
    tusd: toNumber(tusdValor),
    bandeiraAtual: raw.bandeiraAtual ?? bandeiraExtra ?? null,
  }
}

const normalizeHistorico = (rawList: unknown[]): TarifaHistorica[] =>
  rawList
    .map((item) => {
      const record = item as Record<string, unknown>
      const ano = Number(record.ano ?? record.year)
      const mes = Number(record.mes ?? record.month ?? 1)
      const tarifa = Number(record.tarifa ?? record.valor)
      const tusd = record.tusd === undefined ? undefined : Number(record.tusd)
      if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(tarifa)) {
        return undefined
      }
      const result: TarifaHistorica = {
        ano,
        mes,
        tarifa,
      }
      if (tusd !== undefined) {
        result.tusd = tusd
      }
      return result
    })
    .filter((entry): entry is TarifaHistorica => Boolean(entry))
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)

const normalizeDadosTUSD = (raw: Partial<DadosTUSD>): DadosTUSD => {
  const record = raw as Record<string, unknown>
  return {
    mediaHistorica: toNumber(raw.mediaHistorica ?? record.media),
    atual: toNumber(raw.atual ?? record.valorAtual ?? record.tusdAtual),
    tendenciaAnual: toNumber(raw.tendenciaAnual ?? record.tendencia ?? 0.05),
  }
}

const buildUrl = (path: string, codDistribuidora: string) => {
  const search = new URLSearchParams({ distribuidora: codDistribuidora })
  return `/api/aneel/${path}?${search.toString()}`
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Falha ao consultar dados da ANEEL (${response.status})`)
  }
  const payload = (await response.json()) as { data?: T } | T
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: T }).data) {
    return (payload as { data: T }).data
  }
  return payload as T
}

export const fetchTarifasDistribuidora = async (
  codDistribuidora: string,
): Promise<TarifaAtual> => {
  const cached = readCache<TarifaAtual>('tarifas', codDistribuidora)
  if (cached) {
    return cached
  }

  const url = buildUrl('tarifas', codDistribuidora)
  const raw = await fetchJson<Partial<TarifaAtual>>(url)
  const normalized = normalizeTarifaAtual(raw, codDistribuidora)
  writeCache('tarifas', codDistribuidora, normalized)
  return normalized
}

export const fetchHistoricoTarifas = async (
  codDistribuidora: string,
): Promise<TarifaHistorica[]> => {
  const cached = readCache<TarifaHistorica[]>('historico', codDistribuidora)
  if (cached) {
    return cached
  }

  const url = buildUrl('historico', codDistribuidora)
  const raw = await fetchJson<unknown[]>(url)
  const normalized = normalizeHistorico(raw ?? [])
  writeCache('historico', codDistribuidora, normalized)
  return normalized
}

export const fetchDadosTUSD = async (codDistribuidora: string): Promise<DadosTUSD> => {
  const cached = readCache<DadosTUSD>('tusd', codDistribuidora)
  if (cached) {
    return cached
  }

  const url = buildUrl('tusd', codDistribuidora)
  const raw = await fetchJson<Partial<DadosTUSD>>(url)
  const normalized = normalizeDadosTUSD(raw ?? {})
  writeCache('tusd', codDistribuidora, normalized)
  return normalized
}

export const clearAneelCache = () => {
  memoryCache.clear()
  if (!storage) {
    return
  }

  const keysToRemove: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(`${LOCAL_STORAGE_KEY}:`)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key))
}
