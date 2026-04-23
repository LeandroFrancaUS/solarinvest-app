import { getProposal, listProposals } from '../lib/api/proposalsApi'
import { filterSavedProposals, sortSavedProposals } from '../lib/proposals/proposalSearch'
import { normalizeSavedProposalRecord } from '../lib/proposals/normalizers'
import type { ProposalSearchParams, SavedProposalRecord, SearchSavedProposalsResponse } from '../lib/proposals/types'

const DEFAULT_LIMIT = 20

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num))
}

export async function searchSavedProposals(params: ProposalSearchParams = {}): Promise<SearchSavedProposalsResponse> {
  const page = params.page ?? 1
  const limit = clamp(params.limit ?? DEFAULT_LIMIT, 1, 100)

  const res = await listProposals({ page, limit })
  const normalized = res.data.map(normalizeSavedProposalRecord)
  const filtered = sortSavedProposals(filterSavedProposals(normalized, params))

  return {
    items: filtered,
    total: res.pagination.total,
    page: res.pagination.page,
    limit: res.pagination.limit,
  }
}

export async function getSavedProposalRecord(recordId: string): Promise<SavedProposalRecord | null> {
  const proposal = await getProposal(recordId)
  if (!proposal) return null
  return normalizeSavedProposalRecord(proposal)
}

export async function findSavedProposalByExactCode(code: string): Promise<SavedProposalRecord | null> {
  const needle = code.trim().toLowerCase()
  if (!needle) return null

  for (let page = 1; page <= 5; page += 1) {
    const res = await listProposals({ page, limit: 100 })
    const match = res.data
      .map(normalizeSavedProposalRecord)
      .find((item) => item.code.trim().toLowerCase() === needle)
    if (match) return match
    if (page >= res.pagination.pages) break
  }

  return null
}

export function getSavedProposalPreviewUrl(record: SavedProposalRecord): string | null {
  return record.previewUrl ?? record.fileUrl ?? null
}

export function getSavedProposalDownloadUrl(record: SavedProposalRecord): string | null {
  return record.fileUrl ?? null
}

export function openSavedProposalPreview(record: SavedProposalRecord): void {
  const url = getSavedProposalPreviewUrl(record)
  if (!url || typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function downloadSavedProposal(record: SavedProposalRecord): Promise<void> {
  const url = getSavedProposalDownloadUrl(record)

  if (url && typeof window !== 'undefined') {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noreferrer noopener'
    anchor.download = `${record.code || 'proposta'}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    return
  }

  const blob = new Blob([JSON.stringify(record.payload ?? {}, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${record.code || 'proposta'}.json`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}
