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

type SolarInvestProposalPdfPayload = {
  folderPath: string
  fileName: string
  html: string
  metadata: {
    clienteId: string
    clienteNome: string
    clienteCidade: string
    clienteUf: string
    budgetId: string
  }
}

type SolarInvestProposalPdfResult = void | boolean | { success?: boolean; message?: string }

type SolarInvestProposalPdfBridge = (
  payload: SolarInvestProposalPdfPayload,
) => SolarInvestProposalPdfResult | Promise<SolarInvestProposalPdfResult>

declare global {
  interface Window {
    solarinvestNative?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
    }
    solarinvestOneDrive?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
    }
    electronAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
    }
    desktopAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveProposalPdf?: SolarInvestProposalPdfBridge
    }
    saveClientToOneDrive?: SolarInvestOneDriveBridge
    saveProposalPdf?: SolarInvestProposalPdfBridge
  }

  interface ImportMetaEnv {
    readonly VITE_ONEDRIVE_SYNC_ENDPOINT?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
