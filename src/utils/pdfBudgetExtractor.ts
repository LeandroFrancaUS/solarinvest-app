import {
  parseStructuredBudget,
  structuredBudgetToCsv,
  type StructuredBudget,
} from './structuredBudgetParser'

const runtimeEnv = (() => {
  if (typeof import.meta !== 'undefined') {
    const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    if (meta) {
      return meta
    }
  }
  if (typeof globalThis !== 'undefined') {
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    if (processEnv) {
      return processEnv
    }
  }
  return {} as Record<string, string | undefined>
})()

const DEBUG_ENABLED =
  runtimeEnv.VITE_PARSER_DEBUG === 'true' || runtimeEnv.ORCAMENTO_PARSER_DEBUG === 'true'

const debugLog = (context: string, payload: Record<string, unknown>): void => {
  if (!DEBUG_ENABLED) {
    return
  }
  console.debug(`[pdfBudgetExtractor:${context}]`, payload)
}

const PDFJS_CDN_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/'
const TESSERACT_CDN =
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.esm.min.js'

type PdfJsModule = {
  getDocument: (src: unknown) => { promise: Promise<any> }
  GlobalWorkerOptions: { workerSrc: string }
}

type TesseractModule = {
  createWorker?: (...args: any[]) => Promise<any>
  default?: {
    createWorker?: (...args: any[]) => Promise<any>
  }
}

export type BudgetExtractionItem = {
  productName: string
  description?: string
  quantity?: number | undefined
  unitPrice?: number | undefined
  totalPrice?: number | undefined
  code?: string | undefined
  model?: string | undefined
  manufacturer?: string | undefined
  imageDataUrl?: string
}

export type BudgetExtractionResult = {
  items: BudgetExtractionItem[]
  total?: number | undefined
  totalSource: 'explicit' | 'calculated' | null
  warnings: string[]
  meta: {
    pagesProcessed: number
    usedOcr: boolean
  }
  structuredBudget: StructuredBudget
  csv: string
  plainText: string
}

type TextContentItem = {
  str?: string
  transform?: number[]
}

type TextContent = {
  items: TextContentItem[]
}

