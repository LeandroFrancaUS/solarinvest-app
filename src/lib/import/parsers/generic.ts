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

const POWER_UNIT_STRINGS = new Set(['W', 'KW', 'KWP'])

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
        const unitUpper = (fallback.unit ?? '').toUpperCase()
        if (!POWER_UNIT_STRINGS.has(unitUpper)) {
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

function isLabelValueLine(text: string): boolean {
  return /^[^\d][^:]*:\s*\S/.test(text)
}

export function extractCanonicalGrid(lines: string[]): CanonicalGrid {
  const rows: CanonicalRow[] = []
  let ignoredByNoise = 0
  let ignoredByValidation = 0

  const normalizedLines = lines.map((line) => cleanCell(line))

  const startIndex = normalizedLines.findIndex((line) => isHeaderLike(line))

  let endIndex = normalizedLines.findIndex((line, index) => index > startIndex && isFooterTrigger(line))
  if (endIndex === -1) {
    endIndex = lines.length
  }

  const section = lines.slice(startIndex + 1, endIndex)
  let current: CanonicalRow | null = null
  let pending: string | null = null

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
      const candidate = cleanCell(remaining.join(' '))
      if (current) {
        if (!isLabelValueLine(sanitized) && candidate && isValidProductText(candidate)) {
          pending = candidate
          current = null
        } else if (candidate) {
          const nextDescricao = current.descricao ? `${current.descricao} ${candidate}` : candidate
          current.descricao = truncateDescription(nextDescricao)
          current.raw.push(rawLine)
        }
      } else if (candidate && isValidProductText(candidate) && !isLabelValueLine(sanitized) && pending === null) {
        pending = candidate
      }
      continue
    }

    let { produto, descricao } = resolveProductAndDescription(remaining)
    if (!isValidProductText(produto) && pending !== null) {
      produto = pending
    }
    pending = null
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

  if (pending !== null) {
    rows.push({
      produto: pending,
      descricao: null,
      quantidade: 1,
      unidade: null,
      raw: [],
    })
  }

  return { rows, ignoredByNoise, ignoredByValidation }
}
