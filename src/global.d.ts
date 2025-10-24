export {}

import type { BudgetSnapshotPayload } from './types/budgetSnapshot'

type SolarInvestOneDriveBridgePayload = {
  folderPath: string
  fileName: string
  content: string
}

type SolarInvestOneDriveBridgeResult =
  | void
  | boolean
  | { success?: boolean; message?: string }

type SolarInvestOneDriveBridge = (
  payload: SolarInvestOneDriveBridgePayload,
) => SolarInvestOneDriveBridgeResult | Promise<SolarInvestOneDriveBridgeResult>

type SolarInvestProposalPdfBridgePayload = {
  html: string
  fileName: string
  budgetId?: string
  clientName?: string
  proposalType?: string
  metadata?: Record<string, unknown>
}

type SolarInvestProposalPdfBridgeResult =
  | void
  | boolean
  | { success?: boolean; message?: string }

type SolarInvestProposalPdfBridge = (
  payload: SolarInvestProposalPdfBridgePayload,
) => SolarInvestProposalPdfBridgeResult | Promise<SolarInvestProposalPdfBridgeResult>

type SolarInvestBudgetSnapshotBridgeResult =
  | void
  | boolean
  | { success?: boolean; message?: string }

type SolarInvestBudgetSnapshotBridge = (
  payload: BudgetSnapshotPayload,
) => SolarInvestBudgetSnapshotBridgeResult | Promise<SolarInvestBudgetSnapshotBridgeResult>

declare global {
  interface Window {
    solarinvestNative?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      savePdf?: SolarInvestProposalPdfBridge
      saveBudgetSnapshot?: SolarInvestBudgetSnapshotBridge
      saveBudget?: SolarInvestBudgetSnapshotBridge
    }
    solarinvestOneDrive?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      savePdf?: SolarInvestProposalPdfBridge
      saveBudgetSnapshot?: SolarInvestBudgetSnapshotBridge
    }
    solarinvestFiles?: {
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      savePdf?: SolarInvestProposalPdfBridge
      saveBudgetSnapshot?: SolarInvestBudgetSnapshotBridge
    }
    electronAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      saveBudgetSnapshot?: SolarInvestBudgetSnapshotBridge
    }
    desktopAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      saveBudgetSnapshot?: SolarInvestBudgetSnapshotBridge
    }
    saveClientToOneDrive?: SolarInvestOneDriveBridge
    saveProposalPdf?: SolarInvestProposalPdfBridge
    saveBudgetSnapshot?: SolarInvestBudgetSnapshotBridge
  }

  interface ImportMetaEnv {
    readonly VITE_ONEDRIVE_SYNC_ENDPOINT?: string
    readonly VITE_PROPOSAL_PDF_ENDPOINT?: string
    readonly VITE_BUDGET_SNAPSHOT_ENDPOINT?: string
    readonly VITE_ANEEL_DIRECT_ORIGIN?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
