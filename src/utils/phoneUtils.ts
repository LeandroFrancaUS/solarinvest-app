import { normalizeNumbers } from './formatters'

export const formatWhatsappPhoneNumber = (value: string): string | null => {
  let digits = normalizeNumbers(value)

  if (!digits) {
    return null
  }

  digits = digits.replace(/^0+/, '')

  if (digits.startsWith('55')) {
    while (digits.length > 2 && digits[2] === '0') {
      digits = `55${digits.slice(3)}`
    }
  } else if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`
  } else {
    return null
  }

  if (digits.length < 12 || digits.length > 13) {
    return null
  }

  return digits
}
