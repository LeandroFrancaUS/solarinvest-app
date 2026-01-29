import { describe, expect, it, vi } from 'vitest'

import { __private__, resolvePublicAssetPath } from './publicAssets'

const {
  ensureLeadingSlash,
  ensureTrailingSlash,
  normalizeBase,
  normalizeAssetPath,
  resolveDocumentBaseUrl,
} = __private__

describe('publicAssets utils', () => {
  describe('ensureLeadingSlash', () => {
    it('adds a leading slash when missing', () => {
      expect(ensureLeadingSlash('foo')).toBe('/foo')
    })

    it('keeps the leading slash when present', () => {
      expect(ensureLeadingSlash('/foo')).toBe('/foo')
    })
  })

  describe('ensureTrailingSlash', () => {
    it('adds a trailing slash when missing', () => {
      expect(ensureTrailingSlash('/foo')).toBe('/foo/')
    })

    it('keeps the trailing slash when present', () => {
      expect(ensureTrailingSlash('/foo/')).toBe('/foo/')
    })
  })

  describe('normalizeBase', () => {
    it('returns root when input is empty', () => {
      expect(normalizeBase('')).toBe('/')
    })

    it('normalizes missing leading slash', () => {
      expect(normalizeBase('foo/bar')).toBe('/foo/bar/')
    })

    it('normalizes missing trailing slash', () => {
      expect(normalizeBase('/foo')).toBe('/foo/')
    })

    it('keeps normalized base unchanged', () => {
      expect(normalizeBase('/foo/bar/')).toBe('/foo/bar/')
    })
  })

  describe('normalizeAssetPath', () => {
    it('strips leading slashes', () => {
      expect(normalizeAssetPath('/foo/bar.csv')).toBe('foo/bar.csv')
    })

    it('keeps path without leading slash', () => {
      expect(normalizeAssetPath('foo/bar.csv')).toBe('foo/bar.csv')
    })
  })

  describe('resolvePublicAssetPath', () => {
    it('uses root base by default', () => {
      expect(resolvePublicAssetPath('tilted_latitude_means.csv', '/')).toBe('/tilted_latitude_means.csv')
    })

    it('removes leading slash from asset', () => {
      expect(resolvePublicAssetPath('/tilted_latitude_means.csv', '/')).toBe('/tilted_latitude_means.csv')
    })

    it('prefixes asset with provided base', () => {
      expect(resolvePublicAssetPath('tilted_latitude_means.csv', '/simulador/')).toBe('/simulador/tilted_latitude_means.csv')
    })

    it('normalizes base without slashes', () => {
      expect(resolvePublicAssetPath('tilted_latitude_means.csv', 'simulador')).toBe('/simulador/tilted_latitude_means.csv')
    })

    it('returns normalized base when asset path is empty', () => {
      expect(resolvePublicAssetPath('', '/simulador')).toBe('/simulador/')
    })
  })

  describe('resolveDocumentBaseUrl', () => {
    it('extracts pathname from document.baseURI', () => {
      const spy = vi.spyOn(document, 'baseURI', 'get').mockReturnValue('https://example.com/me/dashboard')

      expect(resolveDocumentBaseUrl()).toBe('/me/')

      spy.mockRestore()
    })

    it('normalizes pathname without trailing slash', () => {
      const spy = vi.spyOn(document, 'baseURI', 'get').mockReturnValue('https://example.com/me')

      expect(resolveDocumentBaseUrl()).toBe('/me/')

      spy.mockRestore()
    })

    it('strips file segment from baseURI', () => {
      const spy = vi.spyOn(document, 'baseURI', 'get').mockReturnValue('https://example.com/app/index.html')

      expect(resolveDocumentBaseUrl()).toBe('/app/')

      spy.mockRestore()
    })

    it('returns null when baseURI is missing', () => {
      const spy = vi.spyOn(document, 'baseURI', 'get').mockReturnValue('')

      expect(resolveDocumentBaseUrl()).toBeNull()

      spy.mockRestore()
    })
  })
})
