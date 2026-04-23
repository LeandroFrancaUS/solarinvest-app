import type { ContractProposalOriginLink, SavedProposalRecord } from './types'

export function createProposalOriginLink(record: SavedProposalRecord): ContractProposalOriginLink {
  return {
    proposalOriginRecordId: record.id,
    proposalOriginCode: record.code,
    proposalOriginClientName: record.clientName ?? null,
    proposalOriginCreatedAt: record.createdAt ?? null,
    proposalOriginType: record.proposalType ?? null,
    proposalOriginPreviewUrl: record.previewUrl ?? null,
    proposalOriginDownloadUrl: record.fileUrl ?? null,
  }
}

export function hydrateProposalOrigin(contract: Record<string, unknown>) {
  const proposalOriginCode =
    (typeof contract.proposalOriginCode === 'string' && contract.proposalOriginCode) ||
    (typeof contract.source_proposal_code === 'string' && contract.source_proposal_code) ||
    (typeof contract.source_proposal_id === 'string' && contract.source_proposal_id) ||
    null

  const proposalOriginRecordId =
    (typeof contract.proposalOriginRecordId === 'string' && contract.proposalOriginRecordId) ||
    (typeof contract.source_proposal_record_id === 'string' && contract.source_proposal_record_id) ||
    null

  return {
    proposalOriginRecordId,
    proposalOriginCode,
    proposalOriginClientName:
      (typeof contract.proposalOriginClientName === 'string' && contract.proposalOriginClientName) || null,
    proposalOriginCreatedAt:
      (typeof contract.proposalOriginCreatedAt === 'string' && contract.proposalOriginCreatedAt) || null,
    proposalOriginType: (typeof contract.proposalOriginType === 'string' && contract.proposalOriginType) || null,
    proposalOriginPreviewUrl:
      (typeof contract.proposalOriginPreviewUrl === 'string' && contract.proposalOriginPreviewUrl) || null,
    proposalOriginDownloadUrl:
      (typeof contract.proposalOriginDownloadUrl === 'string' && contract.proposalOriginDownloadUrl) || null,
  }
}

export function validateProposalOriginLink(link: ContractProposalOriginLink | null): { valid: boolean; reason?: string } {
  if (!link) return { valid: true }
  if (!link.proposalOriginRecordId) return { valid: false, reason: 'proposalOriginRecordId ausente' }
  if (!link.proposalOriginCode) return { valid: false, reason: 'proposalOriginCode ausente' }
  return { valid: true }
}

export async function resolveLegacyProposalOrigin<T extends Record<string, unknown>>(
  contract: T,
  findByCode: (code: string) => Promise<SavedProposalRecord | null>,
): Promise<T & { proposalOriginRecordId?: string; proposalOriginCode?: string }> {
  const currentRecordId = typeof contract.proposalOriginRecordId === 'string' ? contract.proposalOriginRecordId : null
  if (currentRecordId) return contract

  const code =
    (typeof contract.proposalOriginCode === 'string' && contract.proposalOriginCode) ||
    (typeof contract.source_proposal_id === 'string' && contract.source_proposal_id) ||
    null

  if (!code) return contract

  const match = await findByCode(code)
  if (!match) return contract

  return {
    ...contract,
    proposalOriginRecordId: match.id,
    proposalOriginCode: match.code,
  }
}
