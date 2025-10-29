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

function resolveDocumentBaseUrl(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  try {
    const baseUri = document.baseURI
    if (!baseUri) {
      return null
    }
    const url = new URL(baseUri)
    const pathname = url.pathname || DEFAULT_BASE_URL
    if (!pathname || pathname === DEFAULT_BASE_URL) {
      return DEFAULT_BASE_URL
    }

    if (pathname.endsWith('/')) {
      return pathname
    }

    const lastSlashIndex = pathname.lastIndexOf('/')
    const lastSegment = lastSlashIndex >= 0 ? pathname.slice(lastSlashIndex + 1) : pathname

    if (lastSegment.includes('.')) {
      const directoryPath = pathname.slice(0, lastSlashIndex + 1)
      return directoryPath || DEFAULT_BASE_URL
    }

    return ensureTrailingSlash(pathname)
  } catch (error) {
    return null
  }
}

function getConfiguredBaseUrl(): string {
  let base: string | null = null

  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const envBase = import.meta.env.BASE_URL
    if (typeof envBase === 'string' && envBase.trim()) {
      base = envBase
    }
  }

  if (!base) {
    base = resolveDocumentBaseUrl()
  }

  return normalizeBase(base ?? DEFAULT_BASE_URL)
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
  resolveDocumentBaseUrl,
  getConfiguredBaseUrl,
}
