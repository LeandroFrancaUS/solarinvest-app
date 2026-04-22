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

const PDFJS_PROXY_MODULE_URL = '/api/pdfjs/module'
const PDFJS_PROXY_WORKER_URL = '/api/pdfjs/worker'

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsLoader) {
    pdfJsLoader = import(/* @vite-ignore */ PDFJS_PROXY_MODULE_URL)
      .then((module: PdfJsModule) => {
      if (module?.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = PDFJS_PROXY_WORKER_URL
      }
      return module
    }).catch((error) => {
      throw new Error(
        `Não foi possível carregar o parser de PDF via proxy local. ` +
        `Verifique os endpoints ${PDFJS_PROXY_MODULE_URL} e ${PDFJS_PROXY_WORKER_URL}. ` +
        `Detalhes: ${error instanceof Error ? error.message : String(error)}`,
      )
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
