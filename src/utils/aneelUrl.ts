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

// Cache env-derived values at module initialization to avoid repeated env lookups
const _proxyBase = (() => {
  if (typeof import.meta === 'undefined' || typeof import.meta.env === 'undefined') {
    return DEFAULT_PROXY_BASE
  }
  const env = import.meta.env as unknown as Record<string, string | undefined>
  if (Object.prototype.hasOwnProperty.call(env, 'VITE_ANEEL_PROXY_BASE')) {
    return sanitizeProxyBase(trimValue(env.VITE_ANEEL_PROXY_BASE))
  }
  return DEFAULT_PROXY_BASE
})()

const _directOrigin = (() => {
  if (typeof import.meta === 'undefined' || typeof import.meta.env === 'undefined') {
    return DEFAULT_ANEEL_ORIGIN
  }
  const customOrigin = sanitizeOrigin(trimValue(import.meta.env.VITE_ANEEL_DIRECT_ORIGIN) || DEFAULT_ANEEL_ORIGIN)
  return customOrigin || DEFAULT_ANEEL_ORIGIN
})()

export const resolveAneelUrl = (pathOrUrl: string): string => {
  const input = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : ''
  if (!input) {
    return input
  }

  const origin = _directOrigin
  let parsed: URL
  try {
    parsed = new URL(input, origin)
  } catch (error) {
    console.warn('[ANEEL] Não foi possível interpretar URL:', input, error)
    return input
  }

  const proxyBase = _proxyBase
  if (proxyBase) {
    const upstreamPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const encodedPath = encodeURIComponent(upstreamPath)
    // IMPORTANT: ANEEL proxy must stay same-origin in the browser.
    // If resolveApiUrl() injects a cross-origin VITE_API_URL (e.g. preview domain),
    // browsers can block the request with CORS/access-control checks.
    // Keep relative proxy URL in browser runtime; only resolve absolute base outside browser.
    const targetBase =
      typeof window !== 'undefined'
        ? proxyBase
        : resolveApiUrl(proxyBase)
    const separator = targetBase.includes('?') ? '&' : '?'
    return `${targetBase}${separator}path=${encodedPath}`
  }

  return parsed.href
}

export const getAneelRequestOrigin = (): string => {
  if (_proxyBase) {
    return resolveApiUrl(_proxyBase)
  }
  return _directOrigin
}
