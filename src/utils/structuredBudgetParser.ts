const HEADER_PATTERNS = {
  numeroOrcamento: /N[úu]mero do Or[cç]amento:\s*([A-Za-z0-9\-/.]+)/i,
  validade: /Or[cç]amento V[áa]lido at[ée]:\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i,
  de: /De:\s*(.+)$/i,
  para: /Para:\s*(.+)$/i,
}

const ITEM_SECTION_MARKERS = [
  /Detalhes\s+do\s+Or[cç]amento/i,
  /Itens\s+do\s+Or[cç]amento/i,
  /Descri[cç][aã]o\s+dos\s+Itens/i,
  /Produtos?/i,
  /Materiais?/i,
]

const TOTAL_MARKERS = [
  /Valor\s+total/i,
  /Total\s+geral/i,
  /Total\s+do\s+Or[cç]amento/i,
  /Total\s+do\s+orcamento/i,
]

const HEADER_KEYWORDS = [
  'descrição',
  'descricao',
  'produtos',
  'produto',
  'item',
  'itens',
  'quantidade',
  'quantidades',
  'quantity',
  'qty',
  'qtd',
  'valor',
  'valores',
  'preço',
  'preco',
  'price',
  'unitário',
  'unitario',
]

const QUANTITY_REGEX = /(quantidade|qtd|qtde|qty|quantity)[:\-\s]*([0-9]+(?:[.,][0-9]+)?)/i
const UNIT_REGEX = /(unidade|un|und|pe[cç]a|pc|kg|m|kit|par|l|litro|metros?)[:\-\s]*([A-Za-zº]+)?/i
const CODIGO_REGEX = /C[óo]digo:\s*(.+)$/i
const MODELO_REGEX = /Modelo:\s*(.+)$/i
const FABRICANTE_REGEX = /Fabricante:\s*(.*)$/i
const UNIT_PRICE_LABELS = [
  /Pre[çc]o\s*unit[áa]rio/i,
  /Valor\s*unit[áa]rio/i,
  /Unit[áa]rio/i,
]
const TOTAL_PRICE_LABELS = [
  /Pre[çc]o\s*total/i,
  /Valor\s*total\s+do\s+item/i,
  /Valor\s*total/i,
  /Total\s+item/i,
]

const CSV_HEADER =
  'numeroOrcamento;validade;de;para;produto;codigo;modelo;descricao;quantidade;unidade;precoUnitario;precoTotal;valorTotal'

type HeaderData = {
  numeroOrcamento: string | null
  validade: string | null
  de: string | null
  para: string | null
}

type ItemData = {
  produto: string | null
  codigo: string | null
  modelo: string | null
  descricao: string
  quantidade: number | null
  unidade: string | null
  precoUnitario: number | null
  precoTotal: number | null
}

type ResumoData = {
  valorTotal: number | null
  moeda: string
}

export type StructuredBudget = {
  header: HeaderData
  itens: ItemData[]
  resumo: ResumoData
  warnings: string[]
}

export function parseStructuredBudget(lines: string[]): StructuredBudget {
  const header = parseHeader(lines)
  const { itens, warnings } = parseItems(lines)
  const resumo = parseResumo(lines)
  return {
    header,
    itens,
    resumo,
    warnings,
  }
}

export function structuredBudgetToCsv(structured: StructuredBudget): string {
  const rows: string[] = [CSV_HEADER]
  const header = structured.header
  const resumo = structured.resumo

  if (structured.itens.length === 0) {
    rows.push(
      [
        header.numeroOrcamento ?? '',
        header.validade ?? '',
        header.de ?? '',
        header.para ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        resumo.valorTotal !== null ? formatCurrencyForCsv(resumo.valorTotal) : '',
      ].join(';'),
    )
    return rows.join('\n')
  }

  structured.itens.forEach((item) => {
    rows.push(
      [
        header.numeroOrcamento ?? '',
        header.validade ?? '',
        header.de ?? '',
        header.para ?? '',
        item.produto ?? '',
        item.codigo ?? '',
        item.modelo ?? '',
        item.descricao ?? '',
        item.quantidade !== null ? formatQuantityForCsv(item.quantidade) : '',
        item.unidade ?? '',
        item.precoUnitario !== null ? formatCurrencyForCsv(item.precoUnitario) : '',
        item.precoTotal !== null ? formatCurrencyForCsv(item.precoTotal) : '',
        resumo.valorTotal !== null ? formatCurrencyForCsv(resumo.valorTotal) : '',
      ].join(';'),
    )
  })

  return rows.join('\n')
}

