import { formatNumberBRWithOptions, toNumberFlexible } from '../lib/locale/br-number'

const HEADER_PATTERNS = {
  numeroOrcamento: /N[úu]mero do Or[cç]amento:\s*([A-Za-z0-9\-/.]+)/i,
  validade: /Or[cç]amento V[áa]lido at[ée]:\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i,
  de: /De:\s*(.+)$/i,
  para: /Para:\s*(.+)$/i,
}

const SECTION_START_REGEX = /Detalhes\s+do\s+Or[cç]amento/i
const SECTION_HEADER_REGEX = /Produto\s+Quantidade/i
const SECTION_END_REGEX =
  /(Valor\s+total\s*:|Aceite\s+da\s+Proposta|Assinatura|Quadro\s+comercial|Dados\s+do\s+cliente|Entrega\s+Escolhida|Condi[cç][aã]o\s+de\s+Pagamento|Pot[êe]ncia\s+do\s+sistema)/i
const FOOTER_TOTAL_REGEX = /Valor\s+total:\s*R?\$?\s*([\d.,]+)/i
const CODE_MODEL_QTY_REGEX = /C[óo]digo:\s*(.+?)\s+Modelo:\s*(.+?)\s+(\d+)(?:\s*([A-Za-z]{1,5}))?\s*$/i
const CODIGO_REGEX = /C[óo]digo:\s*(.+)$/i
const MODELO_REGEX = /Modelo:\s*(.+)$/i
const QUANTIDADE_REGEX = /Quantidade:\s*(\d+)(?:\s*([A-Za-z]{1,5}))?/i
const FABRICANTE_REGEX = /Fabricante:\s*(.*)$/i
const UNIT_PRICE_REGEX = /R\$\s*([\d.,]+)\s*(?:\/\s*un|unidade)\b/i
const TOTAL_PRICE_REGEX = /\b(?:Valor:)?\s*R\$\s*([\d.,]+)\b/gi
const QUANTIDADE_SOZINHA_REGEX = /^\s*([0-9]{1,5})(?:[,\.](?:0+))?\s*([A-Za-z]{1,5})?\s*$/

const LINE_EXCLUSION_PATTERNS: RegExp[] = [
  /@/i,
  /\bemail\b/i,
  /brsolarinvest/i,
  /\btelefone\b/i,
  /\bwhatsapp\b/i,
  /\bcnpj\b/i,
  /\bcpf\b/i,
  /\brg\b/i,
  /\bdados do cliente\b/i,
  /\bcliente\b/i,
  /^or[cç]amento\b/i,
  /\bendere[cç]o\b/i,
  /\bbairro\b/i,
  /\bcidade\b/i,
  /\bestado\b/i,
  /\bcep\b/i,
  /\bc\u00f3digo do or[cç]amento\b/i,
  /portf[óo]lio/i,
  /sobre\s+n[óo]s/i,
  /proposta comercial/i,
  /contato/i,
  /\baceite da proposta\b/i,
  /\bassinatura\b/i,
  /\bdocumento\b/i,
  /\bru[áa]/i,
  /\bjardim/i,
  /\betapa/i,
  /an[áa]polis/i,
  /\bdistribuidora\b/i,
  /\buc\b/i,
  /vamos avan[çc]ar/i,
  /valor\s+total/i,
  /cot[aã][cç][aã]o\b/i,
  /entrega\s+escolhida/i,
  /transportadora/i,
  /condi[cç][aã]o\s+de\s+pagamento/i,
  /pot[êe]ncia\s+do\s+sistema/i,
]

const DESCRIPTION_ALLOWED_REGEXES: RegExp[] = [/^Descri[çc][aã]o/i, /^Observa[çc][aã]o/i]

const CSV_HEADER =
  'numeroOrcamento;validade;de;para;produto;codigo;modelo;descricao;quantidade;unidade;precoUnitario;precoTotal;valorTotal'

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

const PARSER_DEBUG_ENABLED =
  runtimeEnv.VITE_PARSER_DEBUG === 'true' || runtimeEnv.PARSER_DEBUG === 'true'

