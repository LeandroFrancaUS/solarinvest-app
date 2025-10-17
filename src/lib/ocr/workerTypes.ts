export type RecognizeResult = {
  data: {
    text: string
  }
}

export type TesseractWorker = {
  load: () => Promise<void>
  loadLanguage: (lang: string) => Promise<void>
  initialize: (lang: string) => Promise<void>
  recognize: (image: ImageData) => Promise<RecognizeResult>
  terminate: () => Promise<void>
}

export type TesseractModule = {
  createWorker?: (options: Record<string, unknown>) => Promise<TesseractWorker>
  default?: {
    createWorker?: (options: Record<string, unknown>) => Promise<TesseractWorker>
  }
}
