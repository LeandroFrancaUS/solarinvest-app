import { createStore } from './createStore'
import { ensureProposalId, normalizeProposalId } from '../lib/ids'
import type { PrintableProposalProps } from '../types/printableProposal'

type PrintableProposalRecord = {
  id: string
  dados: PrintableProposalProps
  updatedAt: number
}

type PrintableProposalsState = {
  records: Record<string, PrintableProposalRecord>
  setProposal: (proposalId: string | null | undefined, dados: PrintableProposalProps) => string
  getProposal: (proposalId: string | null | undefined) => PrintableProposalRecord | undefined
  removeProposal: (proposalId: string | null | undefined) => void
  clearOlderThan: (timestamp: number) => void
}

const sanitizeLookupKey = (proposalId: string | null | undefined): string | null => {
  const normalized = normalizeProposalId(proposalId)
  if (normalized) {
    return normalized
  }
  const trimmed = proposalId?.toString().trim().toUpperCase()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

const resolveProposalKey = (proposalId: string | null | undefined, fallback?: string): string => {
  const lookup = sanitizeLookupKey(proposalId)
  if (lookup) {
    return lookup
  }
  if (fallback) {
    const fallbackLookup = sanitizeLookupKey(fallback)
    if (fallbackLookup) {
      return fallbackLookup
    }
  }
  return ensureProposalId()
}

export const usePrintableProposalsStore = createStore<PrintableProposalsState>((set, get) => ({
  records: {},
  setProposal: (proposalId, dados) => {
    const key = resolveProposalKey(proposalId ?? dados.budgetId)
    const normalizedData: PrintableProposalProps = {
      ...dados,
      budgetId: key,
    }

    set((state) => ({
      records: {
        ...state.records,
        [key]: {
          id: key,
          dados: normalizedData,
          updatedAt: Date.now(),
        },
      },
    }))

    return key
  },
  getProposal: (proposalId) => {
    const key = sanitizeLookupKey(proposalId)
    if (!key) {
      return undefined
    }
    return get().records[key]
  },
  removeProposal: (proposalId) => {
    const key = sanitizeLookupKey(proposalId)
    if (!key) {
      return
    }
    set((state) => {
      if (!state.records[key]) {
        return state
      }
      const nextRecords = { ...state.records }
      delete nextRecords[key]
      return {
        ...state,
        records: nextRecords,
      }
    })
  },
  clearOlderThan: (timestamp) => {
    set((state) => {
      const nextRecords: Record<string, PrintableProposalRecord> = {}
      Object.values(state.records).forEach((record) => {
        if (record.updatedAt >= timestamp) {
          nextRecords[record.id] = record
        }
      })
      if (Object.keys(nextRecords).length === Object.keys(state.records).length) {
        return state
      }
      return {
        ...state,
        records: nextRecords,
      }
    })
  },
}))
