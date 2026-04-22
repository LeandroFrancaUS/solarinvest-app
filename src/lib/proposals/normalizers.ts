import type { ProposalRow } from '../api/proposalsApi'
import type { SavedProposalRecord } from './types'

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function payloadString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function extractProposalFileUrl(payload: Record<string, unknown>): string | null {
  return pickFirstString(
    payloadString(payload, ['fileUrl', 'pdfUrl', 'downloadUrl', 'proposalFileUrl', 'documentUrl']),
  )
}

export function normalizeSavedProposalRecord(row: ProposalRow): SavedProposalRecord {
  const payload = row.payload_json ?? null
  const payloadObj = payload && typeof payload === 'object' ? payload : null
  const fileUrl = payloadObj ? extractProposalFileUrl(payloadObj) : null
  return {
    id: row.id,
    code: row.proposal_code ?? row.id,
    clientName: row.client_name,
    document: row.client_document,
    phone: row.client_phone,
    email: row.client_email,
    address: payloadObj ? payloadString(payloadObj, ['endereco', 'address', 'clientAddress']) : null,
    city: row.client_city,
    state: row.client_state,
    createdAt: row.created_at,
    proposalType: row.proposal_type,
    status: row.status,
    previewUrl: fileUrl,
    fileUrl,
    payload: payloadObj,
  }
}
