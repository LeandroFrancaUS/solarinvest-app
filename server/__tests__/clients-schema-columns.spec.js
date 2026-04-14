import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const repoPath = path.resolve(process.cwd(), 'server/clients/repository.js')
const source = fs.readFileSync(repoPath, 'utf8')

describe('clients repository schema usage', () => {
  it('uses canonical client_* columns in UPDATE clients statement', () => {
    expect(source).toContain('UPDATE clients SET')
    expect(source).toContain('client_name      = COALESCE')
    expect(source).toContain('client_email     = COALESCE')
    expect(source).toContain('client_phone     = COALESCE')
    expect(source).toContain('client_city      = COALESCE')
    expect(source).toContain('client_state     = COALESCE')
    expect(source).toContain('consumption_kwh_month = COALESCE')
  })

  it('does not update legacy client columns (name/email/phone/city/state/consumption)', () => {
    expect(source).not.toMatch(/\bname\s*=\s*COALESCE\(\$/)
    expect(source).not.toMatch(/\bemail\s*=\s*COALESCE\(\$/)
    expect(source).not.toMatch(/\bphone\s*=\s*COALESCE\(\$/)
    expect(source).not.toMatch(/\bcity\s*=\s*COALESCE\(\$/)
    expect(source).not.toMatch(/\bstate\s*=\s*COALESCE\(\$/)
    expect(source).not.toMatch(/\bconsumption\s*=\s*COALESCE\(\$/)
  })
})
