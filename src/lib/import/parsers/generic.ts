import { sanitizeNoiseText, isHeaderLike, isFooterTrigger, hasNoise } from '../post/noise_filters'
import { ensureInteger, normalizeUnit, parseQuantityToken } from '../post/units'
import { isLikelyHeaderRow, isValidProductText, isValidQuantity, truncateDescription } from '../post/validators'

export type CanonicalRow = {
  produto: string
  descricao: string | null
  quantidade: number | null
  unidade: string | null
  raw: string[]
}

export type CanonicalGrid = {
  rows: CanonicalRow[]
  ignoredByNoise: number
  ignoredByValidation: number
}

const MULTI_COLUMN_SEPARATOR = /\s{2,}/

function cleanCell(value: string): string {
  return sanitizeNoiseText(value)
    .replace(/^[-–—•·●▪︎◦]+/g, '')
    .replace(/^[0-9]+\./, '')
    .trim()
}

function splitColumns(line: string): string[] {
  if (line.includes('|')) {
    return line
      .split('|')
      .map((value) => cleanCell(value))
      .filter(Boolean)
  }
  if (line.includes('\t')) {
    return line
      .split(/\t+/)
      .map((value) => cleanCell(value))
      .filter(Boolean)
  }
  if (line.includes(';')) {
    const parts = line
      .split(';')
      .map((value) => cleanCell(value))
      .filter(Boolean)
    if (parts.length > 1) {
      return parts
    }
  }
  const multi = line
    .split(MULTI_COLUMN_SEPARATOR)
    .map((value) => cleanCell(value))
    .filter(Boolean)
  if (multi.length > 1) {
    return multi
  }
  return [cleanCell(line)]
}

function extractQuantityFromParts(parts: string[]): {
  remaining: string[]
  quantity: number | null
  unit: string | null
} {
  const remaining = [...parts]
  for (let index = remaining.length - 1; index >= 0; index -= 1) {
    const token = remaining[index]
    const parsed = parseQuantityToken(token)
    if (!parsed) {
      continue
    }
    let { unit } = parsed
    remaining.splice(index, 1)
    if (!unit && index < parts.length - 1) {
      const nextToken = parts[index + 1]
      const resolved = normalizeUnit(nextToken)
      if (resolved) {
        unit = resolved
        const nextIndex = remaining.indexOf(nextToken)
        if (nextIndex >= 0) {
          remaining.splice(nextIndex, 1)
        }
      }
    }
    const quantity = ensureInteger(parsed.quantity)
    return { remaining, quantity, unit: unit ?? null }
  }
  return { remaining: parts, quantity: null, unit: null }
}

function extractQuantity(line: string, columns: string[]): {
  remaining: string[]
  quantity: number | null
  unit: string | null
} {
  const attempt = extractQuantityFromParts(columns)
  if (attempt.quantity !== null) {
    return attempt
  }
  if (columns.length === 1) {
    const words = columns[0]
      .split(/\s+/)
      .map((value) => cleanCell(value))
      .filter(Boolean)
    if (words.length > 1) {
      const fallback = extractQuantityFromParts(words)
      if (fallback.quantity !== null) {
        return {
          remaining: fallback.remaining.length
            ? [fallback.remaining.join(' ')]
            : [],
          quantity: fallback.quantity,
          unit: fallback.unit,
        }
      }
    }
  }
  const parsedFull = parseQuantityToken(line)
  if (parsedFull) {
    const quantity = ensureInteger(parsedFull.quantity)
    return { remaining: columns, quantity, unit: parsedFull.unit }
  }
  return { remaining: columns, quantity: null, unit: null }
}

function resolveProductAndDescription(columns: string[]): {
  produto: string
  descricao: string | null
} {
  const textual = columns.map((value) => cleanCell(value)).filter(Boolean)
  if (!textual.length) {
    return { produto: '', descricao: null }
  }
  if (textual.length === 1) {
    return { produto: textual[0], descricao: null }
  }
  let longestIndex = 0
  for (let index = 1; index < textual.length; index += 1) {
    if (textual[index].length > textual[longestIndex].length) {
      longestIndex = index
    }
  }
  const produto = textual[longestIndex]
  const descricaoParts = textual.filter((_, index) => index !== longestIndex)
  const descricao = descricaoParts.join(' | ')
  return {
    produto,
    descricao: descricao ? truncateDescription(descricao) : null,
  }
}

function isIgnorableLine(line: string): boolean {
  if (!line) {
    return true
  }
  if (hasNoise(line)) {
    return true
  }
  const columns = splitColumns(line)
  if (isLikelyHeaderRow(columns)) {
    return true
  }
  return false
}

// Power-related units that should not be auto-extracted as a quantity when embedded in
// a product name — the explicit "Qtd:" / "Quantidade:" line takes precedence.
const POWER_UNITS = new Set(['W', 'KW', 'KWP', 'KVA', 'MW'])

function isPowerUnit(unit: string | null | undefined): boolean {
  if (!unit) return false
  return POWER_UNITS.has(unit.toUpperCase())
}