const parserDebugLog = (context: string, payload: Record<string, unknown>): void => {
  if (!PARSER_DEBUG_ENABLED) {
    return
  }
  console.debug(`[structuredBudgetParser:${context}]`, payload)
}

const collectContextLines = (lines: string[], index: number, radius = 2): string[] => {
  const start = Math.max(0, index - radius)
  const end = Math.min(lines.length, index + radius + 1)
  return lines.slice(start, end)
}

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
  fabricante: string | null
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
        header.validade = toISODate(match[1])
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

type SectionCandidate = {
  section: string[]
  startIdx: number
  endIdx: number
  strategy: 'header' | 'detalhes' | 'fallback'
}

export function deriveSection(
  lines: string[],
): { section: string[]; startIdx: number; endIdx: number } {
  const [candidate] = findSectionCandidates(lines)
  if (!candidate) {
    return { section: [], startIdx: -1, endIdx: -1 }
  }
  return { section: candidate.section, startIdx: candidate.startIdx, endIdx: candidate.endIdx }
}

function parseItems(lines: string[]): { itens: ItemData[]; warnings: string[] } {
  const candidates = findSectionCandidates(lines)
  let parsed: { itens: ItemData[]; warnings: string[] } | null = null

  for (const candidate of candidates) {
    const result = parseSectionItems(lines, candidate.section, candidate.startIdx)
    if (result.itens.length) {
      parsed = result
      break
    }
    if (!parsed) {
      parsed = result
    }
  }

  if (!parsed) {
    parsed = { itens: [], warnings: [] }
  }

  return parsed
}

