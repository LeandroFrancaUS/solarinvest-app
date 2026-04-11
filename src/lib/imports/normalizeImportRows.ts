/**
 * src/lib/imports/normalizeImportRows.ts
 *
 * Normalises raw rows (from CSV, XLSX or JSON) into a structured payload that
 * separates clients from proposals and attaches field-level metadata.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type NormalizedImportRow = {
  rowIndex: number
  nome: string
  documento?: string
  cidade?: string
  uf?: string
  telefone?: string
  email?: string
  consumoKwh?: number | null
  raw: Record<string, unknown>
  entityType: 'client' | 'proposal' | 'unknown'
}

export type NormalizedImportPayload = {
  clients: NormalizedImportRow[]
  proposals: NormalizedImportRow[]
  unknown: NormalizedImportRow[]
  sourceFileName: string
  warnings: string[]
}

// ─── Field alias map ──────────────────────────────────────────────────────────

export const FIELD_ALIASES: Record<string, string[]> = {
  nome: ['nome', 'cliente', 'nome_cliente', 'nome_ou_razao_social', 'razao_social', 'nomerazaosocial', 'name', 'client_name'],
  documento: ['cpf_cnpj', 'cpf', 'cnpj', 'documento', 'document', 'cpfcnpj'],
  cidade: ['cidade', 'municipio', 'city', 'client_city'],
  uf: ['uf', 'estado', 'state', 'client_state'],
  telefone: ['telefone', 'fone', 'celular', 'whatsapp', 'phone', 'client_phone'],
  email: ['email', 'e_mail', 'client_email'],
  consumoKwh: ['consumo', 'consumo_kwh', 'consumo_kwh_mes', 'consumo_kwh_month', 'consumption_kwh_month', 'kwh', 'kwhmes'],
  entityType: ['tipo', 'tipo_registro', 'entity', 'entidade', 'entity_type'],
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Normalise a header string: lowercase, strip accents, replace spaces with
 * underscores, strip non-alphanumeric characters (except underscore).
 */
export function normalizeHeaderKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Return the first value found in `row` whose key matches any of the `aliases`
 * (after normalisation).
 */
export function pickAliasedValue(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias) && row[alias] !== undefined && row[alias] !== '') {
      return row[alias]
    }
  }
  return undefined
}

function toString(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function parseConsumoKwh(v: unknown): number | null {
  if (v == null || v === '') return null
  const s = String(v).trim().replace(/\s/g, '')
  // Handle Brazilian decimal separator (comma)
  const normalised = s.replace(/\.(?=\d{3}(?:[,.]|$))/g, '').replace(',', '.')
  const n = parseFloat(normalised)
  return Number.isFinite(n) ? n : null
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function normalizeImportRows(
  rawRows: Record<string, unknown>[],
  sourceFileName: string,
): NormalizedImportPayload {
  const clients: NormalizedImportRow[] = []
  const proposals: NormalizedImportRow[] = []
  const unknown: NormalizedImportRow[] = []
  const warnings: string[] = []

  rawRows.forEach((rawRow, idx) => {
    // Normalise all keys
    const normalisedRow: Record<string, unknown> = {}
    for (const key of Object.keys(rawRow)) {
      normalisedRow[normalizeHeaderKey(key)] = rawRow[key]
    }

    const nome = toString(pickAliasedValue(normalisedRow, FIELD_ALIASES.nome))
    const documento = toString(pickAliasedValue(normalisedRow, FIELD_ALIASES.documento)) || undefined
    const cidade = toString(pickAliasedValue(normalisedRow, FIELD_ALIASES.cidade)) || undefined
    const uf = toString(pickAliasedValue(normalisedRow, FIELD_ALIASES.uf)) || undefined
    const telefone = toString(pickAliasedValue(normalisedRow, FIELD_ALIASES.telefone)) || undefined
    const email = toString(pickAliasedValue(normalisedRow, FIELD_ALIASES.email)) || undefined
    const consumoKwh = parseConsumoKwh(pickAliasedValue(normalisedRow, FIELD_ALIASES.consumoKwh))
    const entityTypeRaw = toString(pickAliasedValue(normalisedRow, FIELD_ALIASES.entityType)).toLowerCase()

    if (!nome) {
      warnings.push(`Linha ${idx + 2}: sem valor no campo "nome" — linha ignorada.`)
    }

    let entityType: 'client' | 'proposal' | 'unknown' = 'client'
    if (entityTypeRaw) {
      if (entityTypeRaw.includes('proposta') || entityTypeRaw.includes('proposal')) {
        entityType = 'proposal'
      } else if (entityTypeRaw.includes('cliente') || entityTypeRaw.includes('client')) {
        entityType = 'client'
      } else {
        entityType = 'unknown'
      }
    }

    const row: NormalizedImportRow = {
      rowIndex: idx,
      nome,
      documento,
      cidade,
      uf,
      telefone,
      email,
      consumoKwh: consumoKwh ?? undefined,
      raw: rawRow,
      entityType,
    }

    if (entityType === 'proposal') {
      proposals.push(row)
    } else if (entityType === 'unknown') {
      unknown.push(row)
    } else {
      clients.push(row)
    }
  })

  return { clients, proposals, unknown, sourceFileName, warnings }
}
