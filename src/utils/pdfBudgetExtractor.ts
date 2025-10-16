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
  quantity?: number
  unitPrice?: number
}

export type BudgetExtractionResult = {
  items: BudgetExtractionItem[]
  total?: number
  totalSource: 'explicit' | 'calculated' | null
  warnings: string[]
  meta: {
    pagesProcessed: number
    usedOcr: boolean
  }
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
        module.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}build/pdf.worker.min.js`
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
      /* @vite-ignore */ TESSERACT_CDN
    ) as Promise<TesseractModule>
  }
  return tesseractLoader
}

const HEADER_KEYWORDS = ['descrição', 'produto', 'item', 'quantidade', 'qtd', 'valor', 'preço']

const TOTAL_KEYWORDS = ['total', 'valor total', 'total geral', 'total do orçamento', 'total do orcamento']

const CONTINUATION_PREFIX = /^[\-–—•\s]+/

const MULTI_SPACE_SPLIT = /\s{2,}|\t+/g

export async function extractBudgetFromPdf(
  fileBuffer: ArrayBuffer,
): Promise<BudgetExtractionResult> {
  const pdfjs = await loadPdfJs()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fileBuffer) })
  const pdf = await loadingTask.promise
  const totalPages = pdf.numPages || 0

  const warnings: string[] = []
  const items: BudgetExtractionItem[] = []
  let explicitTotal: number | undefined
  let usedOcr = false

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex)
    const { lines, ocrUsed } = await extractLinesFromPage(page)
    if (ocrUsed) {
      usedOcr = true
    }
    if (!lines.length) {
      continue
    }

    const normalizedLines = lines
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    let headerSeen = false

    for (const line of normalizedLines) {
      if (!headerSeen && containsHeaderKeyword(line)) {
        headerSeen = true
        continue
      }

      const totalCandidate = parseTotalLine(line)
      if (totalCandidate !== null) {
        explicitTotal = totalCandidate
        break
      }

      const item = parseBudgetLine(line)
      if (item) {
        items.push(item)
      } else if (items.length > 0) {
        const last = items[items.length - 1]
        const cleaned = line.replace(CONTINUATION_PREFIX, '').trim()
        if (cleaned) {
          last.description = last.description
            ? `${last.description} ${cleaned}`
            : cleaned
        }
      }
    }

    if (explicitTotal !== undefined) {
      break
    }
  }

  if (!items.length) {
    warnings.push(
      'Nenhum item de orçamento foi identificado automaticamente. Revise o PDF ou preencha manualmente.',
    )
  }

  if (usedOcr) {
    warnings.push(
      'Foi necessário utilizar OCR para interpretar partes do PDF. Revise os dados extraídos.',
    )
  }

  const calculatedTotal = computeItemsTotal(items)
  let totalSource: 'explicit' | 'calculated' | null = null
  let totalValue: number | undefined

  if (explicitTotal !== undefined) {
    totalValue = explicitTotal
    totalSource = 'explicit'
  } else if (calculatedTotal !== null) {
    totalValue = calculatedTotal
    totalSource = 'calculated'
    warnings.push(
      'O valor total do orçamento foi calculado a partir da soma dos itens porque não foi encontrado no PDF.',
    )
  }

  return {
    items,
    total: totalValue,
    totalSource,
    warnings,
    meta: {
      pagesProcessed: totalPages,
      usedOcr,
    },
  }
}

function containsHeaderKeyword(line: string): boolean {
  const lower = line.toLowerCase()
  return HEADER_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function parseTotalLine(line: string): number | null {
  const lower = line.toLowerCase()
  if (!TOTAL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return null
  }
  const currencyMatch = line.match(/(?:R\$)?\s*[\d\.]+,?\d{0,2}/g)
  if (!currencyMatch || currencyMatch.length === 0) {
    return null
  }
  const candidate = currencyMatch[currencyMatch.length - 1]
  const parsed = parseLocaleNumber(candidate)
  return parsed === null ? null : parsed
}

type BudgetCandidateSegment = {
  idx: number
  raw: string
  value: number
  currencyLike: boolean
}

function parseBudgetLine(line: string): BudgetExtractionItem | null {
  const segments = line.split(MULTI_SPACE_SPLIT).map((segment) => segment.trim()).filter(Boolean)
  if (segments.length < 2) {
    return null
  }

  const numericSegments: BudgetCandidateSegment[] = []
  segments.forEach((segment, idx) => {
    const parsed = parseLocaleNumber(segment)
    if (parsed !== null) {
      numericSegments.push({
        idx,
        raw: segment,
        value: parsed,
        currencyLike: isCurrencyLike(segment, parsed),
      })
    }
  })

  if (!numericSegments.length) {
    return null
  }

  const currencySegments = numericSegments.filter((segment) => segment.currencyLike)
  let unitSegment: BudgetCandidateSegment | undefined
  let totalSegment: BudgetCandidateSegment | undefined

  if (currencySegments.length >= 2) {
    unitSegment = currencySegments[currencySegments.length - 2]
    totalSegment = currencySegments[currencySegments.length - 1]
  } else if (currencySegments.length === 1) {
    unitSegment = currencySegments[0]
  }

  let quantitySegment: BudgetCandidateSegment | undefined

  if (unitSegment) {
    quantitySegment = numericSegments
      .filter((segment) => segment.idx < unitSegment!.idx && segment !== totalSegment)
      .slice(-1)[0]
  }

  if (!quantitySegment && numericSegments.length >= 2) {
    const candidate = numericSegments[numericSegments.length - 2]
    if (candidate !== unitSegment && candidate !== totalSegment) {
      quantitySegment = candidate
    }
  }

  const descriptionSegments = segments.filter((_, idx) => {
    if (idx === unitSegment?.idx) return false
    if (idx === totalSegment?.idx) return false
    if (idx === quantitySegment?.idx) return false
    return true
  })

  if (!descriptionSegments.length) {
    return null
  }

  const firstSegment = descriptionSegments[0]
  if (isHeaderLike(firstSegment)) {
    return null
  }

  if (descriptionSegments.length > 1 && /^[0-9a-z]{2,10}$/i.test(firstSegment)) {
    descriptionSegments.shift()
  }

  const descriptionText = descriptionSegments.join(' ').trim()
  if (!descriptionText) {
    return null
  }

  const { name, details } = splitNameAndDescription(descriptionText)

  return {
    productName: name,
    description: details,
    quantity: quantitySegment?.value,
    unitPrice: unitSegment?.value,
  }
}

function splitNameAndDescription(text: string): { name: string; details?: string } {
  const separatorMatch = text.match(/^(.*?)[\s]+[-–—:]{1,2}[\s]+(.+)$/)
  if (separatorMatch) {
    return {
      name: separatorMatch[1].trim(),
      details: separatorMatch[2].trim(),
    }
  }
  return { name: text.trim(), details: undefined }
}

function isHeaderLike(segment: string): boolean {
  const lower = segment.toLowerCase()
  return HEADER_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function isCurrencyLike(segment: string, value: number): boolean {
  if (/r\$/i.test(segment)) {
    return true
  }
  if (/[,\.]/.test(segment) && /,\d{2}$/.test(segment)) {
    return true
  }
  if (value >= 1000) {
    return true
  }
  return false
}

function parseLocaleNumber(raw: string): number | null {
  if (!raw) {
    return null
  }
  const sanitized = raw
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  if (!sanitized || sanitized === '-' || sanitized === '.') {
    return null
  }
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

function computeItemsTotal(items: BudgetExtractionItem[]): number | null {
  let total = 0
  let hasCompletable = false
  for (const item of items) {
    if (item.quantity !== undefined && item.unitPrice !== undefined) {
      total += item.quantity * item.unitPrice
      hasCompletable = true
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
