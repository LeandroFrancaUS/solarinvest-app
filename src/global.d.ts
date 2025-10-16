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

declare global {
  interface Window {
    solarinvestNative?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
    }
    solarinvestOneDrive?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
      saveClient?: SolarInvestOneDriveBridge
    }
    electronAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
    }
    desktopAPI?: {
      saveClientToOneDrive?: SolarInvestOneDriveBridge
    }
    saveClientToOneDrive?: SolarInvestOneDriveBridge
  }

  interface ImportMetaEnv {
    readonly VITE_ONEDRIVE_SYNC_ENDPOINT?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
