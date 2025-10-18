import { recognizeImageData } from '../ocr/workerPool'
import type { RecognizeImageDataOptions } from '../ocr/workerPool'
import {
  parseStructuredBudget,
  type StructuredBudget,
  type StructuredItem,
} from '../../utils/structuredBudgetParser'

const PDF_MIME = 'application/pdf'
const IMAGE_MIME_REGEX = /^image\/(png|jpe?g)$/i
const PDFJS_CDN_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/'
const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024
const DEFAULT_OCR_DPI = 300
const MIN_TEXT_DENSITY = 0.00012

export type SupportedFileType = 'pdf' | 'image'

export type BudgetUploadProgressStage = 'carregando' | 'texto' | 'ocr' | 'parse'

export type BudgetUploadProgress = {
  stage: BudgetUploadProgressStage
  page: number
  totalPages: number
  progress: number
  message?: string
}

export type ParsedBudgetJSON = {
  header: {
    numeroOrcamento: string | null
    validade: string | null
    de: string | null
    para: string | null
  }
  itens: Array<{
    produto: string
    codigo: string | null
    modelo: string | null
    descricao: string
    quantidade: number | null
    unidade: 'un'
    precoUnitario: number | null
    precoTotal: number | null
  }>
  resumo: {
    valorTotal: number | null
    moeda: 'BRL'
  }
}

export type BudgetUploadResult = {
  json: ParsedBudgetJSON
  structured: StructuredBudget
  plainText: string
  pages: string[]
  usedOcr: boolean
}

export type HandleUploadOptions = {
  dpi?: number
  onProgress?: (progress: BudgetUploadProgress) => void
}

type PdfJsModule = {
  getDocument: (src: unknown) => { promise: Promise<PdfDocument> }
  GlobalWorkerOptions?: { workerSrc?: string }
}

type PdfDocument = {
  numPages: number
  getPage: (index: number) => Promise<PdfPage>
}

type PdfPage = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
  getViewport: (options: { scale: number }) => { width: number; height: number }
  render: (params: {
    canvasContext:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
    viewport: { width: number; height: number }
  }) => { promise: Promise<unknown> }
  cleanup?: () => void
}

type PdfToTextResult = {
  pages: string[]
  text: string
  usedOcr: boolean
}

class BudgetUploadError extends Error {
  constructor(public readonly code: 'file-too-large' | 'unsupported-format' | 'processing-error', message: string) {
    super(message)
    this.name = 'BudgetUploadError'
  }
}

let pdfJsLoader: Promise<PdfJsModule> | null = null
let customPdfJsLoader: (() => Promise<PdfJsModule>) | null = null