function parseSectionItems(
  lines: string[],
  section: string[],
  startIdx: number,
): { itens: ItemData[]; warnings: string[] } {
  const itens: ItemData[] = []
  const warnings: string[] = []

  if (!section.length) {
    parserDebugLog('itens-vazios', { startIdx })
  }

  let curr: ItemData | null = null
  let lastAbsoluteIndex = startIdx

  const resolveContext = (absoluteIndex: number) => {
    const index = Number.isFinite(absoluteIndex) ? absoluteIndex : startIdx
    return collectContextLines(lines, Math.max(index, 0))
  }

  const ensureCurr = () => {
    if (!curr) {
      curr = newItem()
    }
  }

  const push = () => {
    if (!curr) return
    const produto = curr.produto?.trim()
    if (!produto || shouldIgnoreValue(produto)) {
      parserDebugLog('item-descartado', {
        motivo: 'produto-invalido',
        produto,
        contexto: resolveContext(lastAbsoluteIndex),
      })
      curr = null
      return
    }
    curr.produto = produto
    curr.descricao = curr.descricao.trim() || '—'
    if (
      curr.quantidade !== null &&
      curr.precoUnitario !== null &&
      curr.precoTotal !== null
    ) {
      const expected = curr.precoUnitario * curr.quantidade
      if (Math.abs(expected - curr.precoTotal) > 0.01) {
        warnings.push(
          `Inconsistência de valores para o item "${
            curr.produto ?? curr.codigo ?? 'Item'
          }": total informado não confere com quantidade x preço unitário.`,
        )
        parserDebugLog('item-total-inconsistente', {
          produto: curr.produto,
          quantidade: curr.quantidade,
          precoUnitario: curr.precoUnitario,
          precoTotal: curr.precoTotal,
          esperado: expected,
          contexto: resolveContext(lastAbsoluteIndex),
        })
      }
    }
    itens.push(curr)
    curr = null
  }

  for (let lineIndex = 0; lineIndex < section.length; lineIndex += 1) {
    const raw = section[lineIndex]
    const line = raw.replace(/\s+/g, ' ').trim()
    const absoluteIndex = startIdx === -1 ? lineIndex : startIdx + 1 + lineIndex
    lastAbsoluteIndex = absoluteIndex

    if (!line) {
      parserDebugLog('linha-vazia', {
        indice: absoluteIndex,
        contexto: resolveContext(absoluteIndex),
      })
      continue
    }

    if (shouldIgnoreValue(line)) {
      parserDebugLog('linha-ignorada', {
        linha: line,
        indice: absoluteIndex,
        contexto: resolveContext(absoluteIndex),
      })
      continue
    }

    const quantityStandalone = line.match(QUANTIDADE_SOZINHA_REGEX)
    if (quantityStandalone) {
      ensureCurr()
      const quantity = parseQuantity(quantityStandalone[1])
      curr!.quantidade = Number.isNaN(quantity) ? curr!.quantidade ?? null : quantity
      const unit = normalizeUnit(quantityStandalone[2])
      if (unit) {
        curr!.unidade = unit
      }
      continue
    }

    const codeModelQty = line.match(CODE_MODEL_QTY_REGEX)
    if (codeModelQty) {
      ensureCurr()
      curr!.codigo = codeModelQty[1].trim() || null
      curr!.modelo = codeModelQty[2].trim() || null
      const quantity = parseInt(codeModelQty[3], 10)
      curr!.quantidade = Number.isNaN(quantity) ? null : quantity
      const unit = normalizeUnit(codeModelQty[4])
      if (unit) {
        curr!.unidade = unit
      }
      appendDescricao(curr!, curr!.codigo ? `Código: ${curr!.codigo}` : '')
      appendDescricao(curr!, curr!.modelo ? `Modelo: ${curr!.modelo}` : '')
      continue
    }

    if (isLikelyProductLine(line)) {
      if (curr && curr.produto) {
        push()
      }
      curr = newItem()
      curr.produto = line.trim()
      continue
    }

    const codigo = line.match(CODIGO_REGEX)
    if (codigo) {
      ensureCurr()
      curr!.codigo = codigo[1].trim() || null
      if (curr!.codigo) {
        appendDescricao(curr!, `Código: ${curr!.codigo}`)
      }
      continue
    }

    const modelo = line.match(MODELO_REGEX)
    if (modelo) {
      ensureCurr()
      curr!.modelo = modelo[1].trim() || null
      if (curr!.modelo) {
        appendDescricao(curr!, `Modelo: ${curr!.modelo}`)
      }
      continue
    }

    const quantidade = line.match(QUANTIDADE_REGEX)
    if (quantidade) {
      ensureCurr()
      const quantity = parseInt(quantidade[1], 10)
      curr!.quantidade = Number.isNaN(quantity) ? null : quantity
      const unit = normalizeUnit(quantidade[2])
      if (unit) {
        curr!.unidade = unit
      }
      continue
    }

    const fabricante = line.match(FABRICANTE_REGEX)
    if (fabricante) {
      const fab = fabricante[1].trim()
      if (fab) {
        ensureCurr()
        curr!.fabricante = fab
        appendDescricao(curr!, `Fabricante: ${fab}`)
      }
      continue
    }

    let matchedPrice = false
    const unitMatch = line.match(UNIT_PRICE_REGEX)
    if (unitMatch) {
      ensureCurr()
      const value = parseBRL(unitMatch[1])
      if (!Number.isNaN(value)) {
        curr!.precoUnitario = value
        matchedPrice = true
      } else {
        parserDebugLog('preco-unitario-invalido', {
          linha: line,
          indice: absoluteIndex,
          contexto: resolveContext(absoluteIndex),
        })
      }
    }

    const totalMatches = [...line.matchAll(TOTAL_PRICE_REGEX)].filter((match) => {
      const index = match.index ?? 0
      const after = line.slice(index + match[0].length).toLowerCase()
      return !/^\s*(?:\/\s*un|unidade)\b/.test(after)
    })
    if (totalMatches.length) {
      ensureCurr()
      const lastMatch = totalMatches[totalMatches.length - 1]
      const value = parseBRL(lastMatch[1])
      if (!Number.isNaN(value)) {
        curr!.precoTotal = value
        matchedPrice = true
      } else {
        parserDebugLog('preco-total-invalido', {
          linha: line,
          indice: absoluteIndex,
          contexto: resolveContext(absoluteIndex),
        })
      }
    }
    if (matchedPrice) {
      continue
    }

    if (DESCRIPTION_ALLOWED_REGEXES.some((regex) => regex.test(line))) {
      ensureCurr()
      appendDescricao(curr!, line)
      continue
    }

    if (curr) {
      appendDescricao(curr, line)
    } else {
      parserDebugLog('linha-sem-contexto', {
        linha: line,
        indice: absoluteIndex,
        contexto: resolveContext(absoluteIndex),
      })
    }
  }

  push()

  const merged = mergeAdjacentDuplicates(itens)

  return { itens: merged, warnings }
}

