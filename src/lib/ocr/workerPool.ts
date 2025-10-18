import type { RecognizeResult, WorkerImageInput } from './workerTypes'

export type OcrProgressUpdate = {
  progress: number
  status: string
}

export type RecognizeImageDataOptions = {
  onProgress?: (update: OcrProgressUpdate) => void
}

const OCR_TIMEOUT_MS = 120_000

export class OcrError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'OcrError'
  }
}

const TESSERACT_CDN =
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.esm.min.js'

let workerPromise: Promise<import('./workerTypes').TesseractWorker> | null = null
let processing = false
const queue: Array<{
  imageData: ImageData
  resolve: (result: RecognizeResult) => void
  reject: (error: unknown) => void
  options?: RecognizeImageDataOptions
  attempt: number
}> = []
let currentTask: { options?: RecognizeImageDataOptions } | null = null

async function loadTesseractModule(): Promise<import('./workerTypes').TesseractModule | null> {
  if (typeof window === 'undefined') {
    return null
  }
  const module = (await import(
    /* @vite-ignore */ TESSERACT_CDN,
  )) as import('./workerTypes').TesseractModule
  return module
}

function resolveAssetPath(asset: string): string {
  if (typeof window === 'undefined') {
    return asset
  }
  const local = `/tesseract/${asset}`
  return new URL(local, window.location.origin).href
}

async function createWorker(): Promise<import('./workerTypes').TesseractWorker> {
  const module = await loadTesseractModule()
  const createWorkerFn = module?.createWorker ?? module?.default?.createWorker
  if (!createWorkerFn) {
    throw new OcrError('Tesseract.js indisponível')
  }
  const worker = await createWorkerFn({
    workerPath: resolveAssetPath('worker.min.js'),
    corePath: resolveAssetPath('tesseract-core.wasm.js'),
    langPath: resolveAssetPath('lang-data'),
    logger: (message: { progress?: number; status?: string }) => {
      if (!currentTask?.options?.onProgress) return
      if (typeof message?.progress !== 'number') return
      currentTask.options.onProgress({
        progress: message.progress,
        status: message.status ?? 'processing',
      })
    },
  })
  await worker.load()
  await worker.loadLanguage('por')
  await worker.initialize('por')
  return worker
}

async function getWorker(): Promise<import('./workerTypes').TesseractWorker> {
  if (!workerPromise) {
    workerPromise = createWorker()
  }
  return workerPromise
}

async function processQueue(): Promise<void> {
  if (processing) {
    return
  }
  processing = true
  while (queue.length) {
    const task = queue.shift()!
    currentTask = task.options ? { options: task.options } : {}
    try {
      const result = await runRecognition(task)
      task.resolve(result)
    } catch (error) {
      task.reject(error)
    } finally {
      currentTask = null
    }
  }
  processing = false
}

async function runRecognition(
  task: {
    imageData: ImageData
    options?: RecognizeImageDataOptions
    attempt: number
  },
  input?: import('./workerTypes').WorkerImageInput,
): Promise<RecognizeResult> {
  const worker = await getWorker()
  try {
    const payload = input ?? toWorkerImageInput(task.imageData)
    const race = Promise.race([
      worker.recognize(payload),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new OcrError('Tempo limite excedido no OCR'))
        }, OCR_TIMEOUT_MS)
      }),
    ]) as Promise<RecognizeResult>
    return await race
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'DataCloneError'
    ) {
      if (task.attempt === 0) {
        const cloned = cloneImageData(task.imageData)
        const retryTask: { imageData: ImageData; attempt: number; options?: RecognizeImageDataOptions } = {
          imageData: cloned,
          attempt: 1,
        }
        if (task.options) {
          retryTask.options = task.options
        }
        return runRecognition(retryTask)
      }
      if (task.attempt === 1) {
        const dataUrl = imageDataToDataUrl(task.imageData)
        const retryTask: {
          imageData: ImageData
          attempt: number
          options?: RecognizeImageDataOptions
        } = {
          imageData: task.imageData,
          attempt: 2,
        }
        if (task.options) {
          retryTask.options = task.options
        }
        return runRecognition(retryTask, dataUrl)
      }
    }
    if (error instanceof OcrError) {
      await resetWorker()
    }
    throw error
  }
}

function cloneImageData(imageData: ImageData): ImageData {
  const { width, height, data } = imageData
  const transferable = data.buffer.slice(0)
  const buffer = new Uint8ClampedArray(transferable)
  return new ImageData(buffer, width, height)
}

function imageDataToDataUrl(imageData: ImageData): string {
  if (typeof document === 'undefined') {
    throw new OcrError('Conversão de imagem indisponível no ambiente atual')
  }
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new OcrError('Contexto 2D indisponível para conversão de imagem')
  }
  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function toWorkerImageInput(imageData: ImageData): WorkerImageInput {
  const { data, width, height } = imageData
  const cloned = new Uint8ClampedArray(data)
  return { data: cloned, width, height }
}

async function resetWorker(): Promise<void> {
  if (!workerPromise) return
  try {
    const worker = await workerPromise
    await worker.terminate()
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.error('Erro ao finalizar worker OCR', error)
    }
  } finally {
    workerPromise = null
  }
}

export async function recognizeImageData(
  imageData: ImageData,
  options?: RecognizeImageDataOptions,
): Promise<RecognizeResult> {
  if (!(imageData instanceof ImageData)) {
    throw new OcrError('Entrada inválida para OCR')
  }
  const safeImageData = cloneImageData(imageData)
  return new Promise<RecognizeResult>((resolve, reject) => {
    const task: {
      imageData: ImageData
      resolve: (result: RecognizeResult) => void
      reject: (error: unknown) => void
      attempt: number
      options?: RecognizeImageDataOptions
    } = {
      imageData: safeImageData,
      resolve,
      reject,
      attempt: 0,
    }
    if (options) {
      task.options = options
    }
    queue.push(task)
    void processQueue()
  })
}

export async function disposeOcrWorker(): Promise<void> {
  await resetWorker()
}
