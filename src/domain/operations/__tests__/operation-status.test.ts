// src/domain/operations/__tests__/operation-status.test.ts
import { describe, expect, it } from 'vitest'
import {
  isTicketPriority,
  isTicketStatus,
  isMaintenanceType,
  isMaintenanceStatus,
  isCleaningStatus,
  isInsuranceStatus,
  isOperationEventStatus,
  isOperationEventSourceType,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  MAINTENANCE_TYPES,
  MAINTENANCE_STATUSES,
  CLEANING_STATUSES,
  INSURANCE_STATUSES,
  OPERATION_EVENT_STATUSES,
  OPERATION_EVENT_SOURCE_TYPES,
} from '../operation-status'

describe('isTicketPriority', () => {
  it('accepts all valid priorities', () => {
    for (const v of TICKET_PRIORITIES) expect(isTicketPriority(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isTicketPriority('critical')).toBe(false)
    expect(isTicketPriority('')).toBe(false)
    expect(isTicketPriority(null)).toBe(false)
    expect(isTicketPriority(undefined)).toBe(false)
    expect(isTicketPriority(42)).toBe(false)
  })
})

describe('isTicketStatus', () => {
  it('accepts all valid statuses', () => {
    for (const v of TICKET_STATUSES) expect(isTicketStatus(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isTicketStatus('open')).toBe(false)
    expect(isTicketStatus('')).toBe(false)
    expect(isTicketStatus(null)).toBe(false)
    expect(isTicketStatus(undefined)).toBe(false)
  })
})

describe('isMaintenanceType', () => {
  it('accepts all valid types', () => {
    for (const v of MAINTENANCE_TYPES) expect(isMaintenanceType(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isMaintenanceType('routine')).toBe(false)
    expect(isMaintenanceType(null)).toBe(false)
  })
})

describe('isMaintenanceStatus', () => {
  it('accepts all valid statuses', () => {
    for (const v of MAINTENANCE_STATUSES) expect(isMaintenanceStatus(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isMaintenanceStatus('done')).toBe(false)
    expect(isMaintenanceStatus(null)).toBe(false)
  })
})

describe('isCleaningStatus', () => {
  it('accepts all valid statuses', () => {
    for (const v of CLEANING_STATUSES) expect(isCleaningStatus(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isCleaningStatus('completed')).toBe(false)
    expect(isCleaningStatus(null)).toBe(false)
  })
})

describe('isInsuranceStatus', () => {
  it('accepts all valid statuses', () => {
    for (const v of INSURANCE_STATUSES) expect(isInsuranceStatus(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isInsuranceStatus('active')).toBe(false)
    expect(isInsuranceStatus(null)).toBe(false)
  })
})

describe('isOperationEventStatus', () => {
  it('accepts all valid statuses', () => {
    for (const v of OPERATION_EVENT_STATUSES) expect(isOperationEventStatus(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isOperationEventStatus('pending')).toBe(false)
    expect(isOperationEventStatus(null)).toBe(false)
  })
})

describe('isOperationEventSourceType', () => {
  it('accepts all valid source types', () => {
    for (const v of OPERATION_EVENT_SOURCE_TYPES) expect(isOperationEventSourceType(v)).toBe(true)
  })
  it('rejects invalid values', () => {
    expect(isOperationEventSourceType('other')).toBe(false)
    expect(isOperationEventSourceType(null)).toBe(false)
    expect(isOperationEventSourceType(undefined)).toBe(false)
  })
})