function parseResumo(lines: string[]): ResumoData {
  const resumo: ResumoData = { valorTotal: null, moeda: 'BRL' }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!line) {
      continue
    }
    const match = line.match(FOOTER_TOTAL_REGEX)
    if (match) {
      const value = parseBRL(match[1])
      if (!Number.isNaN(value)) {
        resumo.valorTotal = value
        break
      }
    }
  }
  if (resumo.valorTotal === null) {
    parserDebugLog('resumo-sem-total', {
      contexto: collectContextLines(lines, Math.max(lines.length - 1, 0), 5),
    })
  }
  return resumo
}

function formatQuantityForCsv(value: number): string {
  return `${Math.round(value)}`
}

function formatCurrencyForCsv(value: number): string {
  return formatNumberBRWithOptions(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function newItem(): ItemData {
  return {
    produto: null,
    codigo: null,
    modelo: null,
    fabricante: null,
    descricao: '',
    quantidade: null,
    unidade: null,
    precoUnitario: null,
    precoTotal: null,
  }
}

function appendDescricao(item: ItemData, fragment: string): void {
  const normalized = fragment.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return
  }
  if (!item.descricao) {
    item.descricao = normalized
    return
  }
  const partes = item.descricao.split(' • ')
  if (partes.includes(normalized)) {
    return
  }
  item.descricao = `${item.descricao} • ${normalized}`
}

function shouldIgnoreValue(value: string): boolean {
  if (!value) {
    return true
  }
  if (LINE_EXCLUSION_PATTERNS.some((regex) => regex.test(value))) {
    return true
  }
  if (/\(\d{2}\)/.test(value)) {
    return true
  }
  if (isUppercaseNoise(value)) {
    return true
  }
  return false
}

function isLikelyProductLine(value: string): boolean {
  if (!value || value.includes(':')) {
    return false
  }
  const normalized = value.trim()
  if (normalized.length <= 6) {
    return false
  }
  if (shouldIgnoreValue(value)) {
    return false
  }
  const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value)
  return hasLetters
}

function isUppercaseNoise(value: string): boolean {
  if (/\d/.test(value)) {
    return false
  }
  const sanitized = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, '').trim()
  if (!sanitized) {
    return false
  }
  const words = sanitized.split(/\s+/).filter(Boolean)
  if (words.length > 2) {
    return false
  }
  const whitelist = [/kit/i, /servi[çc]o/i, /m[óo]dulo/i, /inversor/i]
  if (whitelist.some((regex) => regex.test(value))) {
    return false
  }
  return words.every((word) => word === word.toUpperCase())
}

function parseQuantity(raw: string): number {
  const parsed = toNumberFlexible(raw)
  if (parsed == null || !Number.isFinite(parsed)) {
    return Number.NaN
  }
  return Math.round(parsed)
}

function normalizeUnit(raw: string | undefined): string | null {
  if (!raw) {
    return null
  }
  const letters = raw.replace(/[^A-Za-z]/g, '')
  if (!letters) {
    return null
  }
  if (letters.length > 6) {
    return null
  }
  return letters.toUpperCase()
}

