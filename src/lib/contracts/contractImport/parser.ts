import { extractContractFields } from './contractFieldExtractor'
import { parseSignaturesFromText } from './signatureParser'
import { detectMainContractorSignature } from './validators'
import type { ParsedContractFields, ParsedSignature } from './types'

const PDFJS_CDN_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/'

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

async function loadPdfJs(): Promise<PdfJsModule> {
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
