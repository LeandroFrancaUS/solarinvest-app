import { toNumberFlexible } from '../lib/locale/br-number'
import { resolvePublicAssetPath } from './publicAssets'

const CSV_URL = resolvePublicAssetPath('tilted_latitude_means.csv')

export const IRRADIACAO_FALLBACK = 5.55

interface IrradiacaoDataset {
  byUf: Map<string, number>
  byState: Map<string, number>
}

export interface IrradiacaoResult {
  value: number
  matched: boolean
  via: 'uf' | 'state' | 'fallback'
}

let datasetCache: Promise<IrradiacaoDataset> | null = null

function stripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeAlpha(value: string): string {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

function normalizeUf(value: string): string | null {
  const normalized = normalizeAlpha(value)
  return normalized.length === 2 ? normalized : null
}

function normalizeState(value: string): string {
  return normalizeAlpha(value)
}

function parseCsv(text: string): IrradiacaoDataset {
  const byUf = new Map<string, number>()
  const byState = new Map<string, number>()

  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line || index === 0 && line.toLowerCase().includes('state')) {
      continue
    }
    const parts = line.split(',').map((part) => part.trim())
    if (parts.length < 3) continue

    const [stateRaw, ufRaw, valueRaw] = parts
    const parsedValue = toNumberFlexible(valueRaw)
    if (!Number.isFinite(parsedValue)) continue
    const value = Number(parsedValue)

    const normalizedState = normalizeState(stateRaw)
    if (normalizedState && !byState.has(normalizedState)) {
      byState.set(normalizedState, value)
    }

    const normalizedUf = normalizeUf(ufRaw)
    if (normalizedUf && !byUf.has(normalizedUf)) {
      byUf.set(normalizedUf, value)
    }
  }

  return { byUf, byState }
}

async function loadDataset(): Promise<IrradiacaoDataset> {
  if (!datasetCache) {
    datasetCache = fetch(CSV_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Falha ao carregar CSV de irradiação: ${response.status}`)
        }
        return response.text()
      })
      .then((text) => parseCsv(text))
      .catch((error) => {
        datasetCache = null
        throw error
      })
  }
  return datasetCache
}

export async function getIrradiacaoPorEstado(input: string): Promise<IrradiacaoResult> {
  const dataset = await loadDataset()
  const trimmed = input.trim()
  if (!trimmed) {
    return { value: IRRADIACAO_FALLBACK, matched: false, via: 'fallback' }
  }

  const normalizedUf = normalizeUf(trimmed)
  if (normalizedUf) {
    const value = dataset.byUf.get(normalizedUf)
    if (typeof value === 'number') {
      return { value, matched: true, via: 'uf' }
    }
  }

  const normalizedState = normalizeState(trimmed)
  if (normalizedState) {
    const value = dataset.byState.get(normalizedState)
    if (typeof value === 'number') {
      return { value, matched: true, via: 'state' }
    }
  }

  return { value: IRRADIACAO_FALLBACK, matched: false, via: 'fallback' }
}

export function hasEstadoMinimo(input: string): boolean {
  const normalizedState = normalizeState(input)
  if (!normalizedState) return false
  if (normalizeUf(input)) return true
  return normalizedState.length >= 4
}
