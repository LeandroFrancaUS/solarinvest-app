const PROPOSAL_ID_PREFIX = 'SLRINVST-'
const PROPOSAL_ID_PATTERN = /^SLRINVST-[A-Z0-9]{6}$/

export function makeProposalId(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${PROPOSAL_ID_PREFIX}${random}`
}

export function ensureProposalId(candidate?: string | null): string {
  const normalized = candidate?.toString().trim().toUpperCase() ?? ''
  if (PROPOSAL_ID_PATTERN.test(normalized)) {
    return normalized
  }
  return makeProposalId()
}
