const HEADER_PATTERNS = {
  numeroOrcamento: /N[úu]mero do Or[cç]amento:\s*([A-Za-z0-9\-/.]+)/i,
  validade: /Or[cç]amento V[áa]lido at[ée]:\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i,
  de: /De:\s*(.+)$/i,
  para: /Para:\s*(.+)$/i,
}

const SECTION_HEADER_REGEX = /Produto\s+Quantidade/i
const FOOTER_TOTAL_REGEX = /Valor\s+total:\s*R?\$?\s*([\d.,]+)/i
const CODE_MODEL_QTY_REGEX = /C[óo]digo:\s*(.+?)\s+Modelo:\s*(.+?)\s+(\d+)\s*$/i
const CODIGO_REGEX = /C[óo]digo:\s*(.+)$/i
const MODELO_REGEX = /Modelo:\s*(.+)$/i
const QUANTIDADE_REGEX = /Quantidade:\s*(\d+)/i
const FABRICANTE_REGEX = /Fabricante:\s*(.*)$/i
const UNIT_PRICE_REGEX = /R\$\s*([\d.,]+)\s*(?:\/\s*un|unidade)\b/i
const TOTAL_PRICE_REGEX = /\b(?:Valor:)?\s*R\$\s*([\d.,]+)\b/i

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

export function deriveSection(
  lines: string[],
): { section: string[]; startIdx: number; endIdx: number } {
  const startIdx = lines.findIndex((line) => SECTION_HEADER_REGEX.test(line))
  const endIdx = (() => {
    if (startIdx === -1) return -1
    const offset = lines.slice(startIdx + 1).findIndex((line) => FOOTER_TOTAL_REGEX.test(line))
    return offset === -1 ? -1 : startIdx + 1 + offset
  })()

  const section =
    startIdx !== -1
      ? lines.slice(startIdx + 1, endIdx === -1 ? undefined : endIdx)
      : []

  return { section, startIdx, endIdx }
}

function parseItems(lines: string[]): { itens: ItemData[]; warnings: string[] } {
  const itens: ItemData[] = []
  const warnings: string[] = []
  const { section } = deriveSection(lines)

  let curr: ItemData | null = null

  const ensureCurr = () => {
    if (!curr) {
      curr = newItem()
    }
  }

  const push = () => {
    if (!curr) return
    if (!curr.produto) {
      curr = null
      return
    }
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
      }
    }
    itens.push(curr)
    curr = null
  }

  section.forEach((raw) => {
    const line = raw.trim()
    if (!line) {
      return
    }

    const codeModelQty = line.match(CODE_MODEL_QTY_REGEX)
    if (codeModelQty) {
      ensureCurr()
      curr!.codigo = codeModelQty[1].trim() || null
      curr!.modelo = codeModelQty[2].trim() || null
      const quantity = parseInt(codeModelQty[3], 10)
      curr!.quantidade = Number.isNaN(quantity) ? null : quantity
      return
    }

    if (!line.includes(':') && line.length > 6) {
      if (curr && curr.produto) {
        push()
      }
      curr = newItem()
      curr.produto = line.trim()
      return
    }

    const codigo = line.match(CODIGO_REGEX)
    if (codigo) {
      ensureCurr()
      curr!.codigo = codigo[1].trim() || null
      return
    }

    const modelo = line.match(MODELO_REGEX)
    if (modelo) {
      ensureCurr()
      curr!.modelo = modelo[1].trim() || null
      return
    }

    const quantidade = line.match(QUANTIDADE_REGEX)
    if (quantidade) {
      ensureCurr()
      const quantity = parseInt(quantidade[1], 10)
      curr!.quantidade = Number.isNaN(quantity) ? null : quantity
      return
    }

    const fabricante = line.match(FABRICANTE_REGEX)
    if (fabricante) {
      const fab = fabricante[1].trim()
      if (fab) {
        ensureCurr()
        curr!.descricao = curr!.descricao
          ? `${curr!.descricao} Fabricante: ${fab}`
          : `Fabricante: ${fab}`
      }
      return
    }

    let matchedPrice = false
    const unitMatch = line.match(UNIT_PRICE_REGEX)
    if (unitMatch) {
      ensureCurr()
      const value = parseBRL(unitMatch[1])
      if (!Number.isNaN(value)) {
        curr!.precoUnitario = value
        matchedPrice = true
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
      }
    }
    if (matchedPrice) {
      return
    }

    if (curr) {
      curr.descricao = curr.descricao
        ? `${curr.descricao} ${line}`.trim()
        : line
    }
  })

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
  return resumo
}

function formatQuantityForCsv(value: number): string {
  return `${Math.round(value)}`
}

function formatCurrencyForCsv(value: number): string {
  return value.toFixed(2)
}

function newItem(): ItemData {
  return {
    produto: null,
    codigo: null,
    modelo: null,
    descricao: '',
    quantidade: null,
    unidade: 'un',
    precoUnitario: null,
    precoTotal: null,
  }
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
    } else {
      merged.push({ ...item })
    }
  })

  return merged
}

function parseBRL(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
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

