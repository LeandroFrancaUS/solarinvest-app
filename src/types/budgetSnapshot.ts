import type { PrintableProposalProps } from './printableProposal'
import type { PageSharedSettingsSnapshot } from './pageSharedSettings'
import type { VendasConfig } from './vendasConfig'
import type { VendaSnapshot } from '../store/useVendaStore'
import type { LeasingState } from '../store/useLeasingStore'

export type BudgetSnapshotPayload = {
  id: string
  savedAt: string
  clientId?: string | null
  clientDocument?: string | null
  clientName: string
  clientCity?: string | null
  clientState?: string | null
  clientUc?: string | null
  printable: PrintableProposalProps
  pageState: PageSharedSettingsSnapshot
  vendaState: VendaSnapshot
  leasingState: LeasingState
  vendasConfig: VendasConfig
}

export type PersistBudgetSnapshotResult = {
  persisted: boolean
  message?: string
}
