import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const servicePath = path.resolve(process.cwd(), 'server/database/storageService.js')
const source = fs.readFileSync(servicePath, 'utf8')

describe('storage service RLS context', () => {
  it('uses createUserScopedSql with userId + role object', () => {
    expect(source).toContain('createUserScopedSql(this.sql, { userId, role: userRole })')
  })

  it('throws explicit error when internal role is missing', () => {
    expect(source).toContain("RLS_CONTEXT_MISSING_INTERNAL_ROLE")
  })
})