let pdfJsLoader: Promise<PdfJsModule> | null = null
let tesseractLoader: Promise<TesseractModule> | null = null

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsLoader) {
    pdfJsLoader = import(
      /* @vite-ignore */ `${PDFJS_CDN_BASE}build/pdf.mjs`
    ).then((module: PdfJsModule) => {
      if (module?.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}build/pdf.worker.mjs`
      }
      return module
    })
  }
  return pdfJsLoader
}

async function loadTesseract(): Promise<TesseractModule | null> {
  if (typeof window === 'undefined') {
    return null
  }
  if (!tesseractLoader) {
    tesseractLoader = import(
      /* @vite-ignore */ TESSERACT_CDN,
    ) as Promise<TesseractModule>
  }
  return tesseractLoader
}

export async function extractBudgetFromPdf(
  fileBuffer: ArrayBuffer,
): Promise<BudgetExtractionResult> {
  const pdfjs = await loadPdfJs()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fileBuffer) })
  const pdf = await loadingTask.promise
  const totalPages = pdf.numPages || 0

  const aggregatedLines: string[] = []
  const warnings: string[] = []
  let usedOcr = false

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex)
    const { lines, ocrUsed } = await extractLinesFromPage(page)
    if (ocrUsed) {
      usedOcr = true
    }
    if (!lines.length) {
      debugLog('pagina-vazia', { pageIndex })
      continue
    }
    const normalizedLines = lines
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    debugLog('pagina-processada', {
      pageIndex,
      linhasNormalizadas: normalizedLines.length,
    })
    aggregatedLines.push(...normalizedLines)
  }

  const structured = parseStructuredBudget(aggregatedLines)
  debugLog('structured-budget', {
    itens: structured.itens.length,
    warnings: structured.warnings,
    valorTotal: structured.resumo.valorTotal,
  })
  warnings.push(...structured.warnings)

  if (!structured.itens.length) {
    warnings.push(
      'Nenhum item de orçamento foi identificado automaticamente. Revise o PDF ou preencha manualmente.',
    )
    debugLog('structured-sem-itens', {
      linhasProcessadas: aggregatedLines.slice(0, 20),
    })
  }

  if (usedOcr) {
    warnings.push(
      'Foi necessário utilizar OCR para interpretar partes do PDF. Revise os dados extraídos.',
    )
  }

  const items: BudgetExtractionItem[] = structured.itens.map((item) => ({
    productName: item.produto ?? '',
    description: item.descricao ?? '',
    quantity: item.quantidade ?? undefined,
    unitPrice: item.precoUnitario ?? undefined,
    totalPrice: item.precoTotal ?? undefined,
    code: item.codigo ?? undefined,
    model: item.modelo ?? undefined,
    manufacturer: item.fabricante ?? undefined,
  }))

  const explicitTotal = structured.resumo.valorTotal
  const calculatedTotal = computeItemsTotal(items)

  let totalSource: 'explicit' | 'calculated' | null = null
  let totalValue: number | undefined

  if (explicitTotal !== null) {
    totalValue = explicitTotal
    totalSource = 'explicit'
  } else if (calculatedTotal !== null) {
    totalValue = calculatedTotal
    totalSource = 'calculated'
    warnings.push(
      'O valor total do orçamento foi calculado a partir da soma dos itens porque não foi encontrado no PDF.',
    )
  }

  const csv = structuredBudgetToCsv(structured)
  const plainText = aggregatedLines.join('\n')

  debugLog('budget-extraction-fim', {
    itens: items.length,
    total: totalValue,
    fonteTotal: totalSource,
    avisos: warnings.length,
  })

  return {
    items,
    total: totalValue,
    totalSource,
    warnings,
    meta: {
      pagesProcessed: totalPages,
      usedOcr,
    },
    structuredBudget: structured,
    csv,
    plainText,
  }
}

function computeItemsTotal(items: BudgetExtractionItem[]): number | null {
  let total = 0
  let hasCompletable = true
  for (const item of items) {
    if (
      item.quantity !== undefined &&
      item.unitPrice !== undefined &&
      Number.isFinite(item.quantity) &&
      Number.isFinite(item.unitPrice)
    ) {
      total += item.quantity * item.unitPrice
    } else {
      hasCompletable = false
      break
    }
  }
  return hasCompletable ? total : null
}

async function extractLinesFromPage(page: any): Promise<{ lines: string[]; ocrUsed: boolean }> {
  const textContent: TextContent = await page.getTextContent()
  const lines = groupTextItems(textContent)
  const joined = lines.join('')
  if (joined.length >= 40 || typeof document === 'undefined') {
    return { lines, ocrUsed: false }
  }
  const ocrLines = await runOcrFallback(page)
  if (ocrLines.length) {
    return { lines: ocrLines, ocrUsed: true }
  }
  return { lines, ocrUsed: false }
}

function groupTextItems(content: TextContent): string[] {
  const rows = new Map<number, string[]>()
  content.items.forEach((item) => {
    if (!item?.str) {
      return
    }
    const transform = item.transform || []
    const y = transform[5] ?? 0
    const key = Math.round(y)
    const row = rows.get(key)
    if (row) {
      row.push(item.str)
    } else {
      rows.set(key, [item.str])
    }
  })
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

async function runOcrFallback(page: any): Promise<string[]> {
  if (typeof document === 'undefined') {
    return []
  }
  const tesseract = await loadTesseract()
  const createWorker = tesseract?.createWorker || tesseract?.default?.createWorker
  if (!createWorker) {
    return []
  }
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    return []
  }
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: context, viewport }).promise
  const worker = await createWorker({ logger: () => {} })
  let terminated = false
  const cleanup = async () => {
    if (!terminated) {
      terminated = true
      await worker.terminate()
    }
  }
  try {
    await worker.loadLanguage('por+eng')
    await worker.initialize('por+eng')
    const result = await worker.recognize(canvas)
    const text = result?.data?.text || ''
    const lines = text
      .split(/\r?\n/)
      .map((line: string) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    return lines
  } catch (_error) {
    return []
  } finally {
    canvas.width = 0
    canvas.height = 0
    await cleanup()
  }
}

