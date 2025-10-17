import { formatNumberBRWithOptions, toNumberFlexible } from '../lib/locale/br-number'
import { resolveAneelUrl } from './aneelUrl'

const CKAN_SQL_PATH = '/api/3/action/datastore_search_sql'
const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4'
const CSV_FALLBACK = '/tarifas_medias.csv'

const UF_CANDIDATES = ['UF', 'SIGLA_UF']
const DISTRIBUIDORA_CANDIDATES = ['DISTRIBUIDORA', 'CONCESSIONARIA', 'AGENTE']
const CLASSE_CANDIDATES = ['CLASSE']
const SUBCLASSE_CANDIDATES = ['SUBCLASSE']
const DATA_CANDIDATES = [
  'DATA_VIGENCIA',
  'DATA DE VIGENCIA',
  'DATA VIGENCIA',
  'DATA_VIGÊNCIA',
  'DT_VIGENCIA',
]
const TARIFA_CANDIDATES = [
  'TE_TUSD_R$/KWH',
  'TE+TUSD (R$/KWH)',
  'TARIFA_MEDIA_R$/KWH',
  'TARIFA_MEDIA_RESIDENCIAL (R$/KWH)',
  'TARIFA_MEDIA_RESIDENCIAL_R$/KWH',
  'TARIFA_MEDIA_RESIDENCIAL',
]

interface CkanResponse {
  success?: boolean
  result?: {
    records?: Record<string, unknown>[]
  }
}

const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
const normCompact = (value: string) => norm(value).replace(/[^A-Z0-9]+/g, '')
const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''")

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const direct = new Date(trimmed)
  if (Number.isFinite(direct.getTime())) {
    return direct
  }

  const parts = trimmed.split(/[\/-]/)
  if (parts.length >= 3) {
    const [part1, part2, part3] = parts
    const [d, m, y] = [part1, part2, part3].map((segment) => parseInt(segment, 10))
    if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) && m >= 1 && m <= 12) {
      const year = y < 100 ? 2000 + y : y
      const date = new Date(year, m - 1, d)
      if (Number.isFinite(date.getTime())) {
        return date
      }
    }
  }

  return null
}

const parseTarifa = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  const cleaned = trimmed.replace(/[^0-9,.-]+/g, '')
  if (!cleaned) return null

  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const findColumn = (fields: string[], candidates: string[]): string | null => {
  if (!fields.length) return null
  const normalizedCandidates = candidates.map(normCompact)
  for (const field of fields) {
    const normalized = normCompact(field)
    if (normalizedCandidates.includes(normalized)) {
      return field
    }
  }
  return null
}

const findTarifaColumn = (fields: string[]): string | null => {
  const explicit = findColumn(fields, TARIFA_CANDIDATES)
  if (explicit) return explicit

  for (const field of fields) {
    const normalized = norm(field)
    if (normalized.includes('R$/KWH') || normalized.includes('R$KWH')) {
      return field
    }
  }

  return null
}

const schemaCache = new Map<string, string[]>()

const getSchema = async (resourceId: string): Promise<string[]> => {
  if (schemaCache.has(resourceId)) {
    return schemaCache.get(resourceId)!
  }

  try {
    const res = await fetch(
      resolveAneelUrl(`/api/3/action/datastore_search?resource_id=${resourceId}&limit=0`),
    )
    const json = (await res.json()) as CkanResponse & { result?: { fields?: { id: string }[] } }
    const fields = json?.result?.fields?.map((field) => field.id) ?? []
    schemaCache.set(resourceId, fields)
    return fields
  } catch (error) {
    console.warn('[Tarifa] Falha ao carregar schema CKAN:', error)
  }

  schemaCache.set(resourceId, [])
  return []
}

const fetchTarifaFromCkan = async (uf: string, distribuidora: string): Promise<number | null> => {
  const fields = await getSchema(RESOURCE_ID)
  if (!fields.length) return null

  const ufCol = findColumn(fields, UF_CANDIDATES)
  const distCol = findColumn(fields, DISTRIBUIDORA_CANDIDATES)
  const classeCol = findColumn(fields, CLASSE_CANDIDATES)
  const subclasseCol = findColumn(fields, SUBCLASSE_CANDIDATES)
  const dataCol = findColumn(fields, DATA_CANDIDATES)
  const tarifaCol = findTarifaColumn(fields)

  if (!ufCol || !tarifaCol) {
    return null
  }

  const selectedColumns = new Set<string>([ufCol, tarifaCol])
  if (distCol) selectedColumns.add(distCol)
  if (classeCol) selectedColumns.add(classeCol)
  if (subclasseCol) selectedColumns.add(subclasseCol)
  if (dataCol) selectedColumns.add(dataCol)

  const conditions: string[] = [`UPPER("${ufCol}")='${escapeSqlLiteral(uf)}'`]
  if (classeCol) {
    conditions.push(`UPPER("${classeCol}") LIKE '%BAIXA%'`)
  }
  if (subclasseCol) {
    conditions.push(`UPPER("${subclasseCol}") LIKE '%RESID%'`)
  }
  if (distribuidora && distCol) {
    conditions.push(`UPPER("${distCol}") LIKE '%${escapeSqlLiteral(distribuidora)}%'`)
  }

  const orderBy = dataCol ? `"${dataCol}" DESC` : '"_id" DESC'
  const sql = `SELECT ${Array.from(selectedColumns)
    .map((column) => `"${column}"`)
    .join(', ')} FROM "${RESOURCE_ID}" WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} LIMIT 200`

  try {
    const res = await fetch(resolveAneelUrl(`${CKAN_SQL_PATH}?sql=${encodeURIComponent(sql)}`))
    const json = (await res.json()) as CkanResponse
    if (!json?.success || !json?.result?.records?.length) {
      return null
    }

    let melhorValor: number | null = null
    let melhorData: Date | null = null

    for (const record of json.result.records) {
      if (classeCol) {
        const classeValor = record?.[classeCol]
        if (typeof classeValor === 'string' && !norm(classeValor).includes('BAIXA')) {
          continue
        }
      }

      if (subclasseCol) {
        const subclasseValor = record?.[subclasseCol]
        if (typeof subclasseValor === 'string') {
          const normalized = norm(subclasseValor)
          if (!normalized.includes('RESID')) {
            continue
          }
        }
      }

      if (distribuidora && distCol) {
        const distribuidoraValor = record?.[distCol]
        if (typeof distribuidoraValor === 'string') {
          const normalized = norm(distribuidoraValor)
          if (!normalized.includes(distribuidora)) {
            continue
          }
        }
      }

      const tarifaValor = record?.[tarifaCol]
      const parsedTarifa = parseTarifa(tarifaValor)
      if (parsedTarifa === null || parsedTarifa <= 0) {
        continue
      }

      const dataValor = dataCol ? parseDate(record?.[dataCol]) : null
      if (!melhorValor) {
        melhorValor = parsedTarifa
        melhorData = dataValor
        continue
      }

      if (!melhorData && dataValor) {
        melhorValor = parsedTarifa
        melhorData = dataValor
        continue
      }

      if (melhorData && dataValor && dataValor > melhorData) {
        melhorValor = parsedTarifa
        melhorData = dataValor
      }
    }

    return melhorValor
  } catch (error) {
    console.warn('[Tarifa] Falha na consulta CKAN:', error)
    return null
  }
}

