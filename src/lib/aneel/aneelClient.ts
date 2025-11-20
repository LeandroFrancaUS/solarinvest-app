export type TarifaAtual = {
  distribuidoraId: string
  inicioVigencia: string // ISO
  fimVigencia?: string | null
  tarifaConvencional: number // R$/kWh
  tusd: number // R$/kWh
  bandeiraAtual?: string | null
}

export type TarifaHistorica = {
  ano: number
  mes: number
  tarifa: number // R$/kWh
  tusd?: number | null
}

export type DadosTUSD = {
  mediaHistorica: number
  atual: number
  tendenciaAnual: number // % ao ano
}

type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, CacheEntry<unknown>>()

const defaultTarifa: TarifaAtual = {
  distribuidoraId: 'mock',
  inicioVigencia: new Date().toISOString(),
  fimVigencia: null,
  tarifaConvencional: 1.08,
  tusd: 0.38,
  bandeiraAtual: 'verde',
}

const defaultHistorico: TarifaHistorica[] = Array.from({ length: 24 }).map((_, idx) => {
  const date = new Date()
  date.setMonth(date.getMonth() - idx)
  return {
    ano: date.getFullYear(),
    mes: date.getMonth() + 1,
    tarifa: 0.95 + idx * 0.005,
    tusd: 0.35 + idx * 0.002,
  }
})

const defaultTUSD: DadosTUSD = {
  mediaHistorica: 0.36,
  atual: 0.38,
  tendenciaAnual: 0.05,
}

const getCache = <T>(key: string): T | null => {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.value as T
}

const setCache = <T>(key: string, value: T, ttlMs = ONE_DAY_MS * 2) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

const buildKey = (prefix: string, codDistribuidora: string) => `${prefix}:${codDistribuidora}`

export async function fetchTarifasDistribuidora(codDistribuidora: string): Promise<TarifaAtual> {
  const cacheKey = buildKey('tarifa', codDistribuidora)
  const cached = getCache<TarifaAtual>(cacheKey)
  if (cached) return cached

  const tarifa = {
    ...defaultTarifa,
    distribuidoraId: codDistribuidora,
    tarifaConvencional: defaultTarifa.tarifaConvencional + Math.random() * 0.05,
  }

  setCache(cacheKey, tarifa)
  return tarifa
}

export async function fetchHistoricoTarifas(
  codDistribuidora: string,
): Promise<TarifaHistorica[]> {
  const cacheKey = buildKey('historico', codDistribuidora)
  const cached = getCache<TarifaHistorica[]>(cacheKey)
  if (cached) return cached

  const historico = defaultHistorico.map((item) => ({
    ...item,
    tarifa: item.tarifa * (1 + (Math.random() - 0.5) * 0.05),
  }))

  setCache(cacheKey, historico)
  return historico
}

export async function fetchDadosTUSD(codDistribuidora: string): Promise<DadosTUSD> {
  const cacheKey = buildKey('tusd', codDistribuidora)
  const cached = getCache<DadosTUSD>(cacheKey)
  if (cached) return cached

  const tusd = { ...defaultTUSD, atual: defaultTUSD.atual * (1 + (Math.random() - 0.5) * 0.02) }
  setCache(cacheKey, tusd)
  return tusd
}