function parseHeader(lines: string[]): HeaderData {
  const header: HeaderData = {
    numeroOrcamento: null,
    validade: null,
    de: null,
    para: null,
  }

  const limit = Math.min(lines.length, 150)
  for (let i = 0; i < limit; i += 1) {
    const line = lines[i]
    if (!header.numeroOrcamento) {
      const match = line.match(HEADER_PATTERNS.numeroOrcamento)
      if (match) {
        header.numeroOrcamento = match[1].trim()
      }
    }
    if (!header.validade) {
      const match = line.match(HEADER_PATTERNS.validade)
      if (match) {
        header.validade = normalizeDate(match[1])
      }
    }
    if (!header.de) {
      const match = line.match(HEADER_PATTERNS.de)
      if (match) {
        header.de = match[1].trim()
      }
    }
    if (!header.para) {
      const match = line.match(HEADER_PATTERNS.para)
      if (match) {
        header.para = match[1].trim()
      }
    }
  }

  return header
}

function parseItems(lines: string[]): { itens: ItemData[]; warnings: string[] } {
  const itens: ItemData[] = []
  const warnings: string[] = []

  const startIndex = findItemsStart(lines)
  const endIndex = findItemsEnd(lines, startIndex ?? 0)

  const boundsStart = startIndex ?? 0
  const boundsEnd = endIndex ?? lines.length

  let current: ItemData | null = null

  const pushCurrent = () => {
    if (!current) return
    current.descricao = current.descricao.trim() || '—'
    if (!current.unidade) {
      current.unidade = 'un'
    }
    if (current.quantidade !== null) {
      const normalized = normalizeQuantity(current.quantidade)
      current.quantidade = normalized
    }
    if (
      current.quantidade !== null &&
      current.precoUnitario !== null &&
      current.precoTotal !== null
    ) {
      const expected = current.precoUnitario * current.quantidade
      if (Math.abs(expected - current.precoTotal) > 0.01) {
        warnings.push(
          `Inconsistência de valores para o item "${
            current.produto ?? current.codigo ?? 'Item'
          }": total informado não confere com quantidade x preço unitário.`,
        )
      }
    }
    itens.push(current)
    current = null
  }

  for (let i = boundsStart; i < boundsEnd; i += 1) {
    const line = lines[i]
    if (!line) {
      continue
    }
    if (isLikelyHeaderRow(line)) {
      continue
    }

    const codigoMatch = line.match(CODIGO_REGEX)
    if (codigoMatch) {
      current = current ?? createEmptyItem()
      current.codigo = codigoMatch[1].trim() || null
      continue
    }

    const modeloMatch = line.match(MODELO_REGEX)
    if (modeloMatch) {
      current = current ?? createEmptyItem()
      current.modelo = modeloMatch[1].trim() || null
      continue
    }

    const fabricanteMatch = line.match(FABRICANTE_REGEX)
    if (fabricanteMatch) {
      const value = fabricanteMatch[1].trim()
      if (value) {
        current = current ?? createEmptyItem()
        const addition = `Fabricante: ${value}`
        current.descricao = current.descricao
          ? `${current.descricao} ${addition}`
          : addition
      }
      continue
    }

    const quantityInfo = extractQuantityAndUnit(line)
    if (quantityInfo) {
      current = current ?? createEmptyItem()
      if (quantityInfo.quantity !== null && quantityInfo.quantity !== undefined) {
        current.quantidade = quantityInfo.quantity
      }
      if (quantityInfo.unit) {
        current.unidade = normalizeUnit(quantityInfo.unit)
      }
      continue
    }

    const priceInfo = extractPriceInfo(line)
    if (priceInfo) {
      current = current ?? createEmptyItem()
      if (priceInfo.unitPrice !== undefined) {
        current.precoUnitario = priceInfo.unitPrice
      }
      if (priceInfo.totalPrice !== undefined) {
        current.precoTotal = priceInfo.totalPrice
      }
      continue
    }

    if (TOTAL_MARKERS.some((regex) => regex.test(line))) {
      pushCurrent()
      break
    }

    if (isPotentialProductLine(line)) {
      const { name, details } = splitNameAndDetails(line)
      if (current && (current.produto || current.descricao.trim())) {
        pushCurrent()
      }
      current = createEmptyItem()
      current.produto = name
      if (details) {
        current.descricao = details
      }
      continue
    }

    if (current) {
      const cleaned = line.replace(/^[-–—•\s]+/, '').trim()
      if (cleaned) {
        current.descricao = current.descricao
          ? `${current.descricao} ${cleaned}`
          : cleaned
      }
    }
  }

  pushCurrent()

  const merged = mergeDuplicateItems(itens)

  return { itens: merged, warnings }
}

