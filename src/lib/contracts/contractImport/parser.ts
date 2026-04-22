import { extractContractFields } from './contractFieldExtractor'
import { parseSignaturesFromText } from './signatureParser'
import { detectMainContractorSignature } from './validators'
import type { ParsedContractFields, ParsedSignature } from './types'

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
  cleanup?: () => void
}

let pdfJsLoader: Promise<PdfJsModule> | null = null

const PDFJS_LOCAL_MODULE_URL = '/vendor/pdfjs-dist/pdf.mjs'
const PDFJS_LOCAL_WORKER_URL = '/vendor/pdfjs-dist/pdf.worker.mjs'
const PDFJS_CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.mjs',
  'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.mjs',
]
const PDFJS_WORKER_CDN_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.mjs',
  'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.mjs',
]

async function importModuleFromBlob(url: string): Promise<PdfJsModule> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Falha ao baixar PDF.js de ${url}: HTTP ${response.status}`)
  }
  const code = await response.text()
  const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try {
    return await import(/* @vite-ignore */ blobUrl) as PdfJsModule
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

async function loadPdfJsModule(): Promise<PdfJsModule> {
  try {
    return await import(/* @vite-ignore */ PDFJS_LOCAL_MODULE_URL) as PdfJsModule
  } catch {
    // no-op: fallback below
  }

  const errors: string[] = []
  for (const cdnUrl of PDFJS_CDN_CANDIDATES) {
    try {
      return await importModuleFromBlob(cdnUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(message)
    }
  }

  throw new Error(
    `Não foi possível carregar o parser de PDF. ` +
    `Publique os arquivos locais em ${PDFJS_LOCAL_MODULE_URL} e ${PDFJS_LOCAL_WORKER_URL} ` +
    `ou habilite acesso ao CDN do PDF.js. Detalhes: ${errors.join(' | ')}`,
  )
}

async function resolveWorkerSrc(): Promise<string | null> {
  try {
    const localCheck = await fetch(PDFJS_LOCAL_WORKER_URL, { method: 'HEAD' })
    if (localCheck.ok) return PDFJS_LOCAL_WORKER_URL
  } catch {
    // no-op
  }

  for (const workerUrl of PDFJS_WORKER_CDN_CANDIDATES) {
    try {
      const response = await fetch(workerUrl, { method: 'HEAD' })
      if (response.ok) return workerUrl
    } catch {
      // try next candidate
    }
  }
  return null
}

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsLoader) {
    pdfJsLoader = loadPdfJsModule().then(async (module: PdfJsModule) => {
      if (module?.GlobalWorkerOptions) {
        const workerSrc = await resolveWorkerSrc()
        if (workerSrc) {
          module.GlobalWorkerOptions.workerSrc = workerSrc
        }
      }
      return module
    })
  }
  return pdfJsLoader
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfJs()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data: bytes })
  const pdf = await loadingTask.promise
  const pages: string[] = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const textContent = await page.getTextContent()
    const line = textContent.items.map((it) => it.str ?? '').join(' ')
    pages.push(line)
    page.cleanup?.()
  }

  return pages.join('\n\n')
}

export type ParsedContractDocument = {
  plainText: string
  fields: ParsedContractFields
  signatures: ParsedSignature[]
  contractorSignature: ParsedSignature | null
}

export function parseContractFromText(text: string): ParsedContractDocument {
  const fields = extractContractFields(text)
  const signatures = parseSignaturesFromText(text)
  const contractorSignature = detectMainContractorSignature(fields, signatures)

  return {
    plainText: text,
    fields,
    signatures,
    contractorSignature,
  }
}
