const STRIP_TAGS_REGEX = /<[^>]*>/g
const STRIP_URL_REGEX = /\bhttps?:\/\/\S+/gi

const normalizeBreakLines = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n?/g, '\n')

export const sanitizePrintableText = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const cleaned = normalizeBreakLines(value)
    .replace(STRIP_TAGS_REGEX, ' ')
    .replace(STRIP_URL_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned ? cleaned : null
}

export default sanitizePrintableText
