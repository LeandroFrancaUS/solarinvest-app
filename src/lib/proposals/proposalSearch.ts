import type { ProposalSearchParams, SavedProposalRecord } from './types'

function norm(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function includesText(value: string | null | undefined, query: string): boolean {
  return norm(value).includes(query)
}

function inDateRange(createdAt: string | null | undefined, from?: string, to?: string): boolean {
  if (!createdAt) return true
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return true
  if (from) {
    const fromDate = new Date(from)
    if (!Number.isNaN(fromDate.getTime()) && created < fromDate) return false
  }
  if (to) {
    const toDate = new Date(to)
    if (!Number.isNaN(toDate.getTime()) && created > toDate) return false
  }
  return true
}

export function filterSavedProposals(items: SavedProposalRecord[], params: ProposalSearchParams): SavedProposalRecord[] {
  const query = norm(params.query)
  return items.filter((item) => {
    if (params.type && params.type !== 'all' && item.proposalType !== params.type) return false
    if (params.code && !includesText(item.code, norm(params.code))) return false
    if (params.clientName && !includesText(item.clientName, norm(params.clientName))) return false
    if (params.document && !includesText(item.document, norm(params.document))) return false
    if (params.phone && !includesText(item.phone, norm(params.phone))) return false
    if (params.email && !includesText(item.email, norm(params.email))) return false
    if (params.address && !includesText(item.address, norm(params.address))) return false
    if (params.cityOrState) {
      const needle = norm(params.cityOrState)
      if (!includesText(item.city, needle) && !includesText(item.state, needle)) return false
    }
    if (!inDateRange(item.createdAt, params.createdAtFrom, params.createdAtTo)) return false
    if (!query) return true

    return [
      item.code,
      item.clientName,
      item.document,
      item.phone,
      item.email,
      item.address,
      item.city,
      item.state,
      item.createdAt,
      item.proposalType,
      item.status,
    ].some((candidate) => includesText(candidate, query))
  })
}

export function sortSavedProposals(items: SavedProposalRecord[]): SavedProposalRecord[] {
  return [...items].sort((a, b) => {
    const aDate = a.createdAt ? Date.parse(a.createdAt) : 0
    const bDate = b.createdAt ? Date.parse(b.createdAt) : 0
    return bDate - aDate
  })
}
