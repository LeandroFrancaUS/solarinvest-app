import { formatMoneyBR, formatMoneyBRWithDigits } from '../lib/locale/br-number'

export const currency = (value: number) => formatMoneyBR(value)

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
