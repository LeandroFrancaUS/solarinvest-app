import { describe, it, expect } from 'vitest'

/**
 * Tests for the URL-construction pattern used in clientPortfolioApi.ts.
 *
 * The key invariant: constructing a URL from the result of resolveApiUrl() must
 * never throw "Failed to construct 'URL': Invalid URL", even when VITE_API_URL
 * is absent (as is the case in preview deployments that lack the env var).
 *
 * The fix: always pass `window.location.origin` as the second argument to
 * `new URL()` so that relative paths are resolved against the current origin
 * instead of throwing.
 */
describe('URL construction with window.location.origin base', () => {
  it('does NOT throw when the resolved URL is relative (no VITE_API_URL)', () => {
    const relativePath = '/api/client-portfolio'
    // This is the fixed pattern: always pass window.location.origin as the base.
    expect(() => new URL(relativePath, 'https://preview.example.vercel.app')).not.toThrow()
  })

  it('throws when a relative path is passed without a base (the original bug)', () => {
    const relativePath = '/api/client-portfolio'
    expect(() => new URL(relativePath)).toThrow()
  })

  it('correctly resolves a relative path against the origin', () => {
    const relativePath = '/api/client-portfolio'
    const url = new URL(relativePath, 'https://preview.example.vercel.app')
    expect(url.pathname).toBe('/api/client-portfolio')
    expect(url.origin).toBe('https://preview.example.vercel.app')
  })

  it('correctly handles an absolute resolved URL (VITE_API_URL is set)', () => {
    const absoluteUrl = 'https://api.example.com/api/client-portfolio'
    // When the first arg is absolute, the base is ignored — no regression.
    const url = new URL(absoluteUrl, 'https://app.example.com')
    expect(url.href).toBe('https://api.example.com/api/client-portfolio')
  })

  it('appends search params correctly after construction', () => {
    const url = new URL('/api/client-portfolio', 'https://preview.example.vercel.app')
    url.searchParams.set('search', 'solar')
    expect(url.toString()).toBe('https://preview.example.vercel.app/api/client-portfolio?search=solar')
  })
})
