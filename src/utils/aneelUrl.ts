import { resolveApiUrl } from './apiUrl'

const DEFAULT_ANEEL_ORIGIN = 'https://dadosabertos.aneel.gov.br'
const DEFAULT_PROXY_BASE = '/api/aneel'

const trimValue = (value?: string) => (typeof value === 'string' ? value.trim() : '')

const sanitizeOrigin = (origin: string): string => {
  if (!origin) {
    return DEFAULT_ANEEL_ORIGIN
  }
  const trimmed = origin.trim()
  if (!trimmed) {
    return DEFAULT_ANEEL_ORIGIN
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return DEFAULT_ANEEL_ORIGIN
  }
  return trimmed.replace(/\/+$/, '')
}

const sanitizeProxyBase = (base: string): string => {
  if (!base) {
    return ''
  }
  const trimmed = base.trim()
  if (!trimmed) {
    return ''
  }
  if (!trimmed.startsWith('/')) {
    return ''
  }
  return trimmed.replace(/\/+$/, '') || '/'
}

const getProxyBase = (): string => {
  if (typeof import.meta === 'undefined' || typeof import.meta.env === 'undefined') {
    return DEFAULT_PROXY_BASE
  }

  const env = import.meta.env as Record<string, string | undefined>
  if (Object.prototype.hasOwnProperty.call(env, 'VITE_ANEEL_PROXY_BASE')) {
    return sanitizeProxyBase(trimValue(env.VITE_ANEEL_PROXY_BASE))
  }

  return DEFAULT_PROXY_BASE
}

const getDirectOrigin = (): string => {
  if (typeof import.meta === 'undefined' || typeof import.meta.env === 'undefined') {
    return DEFAULT_ANEEL_ORIGIN
  }
  const customOrigin = sanitizeOrigin(trimValue(import.meta.env.VITE_ANEEL_DIRECT_ORIGIN) || DEFAULT_ANEEL_ORIGIN)
  return customOrigin || DEFAULT_ANEEL_ORIGIN
}

export const resolveAneelUrl = (pathOrUrl: string): string => {
  const input = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : ''
  if (!input) {
    return input
  }

  const origin = getDirectOrigin()
  let parsed: URL
  try {
    parsed = new URL(input, origin)
  } catch (error) {
    console.warn('[ANEEL] Não foi possível interpretar URL:', input, error)
    return input
  }

  const proxyBase = getProxyBase()
  if (proxyBase) {
    const upstreamPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const encodedPath = encodeURIComponent(upstreamPath)
    const targetBase = resolveApiUrl(proxyBase)
    const separator = targetBase.includes('?') ? '&' : '?'
    return `${targetBase}${separator}path=${encodedPath}`
  }

  return parsed.href
}

export const getAneelRequestOrigin = (): string => {
  const proxyBase = getProxyBase()
  if (proxyBase) {
    return resolveApiUrl(proxyBase)
  }
  return getDirectOrigin()
}
