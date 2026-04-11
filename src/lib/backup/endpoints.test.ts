import { describe, it, expect } from 'vitest'
import { BACKUP_EXPORT_ENDPOINT, BACKUP_IMPORT_ENDPOINT } from './endpoints'

describe('backup endpoints separation', () => {
  it('uses a dedicated import endpoint', () => {
    expect(BACKUP_IMPORT_ENDPOINT).toBe('/api/admin/database-backup/import')
    expect(BACKUP_IMPORT_ENDPOINT).not.toBe(BACKUP_EXPORT_ENDPOINT)
  })
})
