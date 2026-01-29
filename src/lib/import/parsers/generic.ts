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

export function extractCanonicalGrid(lines: string[]): CanonicalGrid {
  const rows: CanonicalRow[] = []
  let ignoredByNoise = 0
  let ignoredByValidation = 0

  const normalizedLines = lines.map((line) => cleanCell(line))

  let startIndex = normalizedLines.findIndex((line) => isHeaderLike(line))
  if (startIndex === -1) {
    startIndex = 0
  }

  let endIndex = normalizedLines.findIndex((line, index) => index > startIndex && isFooterTrigger(line))
  if (endIndex === -1) {
    endIndex = lines.length
  }

  const section = lines.slice(startIndex + 1, endIndex)
  let current: CanonicalRow | null = null

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
        if (hasNoise(sanitized)) {
          ignoredByNoise += 1
          continue
        }
        const extra = cleanCell(remaining.join(' '))
        if (extra) {
          const nextDescricao = current.descricao ? `${current.descricao} ${extra}` : extra
          current.descricao = truncateDescription(nextDescricao)
          current.raw.push(rawLine)
        }
      }
      continue
    }

    const { produto, descricao } = resolveProductAndDescription(remaining)
    if (!isValidProductText(produto)) {
      ignoredByValidation += 1
      current = null
      continue
    }
    if (!isValidQuantity(quantity)) {
      ignoredByValidation += 1
      current = null
      continue
    }

    const row: CanonicalRow = {
      produto,
      descricao,
      quantidade: quantity,
      unidade: unit ? normalizeUnit(unit) : null,
      raw: [rawLine],
    }
    rows.push(row)
    current = row
  }

  return { rows, ignoredByNoise, ignoredByValidation }
}
