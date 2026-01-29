const ABSOLUTE_URL_PATTERN = /^https?:\/\//i

const trimSlashes = (value: string): string => value.replace(/\/+$/, '')

const sanitizeBaseUrl = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (!ABSOLUTE_URL_PATTERN.test(trimmed)) {
    return ''
  }
  return trimSlashes(trimmed)
}

const resolveEnvBaseUrl = (): string => {
  // Quando executado no browser via Vite, import.meta.env estará disponível.
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const env = import.meta.env as Record<string, string | undefined>
    if (Object.prototype.hasOwnProperty.call(env, 'VITE_API_URL')) {
      const sanitized = sanitizeBaseUrl(env.VITE_API_URL)
      if (sanitized) {
        return sanitized
      }
    }
  }

  const globalProcess =
    typeof globalThis !== 'undefined'
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      : undefined

  if (globalProcess?.env) {
    const sanitized = sanitizeBaseUrl(globalProcess.env.VITE_API_URL)
    if (sanitized) {
      return sanitized
    }
  }

  return ''
}

const API_BASE_URL = resolveEnvBaseUrl()

export const getApiBaseUrl = (): string => API_BASE_URL

export const resolveApiUrl = (pathOrUrl: string): string => {
  const input = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : ''
  if (!input) {
    return ''
  }

  if (ABSOLUTE_URL_PATTERN.test(input)) {
    return input
  }

  const baseUrl = getApiBaseUrl()
  if (!baseUrl) {
    return input
  }

  if (input.startsWith('/')) {
    return `${baseUrl}${input}`
  }

  return `${baseUrl}/${input}`
}