function parseResumo(lines: string[]): ResumoData {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!line) continue
    if (TOTAL_MARKERS.some((regex) => regex.test(line))) {
      const value = extractFirstCurrency(line)
      if (value !== null) {
        return { valorTotal: value, moeda: 'BRL' }
      }
    }
  }
  return { valorTotal: null, moeda: 'BRL' }
}

function findItemsStart(lines: string[]): number | null {
  for (let i = 0; i < lines.length; i += 1) {
    if (ITEM_SECTION_MARKERS.some((regex) => regex.test(lines[i]))) {
      return i + 1
    }
  }
  return null
}

function findItemsEnd(lines: string[], startIndex: number): number | null {
  for (let i = startIndex; i < lines.length; i += 1) {
    if (TOTAL_MARKERS.some((regex) => regex.test(lines[i]))) {
      return i
    }
  }
  return null
}

function isLikelyHeaderRow(line: string): boolean {
  const lower = line.toLowerCase()
  const matches = HEADER_KEYWORDS.reduce(
    (count, keyword) => (lower.includes(keyword) ? count + 1 : count),
    0,
  )
  return matches >= 2
}

function isPotentialProductLine(line: string): boolean {
  if (!/[a-zá-ú0-9]/i.test(line)) {
    return false
  }
  if (/:/.test(line)) {
    return false
  }
  if (line.length < 4) {
    return false
  }
  if (isLikelyHeaderRow(line)) {
    return false
  }
  if (TOTAL_MARKERS.some((regex) => regex.test(line))) {
    return false
  }
  return true
}

function createEmptyItem(): ItemData {
  return {
    produto: null,
    codigo: null,
    modelo: null,
    descricao: '',
    quantidade: null,
    unidade: null,
    precoUnitario: null,
    precoTotal: null,
  }
}

function extractQuantityAndUnit(line: string):
  | { quantity: number | null; unit: string | null }
  | null {
  const quantityLabelMatch = line.match(QUANTITY_REGEX)
  if (quantityLabelMatch) {
    const quantity = parseLocaleNumber(quantityLabelMatch[2])
    const unitMatch = line.match(/(?:un|und|pc|kg|m|l|kit|par|cx|pçs?)/i)
    return {
      quantity: quantity !== null ? quantity : null,
      unit: unitMatch ? unitMatch[0] : null,
    }
  }

  const standaloneMatch = line.match(/^([0-9]+(?:[.,][0-9]+)?)\s*([A-Za-zº]*)$/)
  if (standaloneMatch) {
    const quantity = parseLocaleNumber(standaloneMatch[1])
    const unit = standaloneMatch[2] ? standaloneMatch[2] : null
    if (quantity !== null) {
      return { quantity, unit }
    }
  }

  const unitMatch = line.match(UNIT_REGEX)
  if (unitMatch) {
    const unit = unitMatch[2] || unitMatch[1]
    if (unit) {
      return { quantity: null, unit }
    }
  }

  return null
}

