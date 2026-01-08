import { describe, expect, it } from 'vitest'
import { sanitizeFileName } from '../graphDrive.js'

describe('sanitizeFileName', () => {
  it('replaces invalid characters', () => {
    const result = sanitizeFileName('contrato<>:"/\\|?*.docx')
    expect(result).toBe('contrato_________.docx')
  })

  it('creates fallback name when empty', () => {
    const result = sanitizeFileName('')
    expect(result.startsWith('document-')).toBe(true)
    expect(result.endsWith('.docx')).toBe(true)
  })
})
