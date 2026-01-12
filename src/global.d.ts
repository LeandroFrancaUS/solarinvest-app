export {}

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

type SolarInvestOneDriveLoadBridgeResult =
  | void
  | string
  | unknown[]
  | { success?: boolean; message?: string; content?: unknown; clientes?: unknown }

type SolarInvestOneDriveLoadBridge = () =>
  | SolarInvestOneDriveLoadBridgeResult
  | Promise<SolarInvestOneDriveLoadBridgeResult>

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

declare global {
  interface Window {
    solarinvestNative?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
      loadClientsFromOneDrive?: SolarInvestOneDriveLoadBridge
      loadClients?: SolarInvestOneDriveLoadBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      savePdf?: SolarInvestProposalPdfBridge
    }
    solarinvestOneDrive?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
      loadClientsFromOneDrive?: SolarInvestOneDriveLoadBridge
      loadClients?: SolarInvestOneDriveLoadBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      savePdf?: SolarInvestProposalPdfBridge
    }
    solarinvestFiles?: {
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
      savePdf?: SolarInvestProposalPdfBridge
    }
    electronAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      loadClientsFromOneDrive?: SolarInvestOneDriveLoadBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
    }
    desktopAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      loadClientsFromOneDrive?: SolarInvestOneDriveLoadBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
      saveProposal?: SolarInvestProposalPdfBridge
    }
    saveClientToOneDrive?: SolarInvestOneDriveBridge
    loadClientsFromOneDrive?: SolarInvestOneDriveLoadBridge
    saveProposalPdf?: SolarInvestProposalPdfBridge
  }

  interface ImportMetaEnv {
    readonly VITE_ONEDRIVE_SYNC_ENDPOINT?: string
    readonly VITE_PROPOSAL_PDF_ENDPOINT?: string
    readonly VITE_ANEEL_DIRECT_ORIGIN?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