function extractPriceInfo(
  line: string,
): { unitPrice?: number; totalPrice?: number } | null {
  const currencyValues = extractCurrencyValues(line)
  if (!currencyValues.length) {
    return null
  }

  const lower = line.toLowerCase()
  const info: { unitPrice?: number; totalPrice?: number } = {}

  if (UNIT_PRICE_LABELS.some((regex) => regex.test(lower))) {
    info.unitPrice = currencyValues[0]
  }
  if (TOTAL_PRICE_LABELS.some((regex) => regex.test(lower))) {
    info.totalPrice = currencyValues[currencyValues.length - 1]
  }

  if (!info.unitPrice && !info.totalPrice) {
    if (currencyValues.length >= 2) {
      info.unitPrice = currencyValues[0]
      info.totalPrice = currencyValues[currencyValues.length - 1]
    } else if (currencyValues.length === 1) {
      const hasUnitHint = /\/\s*(un|und|pc|kg|m|l)/i.test(line) || /unit[áa]rio/i.test(lower)
      const hasTotalHint = /total/i.test(lower)
      if (hasUnitHint && !hasTotalHint) {
        info.unitPrice = currencyValues[0]
      } else if (hasTotalHint) {
        info.totalPrice = currencyValues[0]
      }
    }
  }

  if (info.unitPrice === undefined && info.totalPrice === undefined) {
    return null
  }

  return info
}

function extractCurrencyValues(line: string): number[] {
  const matches = line.matchAll(/(?:R\$|\$)?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:[.,][0-9]{2}))/g)
  const values: number[] = []
  for (const match of matches) {
    const value = parseLocaleNumber(match[1] ?? match[0])
    if (value !== null) {
      values.push(value)
    }
  }
  return values
}

function extractFirstCurrency(line: string): number | null {
  const matches = extractCurrencyValues(line)
  return matches.length ? matches[matches.length - 1] : null
}

function mergeDuplicateItems(items: ItemData[]): ItemData[] {
  const merged: ItemData[] = []
  const indexMap = new Map<string, number>()

  items.forEach((item) => {
    const key = `${(item.codigo ?? '').toLowerCase()}|${(item.modelo ?? '').toLowerCase()}`
    if (!key.trim()) {
      merged.push(item)
      return
    }
    const existingIndex = indexMap.get(key)
    if (existingIndex === undefined) {
      indexMap.set(key, merged.length)
      merged.push(item)
      return
    }
    const existing = merged[existingIndex]
    if (existing.quantidade !== null && item.quantidade !== null) {
      existing.quantidade += item.quantidade
    } else if (existing.quantidade === null) {
      existing.quantidade = item.quantidade
    }
    if (item.descricao && !existing.descricao.includes(item.descricao)) {
      existing.descricao = `${existing.descricao} ${item.descricao}`.trim()
    }
  })

  return merged
}

function splitNameAndDetails(text: string): { name: string; details?: string } {
  const match = text.match(/^(.*?)[\s]+[-–—:]{1,2}[\s]+(.+)$/)
  if (match) {
    return { name: match[1].trim(), details: match[2].trim() }
  }
  return { name: text.trim(), details: undefined }
}

function normalizeDate(raw: string): string {
  const [day, month, year] = raw.split('-')
  if (day && month && year) {
    return `${year}-${month}-${day}`
  }
  return raw
}

function normalizeQuantity(quantity: number): number {
  const rounded = Math.round(quantity)
  return rounded < 1 ? 1 : rounded
}

function normalizeUnit(raw: string): string {
  const cleaned = raw.trim().toLowerCase()
  if (!cleaned) {
    return 'un'
  }
  if (cleaned === 'und') return 'un'
  if (cleaned === 'pç' || cleaned === 'pçs' || cleaned === 'pc' || cleaned === 'pcs') {
    return 'pc'
  }
  return cleaned
}

function formatQuantityForCsv(value: number): string {
  return `${Math.round(value)}`
}

function formatCurrencyForCsv(value: number): string {
  return value.toFixed(2)
}

function parseLocaleNumber(raw: string): number | null {
  if (!raw) return null
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

export type StructuredItem = ItemData
export type StructuredHeader = HeaderData
export type StructuredResumo = ResumoData