const fetchTarifaFromCsv = async (uf: string): Promise<number | null> => {
  try {
    const res = await fetch(CSV_FALLBACK, { cache: 'force-cache' })
    if (!res.ok) {
      return null
    }

    const text = await res.text()
    const linhas = text.split(/\r?\n/).filter((linha) => linha.trim().length > 0)
    if (linhas.length <= 1) {
      return null
    }

    for (let i = 1; i < linhas.length; i += 1) {
      const [ufCsv, tarifaCsv] = linhas[i].split(',').map((parte) => parte.trim())
      if (!ufCsv || !tarifaCsv) continue
      if (norm(ufCsv) !== uf) continue

      const tarifaNumero = toNumberFlexible(tarifaCsv)
      if (!Number.isFinite(tarifaNumero) || (tarifaNumero ?? 0) <= 0) {
        continue
      }
      const valor = Math.round(Number(tarifaNumero) * 1000) / 1000
      if (Number.isFinite(valor) && valor > 0) {
        console.warn(
          `[Tarifa] Usando valor médio local de ${formatNumberBRWithOptions(valor, {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          })} R$/kWh para ${uf}.`,
        )
        return valor
      }
    }
  } catch (error) {
    console.warn('[Tarifa] Falha ao ler CSV de fallback:', error)
  }

  return null
}

const UF_PADRAO_TARIFA: Record<string, number> = {
  GO: 0.964,
}

const finalFallback = (uf: string): number => {
  const valorPadrao = UF_PADRAO_TARIFA[uf] ?? 0.9
  console.warn(
    `[Tarifa] Nenhum dado encontrado para ${uf}. Usando padrão ${formatNumberBRWithOptions(valorPadrao, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} R$/kWh.`,
  )
  return valorPadrao
}

const resolvedCache = new Map<string, number>()
const pendingCache = new Map<string, Promise<number>>()

export interface TarifaParams {
  uf: string
  distribuidora?: string | undefined
}

export async function getTarifaCheia({ uf, distribuidora }: TarifaParams): Promise<number> {
  const UF = norm(uf)
  const DIST = distribuidora ? norm(distribuidora) : ''
  if (!UF) {
    throw new Error('UF é obrigatório para consulta da tarifa cheia')
  }

  const cacheKey = `${UF}|${DIST}`
  if (resolvedCache.has(cacheKey)) {
    return resolvedCache.get(cacheKey)!
  }

  if (pendingCache.has(cacheKey)) {
    return pendingCache.get(cacheKey)!
  }

  const promessa = (async () => {
    if (DIST) {
      const valorCkan = await fetchTarifaFromCkan(UF, DIST)
      if (valorCkan && Number.isFinite(valorCkan) && valorCkan > 0) {
        const normalizado = Number(Number(valorCkan).toFixed(3))
        resolvedCache.set(cacheKey, normalizado)
        return normalizado
      }
    }

    const valorCsv = await fetchTarifaFromCsv(UF)
    if (valorCsv && Number.isFinite(valorCsv) && valorCsv > 0) {
      const normalizado = Number(valorCsv.toFixed(3))
      resolvedCache.set(cacheKey, normalizado)
      return normalizado
    }

    const fallback = finalFallback(UF)
    const normalizado = Number(fallback.toFixed(3))
    resolvedCache.set(cacheKey, normalizado)
    return normalizado
  })()
    .catch((error) => {
      console.warn('[Tarifa] Erro inesperado ao obter tarifa cheia:', error)
      const fallback = finalFallback(UF)
      const normalizado = Number(fallback.toFixed(3))
      resolvedCache.set(cacheKey, normalizado)
      return normalizado
    })
    .finally(() => {
      pendingCache.delete(cacheKey)
    })

  pendingCache.set(cacheKey, promessa)
  return promessa
}