async function loadPdfJs(): Promise<PdfJsModule> {
  if (customPdfJsLoader) {
    return customPdfJsLoader()
  }
  if (!pdfJsLoader) {
    pdfJsLoader = import(
      /* @vite-ignore */ `${PDFJS_CDN_BASE}build/pdf.mjs`,
    ).then((module: PdfJsModule) => {
      if (module?.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}build/pdf.worker.mjs`
      }
      return module
    })
  }
  return pdfJsLoader
}

export function __setPdfJsModuleLoader(loader: (() => Promise<PdfJsModule>) | null): void {
  customPdfJsLoader = loader
  pdfJsLoader = null
}

function detectFileType(file: File): SupportedFileType {
  const mime = file.type
  if (mime === PDF_MIME || file.name.toLowerCase().endsWith('.pdf')) {
    return 'pdf'
  }
  if (IMAGE_MIME_REGEX.test(mime) || /\.(png|jpe?g)$/i.test(file.name)) {
    return 'image'
  }
  throw new BudgetUploadError('unsupported-format', 'Formato não suportado. Envie um PDF ou imagem (PNG/JPG).')
}

export async function handleUpload(
  file: File,
  options: HandleUploadOptions = {},
): Promise<BudgetUploadResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BudgetUploadError('file-too-large', 'O arquivo excede o limite de 40MB.')
  }

  const type = detectFileType(file)
  const dpi = options.dpi ?? DEFAULT_OCR_DPI

  const extraction =
    type === 'pdf'
      ? await pdfToText(file, { onProgress: options.onProgress, dpi })
      : await imageToText(file, { onProgress: options.onProgress })

  options.onProgress?.({
    stage: 'parse',
    page: extraction.pages.length,
    totalPages: extraction.pages.length,
    progress: 1,
    message: 'Normalizando e interpretando orçamento',
  })

  const normalizedPages = extraction.pages.map((page) => normalizeExtractedText(page))
  const text = normalizedPages.join('\n\n')
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const structured = parseStructuredBudget(lines)
  const json = convertToParsedJson(structured)

  return {
    json,
    structured,
    plainText: text,
    pages: normalizedPages,
    usedOcr: extraction.usedOcr || type === 'image',
  }
}

async function pdfToText(
  file: File,
  options: { onProgress?: (progress: BudgetUploadProgress) => void; dpi: number },
): Promise<PdfToTextResult> {
  const pdfjs = await loadPdfJs()
  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  const totalPages = pdf.numPages

  const pages: string[] = []
  let usedOcr = false

  for (let index = 1; index <= totalPages; index += 1) {
    options.onProgress?.({
      stage: 'texto',
      page: index,
      totalPages,
      progress: (index - 1) / totalPages,
      message: `Extraindo texto da página ${index}`,
    })
    const page = await pdf.getPage(index)
    const quick = await extractNativeText(page)
    let pageText = quick.text
    if (quick.density < MIN_TEXT_DENSITY || pageText.trim().length === 0) {
      usedOcr = true
      options.onProgress?.({
        stage: 'ocr',
        page: index,
        totalPages,
        progress: 0,
        message: `Executando OCR na página ${index}`,
      })
      const imageData = await rasterizePage(page, options.dpi)
      const processed = preprocessImageData(imageData)
      const result = await recognizeImageData(
        processed,
        createOcrProgressAdapter(options, index, totalPages),
      )
      pageText = result.data.text
    }
    pages.push(pageText)
    if (page.cleanup) {
      page.cleanup()
    }
  }

  return {
    pages,
    text: pages.join('\n\n'),
    usedOcr,
  }
}

async function imageToText(
  file: File,
  options: { onProgress?: (progress: BudgetUploadProgress) => void },
): Promise<PdfToTextResult> {
  if (typeof window === 'undefined') {
    throw new BudgetUploadError('processing-error', 'Processamento de imagem indisponível neste ambiente.')
  }
  const dpiMessage = 'Executando OCR na imagem enviada'
  options.onProgress?.({
    stage: 'ocr',
    page: 1,
    totalPages: 1,
    progress: 0,
    message: dpiMessage,
  })

  const imageData = await getImageDataFromFile(file)
  const processed = preprocessImageData(imageData)
  const result = await recognizeImageData(processed, {
    onProgress: (update) => {
      options.onProgress?.({
        stage: 'ocr',
        page: 1,
        totalPages: 1,
        progress: update.progress,
        message: dpiMessage,
      })
    },
  })

  return {
    pages: [result.data.text],
    text: result.data.text,
    usedOcr: true,
  }
}

async function getImageDataFromFile(file: File): Promise<ImageData> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = createCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        throw new BudgetUploadError('processing-error', 'Canvas API indisponível para OCR.')
      }
      context.drawImage(bitmap, 0, 0)
      return context.getImageData(0, 0, canvas.width, canvas.height)
    } finally {
      if (typeof bitmap.close === 'function') {
        bitmap.close()
      }
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const canvas = createCanvas(image.naturalWidth, image.naturalHeight)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new BudgetUploadError('processing-error', 'Contexto 2D indisponível para OCR.')
    }
    context.drawImage(image, 0, 0)
    return context.getImageData(0, 0, canvas.width, canvas.height)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = (event) => reject(event)
    image.src = src
  })
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(Math.ceil(width), Math.ceil(height))
  }
  if (typeof document === 'undefined') {
    throw new BudgetUploadError('processing-error', 'Canvas API indisponível no ambiente atual.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width)
  canvas.height = Math.ceil(height)
  return canvas
}

async function extractNativeText(page: PdfPage): Promise<{ text: string; density: number }> {
  const content = await page.getTextContent()
  const viewport = page.getViewport({ scale: 1 })
  const strings = content.items
    .map((item) => (typeof item.str === 'string' ? item.str : ''))
    .filter(Boolean)
  const text = strings.join('\n')
  const charCount = strings.reduce((acc, str) => acc + str.trim().length, 0)
  const area = Math.max(viewport.width * viewport.height, 1)
  const density = charCount / area
  return { text, density }
}

async function rasterizePage(page: PdfPage, dpi: number): Promise<ImageData> {
  const scale = dpi / 72
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new BudgetUploadError('processing-error', 'Contexto do canvas indisponível para OCR.')
  }
  await page.render({ canvasContext: context, viewport }).promise
  const imageData = context.getImageData(0, 0, Math.ceil(viewport.width), Math.ceil(viewport.height))
  if ('width' in canvas) {
    ;(canvas as HTMLCanvasElement).width = 0
    ;(canvas as HTMLCanvasElement).height = 0
  }
  return imageData
}

function normalizeExtractedText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
}

function convertToParsedJson(structured: StructuredBudget): ParsedBudgetJSON {
  return {
    header: {
      numeroOrcamento: sanitizeString(structured.header.numeroOrcamento),
      validade: sanitizeString(structured.header.validade),
      de: sanitizeString(structured.header.de),
      para: sanitizeString(structured.header.para),
    },
    itens: structured.itens.map((item) => normalizeItem(item)),
    resumo: {
      valorTotal: normalizeNumber(structured.resumo.valorTotal),
      moeda: 'BRL',
    },
  }
}

function normalizeItem(item: StructuredItem): ParsedBudgetJSON['itens'][number] {
  const quantidade = normalizeNumber(item.quantidade)
  return {
    produto: item.produto ?? '',
    codigo: sanitizeString(item.codigo),
    modelo: sanitizeString(item.modelo),
    descricao: item.descricao?.trim() ? item.descricao.trim() : '—',
    quantidade: quantidade !== null ? Math.round(quantidade) : null,
    unidade: item.unidade?.trim() ? item.unidade.trim() : 'un',
    precoUnitario: normalizeNumber(item.precoUnitario),
    precoTotal: normalizeNumber(item.precoTotal),
  }
}

function normalizeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (!Number.isFinite(value)) {
    return null
  }
  const rounded = Math.round(value * 100) / 100
  return Number.isFinite(rounded) ? rounded : null
}

function sanitizeString(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function createOcrProgressAdapter(
  options: { onProgress?: (progress: BudgetUploadProgress) => void },
  page: number,
  totalPages: number,
): RecognizeImageDataOptions {
  return {
    onProgress: (update) => {
      options.onProgress?.({
        stage: 'ocr',
        page,
        totalPages,
        progress: update.progress,
        message: `OCR ${Math.round(update.progress * 100)}% na página ${page}`,
      })
    },
  }
}

export {
  MAX_FILE_SIZE_BYTES,
  DEFAULT_OCR_DPI,
  BudgetUploadError,
  type BudgetUploadProgress,
  type ParsedBudgetJSON,
}

function preprocessImageData(source: ImageData): ImageData {
  const { width, height, data } = source
  const length = data.length
  if (width === 0 || height === 0 || length === 0) {
    return source
  }

  const grayscale = new Uint8ClampedArray(length)
  const histogram = new Uint32Array(256)
  for (let index = 0; index < length; index += 4) {
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const a = data[index + 3]
    const gray = a === 0 ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    histogram[gray] += 1
    grayscale[index] = gray
    grayscale[index + 1] = gray
    grayscale[index + 2] = gray
    grayscale[index + 3] = a
  }

  const totalPixels = width * height
  const threshold = computeOtsuThreshold(histogram, totalPixels)
  const output = new Uint8ClampedArray(length)

  for (let index = 0; index < length; index += 4) {
    const gray = grayscale[index]
    const alpha = grayscale[index + 3]
    const binary = alpha === 0 ? 255 : gray > threshold ? 255 : 0
    const blended = Math.round(gray * 0.6 + binary * 0.4)
    output[index] = blended
    output[index + 1] = blended
    output[index + 2] = blended
    output[index + 3] = alpha
  }

  return new ImageData(output, width, height)
}

function computeOtsuThreshold(histogram: Uint32Array, totalPixels: number): number {
  if (totalPixels <= 0) {
    return 127
  }
  let sum = 0
  for (let i = 0; i < histogram.length; i += 1) {
    sum += i * histogram[i]
  }

  let sumB = 0
  let wB = 0
  let maxVariance = -1
  let threshold = 127

  for (let i = 0; i < histogram.length; i += 1) {
    wB += histogram[i]
    if (wB === 0) {
      continue
    }
    const wF = totalPixels - wB
    if (wF === 0) {
      break
    }
    sumB += i * histogram[i]
    const meanB = sumB / wB
    const meanF = (sum - sumB) / wF
    const variance = wB * wF * (meanB - meanF) * (meanB - meanF)
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = i
    }
  }

  return threshold
}