function flushPendingProduct(
  pendingProduct: string,
  rows: CanonicalRow[],
): CanonicalRow | null {
  const words = pendingProduct
    .split(/\s+/)
    .map((v) => cleanCell(v))
    .filter(Boolean)
  const fallback = extractQuantityFromParts(words)
  if (fallback.quantity === null || !isValidQuantity(fallback.quantity)) {
    return null
  }
  const produto = fallback.remaining.join(' ').trim()
  if (!isValidProductText(produto)) {
    return null
  }
  const row: CanonicalRow = {
    produto,
    descricao: null,
    quantidade: fallback.quantity,
    unidade: fallback.unit ? normalizeUnit(fallback.unit) : null,
    raw: [pendingProduct],
  }
  rows.push(row)
  return row
}

export function extractCanonicalGrid(lines: string[]): CanonicalGrid {
  const rows: CanonicalRow[] = []
  let ignoredByNoise = 0
  let ignoredByValidation = 0

  const normalizedLines = lines.map((line) => cleanCell(line))

  // When no explicit header is found, start from line 0 so no product lines are skipped.
  const headerIndex = normalizedLines.findIndex((line) => isHeaderLike(line))
  const sectionStart = headerIndex === -1 ? 0 : headerIndex + 1

  let endIndex = normalizedLines.findIndex((line, index) => index > (headerIndex === -1 ? -1 : headerIndex) && isFooterTrigger(line))
  if (endIndex === -1) {
    endIndex = lines.length
  }

  const section = lines.slice(sectionStart, endIndex)
  let current: CanonicalRow | null = null
  // Product line whose quantity has not yet been resolved (waiting for explicit "Qtd:" line).
  let pendingProduct: string | null = null

  for (const rawLine of section) {
    const sanitized = cleanCell(rawLine)
    if (!sanitized) {
      continue
    }
    if (hasNoise(sanitized)) {
      ignoredByNoise += 1
      continue
    }
    if (isIgnorableLine(sanitized)) {
      continue
    }

    const columns = splitColumns(sanitized)
    const { remaining, quantity, unit } = extractQuantity(sanitized, columns)

    if (quantity === null) {
      if (current) {
        const extra = cleanCell(remaining.join(' '))
        if (extra) {
          const nextDescricao = current.descricao ? `${current.descricao} ${extra}` : extra
          current.descricao = truncateDescription(nextDescricao)
          current.raw.push(rawLine)
        }
      } else if (pendingProduct === null && isValidProductText(sanitized)) {
        // No current row and no pending yet — treat this as a pending product so that
        // a following explicit "Qtd:" / "Quantidade:" line can provide the quantity.
        pendingProduct = sanitized
      }
      continue
    }

    // Single-column line whose only extractable quantity is a power-spec (e.g. 610W, 8kW).
    // Treat the full line as a pending product so the product name is preserved intact
    // and an upcoming explicit "Qtd:" / "Quantidade:" line can provide the real quantity.
    const normalizedUnit = normalizeUnit(unit)
    if (columns.length === 1 && isPowerUnit(normalizedUnit)) {
      // Flush any previous un-consumed pending first.
      if (pendingProduct !== null) {
        const flushed = flushPendingProduct(pendingProduct, rows)
        if (flushed) current = flushed
      }
      pendingProduct = sanitized
      current = null
      continue
    }

    const { produto, descricao } = resolveProductAndDescription(remaining)

    if (!isValidProductText(produto)) {
      // Explicit quantity-only line (e.g. "Quantidade: 8" or "Qtd: 8 un") with no
      // remaining product text — associate with the pending product or update current.
      if (pendingProduct !== null) {
        if (isValidQuantity(quantity)) {
          const row: CanonicalRow = {
            produto: pendingProduct,
            descricao: null,
            quantidade: quantity,
            unidade: normalizedUnit ?? null,
            raw: [rawLine],
          }
          rows.push(row)
          current = row
          pendingProduct = null
        } else {
          ignoredByValidation += 1
          pendingProduct = null
        }
        continue
      }
      if (current !== null && remaining.length === 0) {
        // Update the most recently added row with the explicit quantity.
        if (isValidQuantity(quantity)) {
          current.quantidade = quantity
          if (normalizedUnit) current.unidade = normalizedUnit
          current.raw.push(rawLine)
        }
        continue
      }
      ignoredByValidation += 1
      current = null
      continue
    }

    if (!isValidQuantity(quantity)) {
      ignoredByValidation += 1
      current = null
      continue
    }

    // Flush any un-consumed pending product before adding a new regular row.
    if (pendingProduct !== null) {
      const flushed = flushPendingProduct(pendingProduct, rows)
      if (flushed) current = flushed
      pendingProduct = null
    }

    const row: CanonicalRow = {
      produto,
      descricao,
      quantidade: quantity,
      unidade: normalizedUnit ?? null,
      raw: [rawLine],
    }
    rows.push(row)
    current = row
  }

  // Flush any trailing pending product that had no explicit quantity line.
  if (pendingProduct !== null) {
    flushPendingProduct(pendingProduct, rows)
  }

  return { rows, ignoredByNoise, ignoredByValidation }
}
