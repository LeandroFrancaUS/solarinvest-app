const PROPOSAL_ID_PREFIX = 'SLRINVST-'
const PROPOSAL_ID_PATTERNS = [
  /^SLRINVST-[A-Z0-9]{6}$/,
  /^SLRINVST-\d{8}$/,
  /^SLRINVST-VND-\d{8}$/,
  /^SLRINVST-LSE-\d{8}$/,
]

const isValidProposalId = (candidate: string): boolean =>
  PROPOSAL_ID_PATTERNS.some((pattern) => pattern.test(candidate))

export function makeProposalId(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${PROPOSAL_ID_PREFIX}${random}`
}

export function ensureProposalId(candidate?: string | null): string {
  const normalized = candidate?.toString().trim().toUpperCase() ?? ''
  if (isValidProposalId(normalized)) {
    return normalized
  }
  return makeProposalId()
}

export function normalizeProposalId(candidate?: string | null): string {
  const normalized = candidate?.toString().trim().toUpperCase() ?? ''
  return isValidProposalId(normalized) ? normalized : ''
}
