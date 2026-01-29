import { resolveAneelUrl } from './aneelUrl'

const CKAN_SQL_PATH = '/api/3/action/datastore_search_sql'
const CKAN_DATASTORE_PATH = '/api/3/action/datastore_search'
const CSV_PATH =
  '/dataset/tarifas-distribuidoras-energia-eletrica/resource/fcf2906c-7c32-4b9b-a637-054e7a5234f4/download/tarifas-homologadas-distribuidoras-energia-eletrica.csv'

const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4'

const UF_CANDIDATES = ['UF', 'SIGLA_UF']
const DISTRIBUIDORA_CANDIDATES = ['DISTRIBUIDORA', 'AGENTE', 'CONCESSIONARIA']
const DATA_CANDIDATES = ['DATA_VIGENCIA', 'DATA DE VIGENCIA', 'DATA VIGENCIA', 'DATA_VIGÊNCIA', 'DT_VIGENCIA']

const sessionCache = new Map<string, number>()
const pendingCache = new Map<string, Promise<number>>()
const schemaCache = new Map<string, string[]>()

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
const normCompact = (s: string) => norm(s).replace(/[^A-Z0-9]+/g, '')

interface CkanField {
  id: string
}

interface CkanResponse {
  success?: boolean
  result?: {
    records?: Record<string, unknown>[]
    fields?: CkanField[]
  }
}

const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''")

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const iso = new Date(trimmed)
  if (Number.isFinite(iso.getTime())) return iso
  const parts = trimmed.split(/[\/-]/)
  if (parts.length >= 3) {
    const [d, m, y] = parts.map((part) => parseInt(part, 10))
    if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) && m >= 1 && m <= 12) {
      const dt = new Date(y < 100 ? 2000 + y : y, m - 1, d)
      if (Number.isFinite(dt.getTime())) return dt
    }
  }
  return null
}

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

const getSchema = async (resourceId: string): Promise<string[]> => {
  if (schemaCache.has(resourceId)) return schemaCache.get(resourceId)!

  try {
    const res = await fetch(
      resolveAneelUrl(`${CKAN_DATASTORE_PATH}?resource_id=${resourceId}&limit=0`),
    )
    const json = (await res.json()) as CkanResponse
    if (json?.result?.fields?.length) {
      const fields = json.result.fields.map((field) => field.id)
      schemaCache.set(resourceId, fields)
      return fields
    }
  } catch (error) {
    console.warn('[ANEEL] falha ao obter schema CKAN:', error)
  }

  schemaCache.set(resourceId, [])
  return []
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

const fetchFromCkan = async (uf: string, distribuidora: string): Promise<number | null> => {
  const schema = await getSchema(RESOURCE_ID)
  const ufCol = findColumn(schema, UF_CANDIDATES)
  const distCol = findColumn(schema, DISTRIBUIDORA_CANDIDATES)
  const dataCol = findColumn(schema, DATA_CANDIDATES)

  if (!ufCol || !distCol || !dataCol) {
    return null
  }

  const ufSql = escapeSqlLiteral(uf)
  const sql = `SELECT "${ufCol}", "${distCol}", "${dataCol}" FROM "${RESOURCE_ID}" WHERE UPPER("${ufCol}")='${ufSql}' ORDER BY "${dataCol}" DESC LIMIT 200`

  try {
    const res = await fetch(resolveAneelUrl(`${CKAN_SQL_PATH}?sql=${encodeURIComponent(sql)}`))
    const json = (await res.json()) as CkanResponse
    if (!json?.result?.records?.length) return null

    const DIST = norm(distribuidora)
    let melhorMes: number | null = null
    let melhorData: Date | null = null

    for (const record of json.result.records) {
      const distValor = record?.[distCol]
      const dataValor = record?.[dataCol]
      if (typeof distValor !== 'string') continue
      const distNormalizado = norm(distValor)
      if (!distNormalizado.includes(DIST)) continue

      const data = parseDate(dataValor)
      if (!data) continue

      if (!melhorData || data > melhorData) {
        melhorData = data
        melhorMes = data.getMonth() + 1
      }
    }

    return melhorMes
  } catch (error) {
    console.warn('[CKAN] falha na consulta SQL:', error)
    return null
  }
}

const fetchFromCsv = async (uf: string, distribuidora: string): Promise<number | null> => {
  try {
    const res = await fetch(resolveAneelUrl(CSV_PATH), { cache: 'no-store' })
    const text = await res.text()
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
    if (!lines.length) return null

    const delimiter = lines[0].includes(';') ? ';' : ','
    const headerCells = parseCsvLine(lines[0], delimiter)

    const idxUF = headerCells.findIndex((cell) => norm(cell) === 'UF')
    const idxDist = headerCells.findIndex((cell) =>
      ['DISTRIBUIDORA', 'CONCESSIONARIA', 'AGENTE'].includes(norm(cell)),
    )
    const idxData = headerCells.findIndex((cell) =>
      ['DATA_VIGENCIA', 'DATA DE VIGENCIA', 'DATA VIGÊNCIA', 'DATA VIGENCIA'].includes(norm(cell)),
    )

    if (idxUF < 0 || idxDist < 0 || idxData < 0) return null

    const UF = norm(uf)
    const DIST = norm(distribuidora)
    let melhorMes: number | null = null
    let melhorData: Date | null = null

    for (let i = 1; i < lines.length; i += 1) {
      const cells = parseCsvLine(lines[i], delimiter)
      if (cells.length <= Math.max(idxUF, idxDist, idxData)) continue

      if (norm(cells[idxUF]) !== UF) continue
      if (!norm(cells[idxDist]).includes(DIST)) continue

      const data = parseDate(cells[idxData])
      if (!data) continue

      if (!melhorData || data > melhorData) {
        melhorData = data
        melhorMes = data.getMonth() + 1
      }
    }

    return melhorMes
  } catch (error) {
    console.warn('[CSV] falha na leitura:', error)
    return null
  }
}

export async function getMesReajusteFromANEEL(uf: string, distribuidora: string): Promise<number> {
  const UF = norm(uf)
  const DIST = norm(distribuidora)
  const cacheKey = `${UF}__${DIST}`

  if (sessionCache.has(cacheKey)) {
    return sessionCache.get(cacheKey)!
  }

  if (pendingCache.has(cacheKey)) {
    return pendingCache.get(cacheKey)!
  }

  const promise = (async () => {
    if (!UF || !DIST) {
      sessionCache.set(cacheKey, 6)
      return 6
    }

    const ckanMes = await fetchFromCkan(UF, DIST)
    if (typeof ckanMes === 'number' && ckanMes >= 1 && ckanMes <= 12) {
      sessionCache.set(cacheKey, ckanMes)
      return ckanMes
    }

    const csvMes = await fetchFromCsv(UF, DIST)
    if (typeof csvMes === 'number' && csvMes >= 1 && csvMes <= 12) {
      sessionCache.set(cacheKey, csvMes)
      return csvMes
    }

    console.warn(`[ANEEL] usando fallback padrão para ${UF}/${DIST}`)
    sessionCache.set(cacheKey, 6)
    return 6
  })()

  pendingCache.set(cacheKey, promise)
  try {
    const resultado = await promise
    return resultado
  } finally {
    pendingCache.delete(cacheKey)
  }
}
