export type RecognizeResult = {
  data: {
    text: string
  }
}

export type WorkerImageInput =
  | ImageData
  | {
      data: Uint8ClampedArray
      width: number
      height: number
    }
  | string

export type TesseractWorker = {
  load: () => Promise<void>
  loadLanguage: (lang: string) => Promise<void>
  initialize: (lang: string) => Promise<void>
  recognize: (image: WorkerImageInput) => Promise<RecognizeResult>
  terminate: () => Promise<void>
}

export type TesseractModule = {
  createWorker?: (options: Record<string, unknown>) => Promise<TesseractWorker>
  default?: {
    createWorker?: (options: Record<string, unknown>) => Promise<TesseractWorker>
  }
}
