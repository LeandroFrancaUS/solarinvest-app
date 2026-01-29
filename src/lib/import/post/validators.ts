import { containsBudgetNoiseKeyword } from './noise_filters'

const HEADER_KEYWORDS = [/^produto$/i, /^descri[cç][aã]o$/i, /^item$/i, /^quantidade$/i, /^qtd$/i, /^qtde$/i]

const FORBIDDEN_PRODUCT_TERMS = [
  /resumo/i,
  /acess[oó]rios/i,
  /servi[cç]os/i,
  /condi[cç][aã]o/i,
  /pagamento/i,
  /cliente/i,
  /comercial/i,
]

export function isValidProductText(text: string): boolean {
  if (!text) {
    return false
  }
  const normalized = text.trim()
  if (normalized.length < 5) {
    return false
  }
  if (HEADER_KEYWORDS.some((pattern) => pattern.test(normalized))) {
    return false
  }
  if (FORBIDDEN_PRODUCT_TERMS.some((pattern) => pattern.test(normalized))) {
    return false
  }
  if (containsBudgetNoiseKeyword(normalized)) {
    return false
  }
  return true
}

export function isValidQuantity(value: number | null): value is number {
  if (value === null || Number.isNaN(value)) {
    return false
  }
  if (!Number.isFinite(value)) {
    return false
  }
  if (value <= 0) {
    return false
  }
  if (!Number.isInteger(value)) {
    return false
  }
  return true
}

export function isLikelyHeaderRow(values: string[]): boolean {
  if (!values.length) {
    return false
  }
  const normalized = values.map((value) => value.trim().toLowerCase())
  const hasProduto = normalized.some((value) => value.includes('produto') || value.includes('item'))
  const hasQuantidade = normalized.some((value) => value.includes('quantidade') || value.includes('qtde') || value.includes('qtd'))
  return hasProduto && hasQuantidade
}

export function truncateDescription(text: string, limit = 120): string {
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, limit - 1).trim()}…`
}
