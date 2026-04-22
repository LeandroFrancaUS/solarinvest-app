export type ProposalCategory = 'leasing' | 'venda' | 'all'

export interface ProposalSearchParams {
  query?: string
  code?: string
  clientName?: string
  document?: string
  phone?: string
  email?: string
  address?: string
  cityOrState?: string
  createdAtFrom?: string
  createdAtTo?: string
  type?: ProposalCategory
  page?: number
  limit?: number
}

export interface SavedProposalRecord {
  id: string
  code: string
  clientName?: string | null
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  createdAt?: string | null
  proposalType?: string | null
  status?: string | null
  previewUrl?: string | null
  fileUrl?: string | null
  payload?: Record<string, unknown> | null
}

export interface SearchSavedProposalsResponse {
  items: SavedProposalRecord[]
  total: number
  page: number
  limit: number
}

export interface ContractProposalOriginLink {
  proposalOriginRecordId: string
  proposalOriginCode: string
  proposalOriginClientName?: string | null
  proposalOriginCreatedAt?: string | null
  proposalOriginType?: string | null
  proposalOriginPreviewUrl?: string | null
  proposalOriginDownloadUrl?: string | null
}
