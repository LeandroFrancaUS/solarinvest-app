// src/lib/clients/deduplication.ts
// Client-side deduplication engine for the bulk import preview.
// Runs locally against the already-loaded client list (for non-server mode and
// as a supplement to the server-side check).

export type MatchLevel = 'hard' | 'medium' | 'soft' | 'none'
export type ImportStatus = 'new' | 'existing' | 'possible_duplicate'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type SuggestedAction = 'import' | 'ignore' | 'merge'

export interface DuplicateCheckResult {
  matchLevel: MatchLevel
  status: ImportStatus
  confidence: ConfidenceLevel
  suggestedAction: SuggestedAction
  matchReason: string | null
  /** ID of the matching existing client, if found */
  existingClientId: string | null
  /** Display name of the matching existing client, if found */
  existingClientName: string | null
  /** Which fields triggered the match */
  matchFields: string[]
}

export interface ImportRow {
  name: string
  document?: string | null
  uc?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  address?: string | null
  distribuidora?: string | null
  // Energy profile fields
  kwh_contratado?: number | null
  potencia_kwp?: number | null
  tipo_rede?: string | null
  tarifa_atual?: number | null
  desconto_percentual?: number | null
  mensalidade?: number | null
  indicacao?: string | null
  modalidade?: string | null
  prazo_meses?: number | null
}

export interface ExistingClientSlim {
  id: string
  name: string
  document?: string | null
  uc?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
}

/** Normalize document to digits only */
function normalizeDoc(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/** Normalize phone to digits only */
function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/** Normalize email for comparison */
function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase()
}

/**
 * Dice coefficient string similarity on bigrams.
 * Returns 0–1 (1 = identical).
 */
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0
  const getBigrams = (str: string): Set<string> => {
    const set = new Set<string>()
    for (let i = 0; i < str.length - 1; i++) set.add(str.slice(i, i + 2))
    return set
  }
  const biA = getBigrams(na)
  const biB = getBigrams(nb)
  let intersection = 0
  for (const bi of biA) {
    if (biB.has(bi)) intersection++
  }
  return (2 * intersection) / (biA.size + biB.size)
}

/**
 * Minimum Dice coefficient to consider a name a SOFT match.
 * A value of 0.82 was chosen empirically to catch common name variations
 * (abbreviations, middle-name differences) while avoiding false positives
 * on very short or common names.
 */
export const SOFT_MATCH_NAME_THRESHOLD = 0.82

/**
 * Check a single import row against a list of existing clients (client-side).
 *
 * LEVEL 1 — HARD MATCH (block):
 *   - CPF/CNPJ identical
 *   - UC identical
 *
 * LEVEL 2 — MEDIUM MATCH (possible duplicate):
 *   - Phone identical (digits-only)
 *   - Email identical
 *
 * LEVEL 3 — SOFT MATCH (visual alert):
 *   - Name similarity ≥ SOFT_MATCH_NAME_THRESHOLD AND same city (case-insensitive)
 */
export function checkDuplicateLocal(
  row: ImportRow,
  existing: ExistingClientSlim[],
): DuplicateCheckResult {
  const rowDoc = normalizeDoc(row.document)
  const rowUc = (row.uc ?? '').trim().toLowerCase()
  const rowPhone = normalizePhone(row.phone)
  const rowEmail = normalizeEmail(row.email)
  const rowCity = (row.city ?? '').trim().toLowerCase()
  const rowName = (row.name ?? '').trim()

  for (const client of existing) {
    // ── LEVEL 1: HARD MATCH ─────────────────────────────────────────────────
    const clientDoc = normalizeDoc(client.document)
    if (rowDoc.length >= 11 && clientDoc.length >= 11 && rowDoc === clientDoc) {
      return {
        matchLevel: 'hard',
        status: 'existing',
        confidence: 'high',
        suggestedAction: 'merge',
        matchReason: `CPF/CNPJ idêntico ao cliente "${client.name}"`,
        existingClientId: client.id,
        existingClientName: client.name,
        matchFields: ['document'],
      }
    }

    const clientUc = (client.uc ?? '').trim().toLowerCase()
    if (rowUc && clientUc && rowUc === clientUc) {
      return {
        matchLevel: 'hard',
        status: 'existing',
        confidence: 'high',
        suggestedAction: 'merge',
        matchReason: `UC idêntica à do cliente "${client.name}"`,
        existingClientId: client.id,
        existingClientName: client.name,
        matchFields: ['uc'],
      }
    }
  }

  for (const client of existing) {
    // ── LEVEL 2: MEDIUM MATCH ───────────────────────────────────────────────
    const clientPhone = normalizePhone(client.phone)
    if (rowPhone.length >= 8 && clientPhone.length >= 8 && rowPhone === clientPhone) {
      return {
        matchLevel: 'medium',
        status: 'possible_duplicate',
        confidence: 'medium',
        suggestedAction: 'merge',
        matchReason: `Telefone idêntico ao do cliente "${client.name}"`,
        existingClientId: client.id,
        existingClientName: client.name,
        matchFields: ['phone'],
      }
    }

    const clientEmail = normalizeEmail(client.email)
    if (rowEmail && clientEmail && rowEmail === clientEmail) {
      return {
        matchLevel: 'medium',
        status: 'possible_duplicate',
        confidence: 'medium',
        suggestedAction: 'merge',
        matchReason: `E-mail idêntico ao do cliente "${client.name}"`,
        existingClientId: client.id,
        existingClientName: client.name,
        matchFields: ['email'],
      }
    }
  }

  // ── LEVEL 3: SOFT MATCH ─────────────────────────────────────────────────
  if (rowName && rowCity) {
    for (const client of existing) {
      const clientCity = (client.city ?? '').trim().toLowerCase()
      if (!clientCity || clientCity !== rowCity) continue
      const sim = diceSimilarity(rowName, client.name)
      if (sim >= SOFT_MATCH_NAME_THRESHOLD) {
        return {
          matchLevel: 'soft',
          status: 'possible_duplicate',
          confidence: 'low',
          suggestedAction: 'import',
          matchReason: `Nome similar (${Math.round(sim * 100)}%) ao cliente "${client.name}" na mesma cidade`,
          existingClientId: client.id,
          existingClientName: client.name,
          matchFields: ['name', 'city'],
        }
      }
    }
  }

  return {
    matchLevel: 'none',
    status: 'new',
    confidence: 'high',
    suggestedAction: 'import',
    matchReason: null,
    existingClientId: null,
    existingClientName: null,
    matchFields: [],
  }
}

export interface AnalyzedImportRow extends ImportRow {
  rowIndex: number
  dedupResult: DuplicateCheckResult
  /** Whether this row is currently selected for import */
  selected: boolean
  /** User override for suggested action */
  userAction: SuggestedAction
}

/**
 * Analyze all import rows against existing clients in one pass.
 */
export function analyzeImportRows(
  rows: ImportRow[],
  existing: ExistingClientSlim[],
): AnalyzedImportRow[] {
  return rows.map((row, index) => {
    const dedupResult = checkDuplicateLocal(row, existing)
    // Default selection: auto-select only "new" rows
    const selected = dedupResult.status === 'new'
    return {
      ...row,
      rowIndex: index,
      dedupResult,
      selected,
      userAction: dedupResult.suggestedAction,
    }
  })
}