function findSectionCandidates(lines: string[]): SectionCandidate[] {
  const normalized = lines.map((line) => line.replace(/\s+/g, ' ').trim())
  const detailIdx = normalized.findIndex((line) => SECTION_START_REGEX.test(line))
  const headerIdx = (() => {
    if (detailIdx !== -1) {
      const offset = normalized
        .slice(detailIdx + 1)
        .findIndex((line) => SECTION_HEADER_REGEX.test(line))
      if (offset !== -1) {
        return detailIdx + 1 + offset
      }
    }
    return normalized.findIndex((line) => SECTION_HEADER_REGEX.test(line))
  })()

  const candidates: SectionCandidate[] = []

  if (headerIdx !== -1) {
    const startLine = Math.max(headerIdx, detailIdx)
    const sectionStart = Math.min(startLine + 1, lines.length)
    const endIdx = findSectionEnd(normalized, sectionStart)
    const sliceEnd = endIdx === -1 ? undefined : endIdx
    const section = lines.slice(sectionStart, sliceEnd)
    candidates.push({ section, startIdx: startLine, endIdx, strategy: 'header' })
  }

  if (detailIdx !== -1) {
    let sectionStart = detailIdx + 1
    let section = lines.slice(sectionStart)
    if (section.length && SECTION_HEADER_REGEX.test(section[0])) {
      sectionStart += 1
      section = section.slice(1)
    }
    const endIdx = findSectionEnd(normalized, sectionStart)
    const sliceEnd = endIdx === -1 ? undefined : endIdx
    section = lines.slice(sectionStart, sliceEnd)
    candidates.push({ section, startIdx: detailIdx, endIdx, strategy: 'detalhes' })
  }

  const fallbackStart = normalized.findIndex((line, index) => {
    if (!line) {
      return false
    }
    if (SECTION_START_REGEX.test(line) || SECTION_HEADER_REGEX.test(line)) {
      return false
    }
    if (SECTION_END_REGEX.test(line)) {
      return false
    }
    if (shouldIgnoreValue(line)) {
      return false
    }
    return isLikelyProductLine(line) && index < normalized.length - 1
  })

  if (fallbackStart !== -1) {
    const endIdx = findSectionEnd(normalized, fallbackStart)
    const sliceEnd = endIdx === -1 ? undefined : endIdx
    const section = lines.slice(fallbackStart, sliceEnd)
    candidates.push({ section, startIdx: fallbackStart - 1, endIdx, strategy: 'fallback' })
  }

  if (!candidates.length) {
    candidates.push({ section: [], startIdx: -1, endIdx: -1, strategy: 'fallback' })
  }

  const unique = candidates.filter((candidate, index, array) => {
    const key = `${candidate.startIdx}:${candidate.endIdx}`
    return array.findIndex((other) => `${other.startIdx}:${other.endIdx}` === key) === index
  })

  return unique
}

function findSectionEnd(lines: string[], start: number): number {
  if (start < 0) {
    return -1
  }
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) {
      continue
    }
    if (SECTION_END_REGEX.test(line)) {
      return index
    }
    if (FOOTER_TOTAL_REGEX.test(line)) {
      return index
    }
  }
  return -1
}

function mergeAdjacentDuplicates(items: ItemData[]): ItemData[] {
  if (items.length === 0) {
    return items
  }

  const merged: ItemData[] = []

  items.forEach((item) => {
    const last = merged[merged.length - 1]
    if (
      last &&
      (last.codigo ?? '').toLowerCase() === (item.codigo ?? '').toLowerCase() &&
      (last.modelo ?? '').toLowerCase() === (item.modelo ?? '').toLowerCase() &&
      (last.codigo || last.modelo)
    ) {
      if (last.quantidade !== null && item.quantidade !== null) {
        last.quantidade += item.quantidade
      } else if (last.quantidade === null) {
        last.quantidade = item.quantidade
      }
      if (item.descricao) {
        const combined = `${last.descricao} ${item.descricao}`.trim()
        last.descricao = combined.replace(/\s+/g, ' ')
      }
      if (!last.fabricante && item.fabricante) {
        last.fabricante = item.fabricante
      }
    } else {
      merged.push({ ...item })
    }
  })

  return merged
}

function parseBRL(value: string): number {
  const parsed = toNumberFlexible(value)
  return parsed != null && Number.isFinite(parsed) ? parsed : Number.NaN
}

function toISODate(raw: string): string {
  const [day, month, year] = raw.split('-')
  if (day && month && year) {
    return `${year}-${month}-${day}`
  }
  return raw
}

export type StructuredItem = ItemData
export type StructuredHeader = HeaderData
export type StructuredResumo = ResumoData

