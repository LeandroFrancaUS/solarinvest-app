import { formatMoneyBR, formatMoneyBRWithDigits, formatNumberBRWithOptions } from '../lib/locale/br-number'
import type { LeasingEndereco } from '../store/useLeasingStore'

export const currency = (value: number) => formatMoneyBR(value)

const fmtCurrencyBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formata um valor numérico como moeda brasileira (BRL).
 * Aceita number, string numérica, null ou undefined.
 * Retorna "R$ 0,00" para valores inválidos, nulos ou indefinidos.
 *
 * @example
 * formatCurrencyBRL(25740.350877) // "R$ 25.740,35"
 * formatCurrencyBRL("1000")       // "R$ 1.000,00"
 * formatCurrencyBRL(null)         // "R$ 0,00"
 */
export function formatCurrencyBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00'
  const numericValue = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(numericValue)) return 'R$ 0,00'
  return fmtCurrencyBRL.format(numericValue)
}

export const tarifaCurrency = (value: number) => formatMoneyBRWithDigits(value, 3)

export const formatAxis = (value: number) => {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (absolute >= 10_000) {
    return `${Math.round(value / 1000)}k`
  }
  return currency(value)
}

export const normalizeNumbers = (value: string) => value.replace(/\D+/g, '')

export const formatCpfCnpj = (value: string) => {
  const digitsOnly = normalizeNumbers(value)
  if (!digitsOnly) {
    return ''
  }

  if (digitsOnly.length <= 11) {
    const digits = digitsOnly.slice(0, 11)
    const part1 = digits.slice(0, 3)
    const part2 = digits.slice(3, 6)
    const part3 = digits.slice(6, 9)
    const part4 = digits.slice(9, 11)

    return [
      part1,
      part2 ? `.${part2}` : '',
      part3 ? `.${part3}` : '',
      part4 ? `-${part4}` : '',
    ]
      .join('')
      .replace(/\.$/, '')
      .replace(/-$/, '')
  }

  const digits = digitsOnly.slice(0, 14)
  const part1 = digits.slice(0, 2)
  const part2 = digits.slice(2, 5)
  const part3 = digits.slice(5, 8)
  const part4 = digits.slice(8, 12)
  const part5 = digits.slice(12, 14)

  return [
    part1,
    part2 ? `.${part2}` : '',
    part3 ? `.${part3}` : '',
    part4 ? `/${part4}` : '',
    part5 ? `-${part5}` : '',
  ]
    .join('')
    .replace(/\.$/, '')
    .replace(/\/$/, '')
    .replace(/-$/, '')
}

export const formatCep = (value: string) => {
  const digits = normalizeNumbers(value).slice(0, 8)
  if (!digits) {
    return ''
  }

  if (digits.length <= 5) {
    return digits
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export const formatTelefone = (value: string) => {
  const digits = normalizeNumbers(value).slice(0, 11)
  if (!digits) {
    return ''
  }

  if (digits.length <= 2) {
    return `(${digits}${digits.length === 2 ? ')' : ''}`
  }

  const ddd = digits.slice(0, 2)
  const remaining = digits.slice(2)

  if (!remaining) {
    return `(${ddd}`
  }

  if (remaining.length <= 4) {
    return `(${ddd}) ${remaining}`
  }

  if (remaining.length <= 8) {
    const part1 = remaining.slice(0, 4)
    const part2 = remaining.slice(4)
    return part2 ? `(${ddd}) ${part1}-${part2}` : `(${ddd}) ${part1}`
  }

  const part1 = remaining.slice(0, 5)
  const part2 = remaining.slice(5)
  return part2 ? `(${ddd}) ${part1}-${part2}` : `(${ddd}) ${part1}`
}

const formatKwhValue = (value: number | null | undefined, digits = 2): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumberBRWithOptions(value, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  }
  return null
}

export const formatKwhWithUnit = (value: number | null | undefined, digits = 2): string | null => {
  const formatted = formatKwhValue(value, digits)
  return formatted ? `${formatted} kWh` : null
}

export const formatUcGeradoraTitularEndereco = (
  endereco?: LeasingEndereco | null,
): string => {
  if (!endereco) {
    return ''
  }
  const logradouro = endereco.logradouro?.trim() ?? ''
  const numero = endereco.numero?.trim() ?? ''
  const complemento = endereco.complemento?.trim() ?? ''
  const bairro = endereco.bairro?.trim() ?? ''
  const cidade = endereco.cidade?.trim() ?? ''
  const uf = endereco.uf?.trim() ?? ''
  const cep = endereco.cep?.trim() ?? ''
  const primeiraLinha = [logradouro, numero].filter(Boolean).join(', ')
  const primeiraLinhaCompleta =
    complemento && primeiraLinha ? `${primeiraLinha}, ${complemento}` : primeiraLinha || complemento
  const partes = [
    primeiraLinhaCompleta,
    bairro || '',
    [cidade, uf].filter(Boolean).join('/'),
    cep ? `CEP ${cep}` : '',
  ].filter(Boolean)
  return partes.join(' — ')
}

/** Retorna true quando `valor` é vazio ou corresponde a um e-mail válido. */
export const emailValido = (valor: string): boolean => {
  if (!valor) {
    return true
  }
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(valor)
}

/** Formata um número de bytes para exibição legível (B, KB, MB, GB). */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes || !Number.isFinite(bytes)) {
    return ''
  }
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const formatted = unitIndex === 0 ? size.toString() : size.toFixed(size >= 100 ? 0 : 1)
  return `${formatted.replace('.', ',')} ${units[unitIndex]}`
}
