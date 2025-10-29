const DEFAULT_BASE_URL = '/'

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function normalizeBase(base: string): string {
  const trimmed = base.trim()
  if (!trimmed) {
    return DEFAULT_BASE_URL
  }
  const withLeadingSlash = ensureLeadingSlash(trimmed)
  const withTrailingSlash = ensureTrailingSlash(withLeadingSlash)
  return withTrailingSlash === '//' ? DEFAULT_BASE_URL : withTrailingSlash
}

function getConfiguredBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const base = import.meta.env.BASE_URL
    if (typeof base === 'string' && base.trim()) {
      return normalizeBase(base)
    }
  }
  return DEFAULT_BASE_URL
}

function normalizeAssetPath(assetPath: string): string {
  return assetPath.replace(/^\/+/, '')
}

export function resolvePublicAssetPath(assetPath: string, baseUrl: string = getConfiguredBaseUrl()): string {
  const normalizedBase = normalizeBase(baseUrl)
  const normalizedAsset = normalizeAssetPath(assetPath)
  if (!normalizedAsset) {
    return normalizedBase === DEFAULT_BASE_URL ? DEFAULT_BASE_URL : normalizedBase
  }
  if (normalizedBase === DEFAULT_BASE_URL) {
    return `${DEFAULT_BASE_URL}${normalizedAsset}`
  }
  return `${normalizedBase}${normalizedAsset}`
}

export function getPublicAssetBaseUrl(): string {
  return normalizeBase(getConfiguredBaseUrl())
}

// Exporting helpers for tests.
export const __private__ = {
  ensureLeadingSlash,
  ensureTrailingSlash,
  normalizeBase,
  normalizeAssetPath,
}
