import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { isGraphConfigured } from '../graphConfig.js'

const ORIGINAL_ENV = { ...process.env }

const setGraphEnv = (overrides = {}) => {
  process.env.MS_TENANT_ID = overrides.MS_TENANT_ID ?? 'tenant'
  process.env.MS_CLIENT_ID = overrides.MS_CLIENT_ID ?? 'client'
  process.env.MS_CLIENT_SECRET = overrides.MS_CLIENT_SECRET ?? 'secret'
  process.env.MS_GRAPH_USER_ID = overrides.MS_GRAPH_USER_ID ?? 'user-id'
  process.env.MS_GRAPH_DRIVE_ID = overrides.MS_GRAPH_DRIVE_ID ?? ''
  process.env.MS_GRAPH_TEMP_FOLDER = overrides.MS_GRAPH_TEMP_FOLDER ?? 'temp'
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('isGraphConfigured', () => {
  it('returns true when required env vars are set', () => {
    setGraphEnv()
    expect(isGraphConfigured()).toBe(true)
  })

  it('returns false when auth env vars are missing', () => {
    setGraphEnv({ MS_CLIENT_SECRET: '' })
    expect(isGraphConfigured()).toBe(false)
  })

  it('returns false when drive identifiers are missing', () => {
    setGraphEnv({ MS_GRAPH_USER_ID: '', MS_GRAPH_DRIVE_ID: '' })
    expect(isGraphConfigured()).toBe(false)
  })

  it('returns false when temp folder is missing', () => {
    setGraphEnv({ MS_GRAPH_TEMP_FOLDER: '' })
    expect(isGraphConfigured()).toBe(false)
  })
})
