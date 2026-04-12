export type SanitizedClientRow = {
  consultor?: string | null
  comissao?: number | null
  modalidade?: string | null
  termoMeses?: number | null
  contratacao?: string | null
  nomeRazaoSocial: string | null
  cpfCnpj?: string | null
  email?: string | null
  telefone?: string | null
  cidade?: string | null
  uf?: string | null
  potenciaKwp?: number | null
  tipoRede?: string | null
  kwhContratado?: number | null
  tarifaAtual?: number | null
  descontoPct?: number | null
  dataVencimentoDia?: number | null
  mensalidade?: number | null
  diaLeitura?: string | null
  dataComissionamento?: string | null
  marcaInversor?: string | null
  inicioMensalidade?: string | null
}

export const FORBIDDEN_EXACT_VALUES = new Set([
  '[object Object]',
  'object Object',
  'NaN',
  'undefined',
  'null',
  '',
  '-',
  '--',
  'ℹ📁🗑',
])

const FORBIDDEN_PATTERNS = [
  /^\s*0\s*$/,
  /^\s*0(?:\s+0)+\s*$/,
  /^[\u2139\uD83D\uDCC1\uD83D\uDDD1\s]+$/,
  /^\[object\s+Object\]$/i,
  /^object\s+object$/i,
  /^[\W_]+$/,
]

const normalizeKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

export function sanitizeText(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (FORBIDDEN_EXACT_VALUES.has(s)) return null
  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(s))) return null
  return s
}

export function sanitizeCpfCnpj(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 11 || digits.length === 14) return digits
  return null
}

export function sanitizePhone(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) return null
  return digits
}

export function sanitizeEmail(value: unknown): string | null {
  const s = sanitizeText(value)?.toLowerCase()
  if (!s) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null
  return s
}

export function splitCidadeUf(value: unknown): { cidade: string | null; uf: string | null } {
  const s = sanitizeText(value)
  if (!s) return { cidade: null, uf: null }
  const [cidadeRaw, ufRaw] = s.split('/')
  const cidade = sanitizeText(cidadeRaw)
  const uf = sanitizeText(ufRaw)?.toUpperCase() ?? null
  return { cidade, uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : null }
}

function toNumberFlexible(value: unknown): number | null {
  const s = sanitizeText(value)
  if (!s) return null
  const normalized = s.replace(',', '.').replace(/[^0-9.-]/g, '')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

export function sanitizePotenciaKwp(value: unknown): number | null {
  const s = sanitizeText(value)
  if (!s) return null
  const n = toNumberFlexible(s.replace(/kwp/i, '').trim())
  return n && n > 0 ? n : null
}

const safeDate = (value: unknown): string | null => {
  const s = sanitizeText(value)
  if (!s || /^aguardando$/i.test(s)) return null
  const date = new Date(s)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const key of Object.keys(row)) {
    const keyNorm = normalizeKey(key)
    if (aliases.includes(keyNorm)) return row[key]
  }
  return null
}

export function hasBusinessValue(row: SanitizedClientRow): boolean {
  if (!row.nomeRazaoSocial) return false
  const useful = [row.cpfCnpj, row.telefone, row.email, row.cidade, row.kwhContratado, row.mensalidade, row.modalidade]
  return useful.some((v) => v !== null && v !== undefined && v !== '')
}

export function buildClientFingerprint(row: SanitizedClientRow): string | null {
  if (row.cpfCnpj) return `doc:${row.cpfCnpj}`
  if (row.telefone) return `phone:${row.telefone}`
  if (row.nomeRazaoSocial && row.cidade) return `namecity:${normalizeKey(row.nomeRazaoSocial)}|${normalizeKey(row.cidade)}`
  if (row.nomeRazaoSocial) return `name:${normalizeKey(row.nomeRazaoSocial)}`
  return null
}

export function completenessScore(row: SanitizedClientRow): number {
  let score = 0
  if (row.nomeRazaoSocial) score += 5
  if (row.cpfCnpj) score += 5
  if (row.telefone) score += 3
  if (row.email) score += 3
  if (row.cidade) score += 2
  if (row.uf) score += 1
  if (row.kwhContratado) score += 2
  if (row.mensalidade) score += 2
  if (row.modalidade) score += 1
  return score
}

export function sanitizeClientRow(raw: Record<string, unknown>): SanitizedClientRow {
  const { cidade, uf } = splitCidadeUf(pick(raw, ['cidadeuf', 'cidade']))
  return {
    consultor: sanitizeText(pick(raw, ['consultorindicacao', 'consultor'])),
    comissao: toNumberFlexible(pick(raw, ['comissao'])),
    modalidade: sanitizeText(pick(raw, ['modalidade'])),
    termoMeses: toNumberFlexible(pick(raw, ['termomeses', 'termo'])) ?? null,
    contratacao: safeDate(pick(raw, ['contratacao'])),
    nomeRazaoSocial: sanitizeText(pick(raw, ['cliente', 'nomerazaosocial', 'nome'])),
    cpfCnpj: sanitizeCpfCnpj(pick(raw, ['cpf', 'cnpj', 'cpfcnpj', 'documento'])),
    email: sanitizeEmail(pick(raw, ['email'])),
    telefone: sanitizePhone(pick(raw, ['telefone', 'celular'])),
    cidade,
    uf,
    potenciaKwp: sanitizePotenciaKwp(pick(raw, ['potencia', 'potenciakwp'])),
    tipoRede: sanitizeText(pick(raw, ['rede', 'tiporede'])),
    kwhContratado: toNumberFlexible(pick(raw, ['kwhcontratado'])),
    tarifaAtual: toNumberFlexible(pick(raw, ['tarifaatual'])),
    descontoPct: toNumberFlexible(pick(raw, ['desconto'])),
    dataVencimentoDia: toNumberFlexible(pick(raw, ['datadevencimento', 'vencimento'])),
    mensalidade: toNumberFlexible(pick(raw, ['mensalidade'])),
    diaLeitura: safeDate(pick(raw, ['diadaleitura'])),
    dataComissionamento: safeDate(pick(raw, ['datacomissionamento'])),
    marcaInversor: sanitizeText(pick(raw, ['marcadoinversor', 'marcainversor'])),
    inicioMensalidade: safeDate(pick(raw, ['iniciodamensalidade'])),
  }
}

export function sanitizeAndDeduplicateClients(rows: Record<string, unknown>[]): {
  clients: SanitizedClientRow[]
  discarded: Array<{ reason: string }>
} {
  const byFingerprint = new Map<string, SanitizedClientRow>()
  const discarded: Array<{ reason: string }> = []

  for (const row of rows) {
    const sanitized = sanitizeClientRow(row)
    if (!hasBusinessValue(sanitized)) {
      discarded.push({ reason: 'linha sem valor de negócio' })
      continue
    }
    const fingerprint = buildClientFingerprint(sanitized)
    if (!fingerprint) {
      discarded.push({ reason: 'sem fingerprint' })
      continue
    }
    const current = byFingerprint.get(fingerprint)
    if (!current) {
      byFingerprint.set(fingerprint, sanitized)
      continue
    }
    if (completenessScore(sanitized) > completenessScore(current)) {
      byFingerprint.set(fingerprint, sanitized)
      discarded.push({ reason: 'duplicata menos completa' })
    } else {
      discarded.push({ reason: 'duplicata menos completa' })
    }
  }

  return { clients: Array.from(byFingerprint.values()), discarded }
}
