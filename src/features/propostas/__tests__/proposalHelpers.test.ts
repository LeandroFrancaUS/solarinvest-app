import { describe, expect, it, vi, afterEach } from 'vitest'
import type { OrcamentoSnapshotData } from '../../../types/orcamentoTypes'
import type { ProposalRow } from '../../../lib/api/proposalsApi'
import {
  BUDGETS_STORAGE_KEY,
  PROPOSAL_SERVER_ID_MAP_STORAGE_KEY,
  BUDGET_ID_PREFIXES,
  DEFAULT_BUDGET_ID_PREFIX,
  BUDGET_ID_SUFFIX_LENGTH,
  BUDGET_ID_MAX_ATTEMPTS,
  tick,
  generateBudgetId,
  createDraftBudgetId,
  serverProposalToOrcamento,
  toFiniteNonNegativeNumber,
  resolveConsumptionFromSnapshot,
  resolveSystemKwpFromSnapshot,
  resolveTermMonthsFromSnapshot,
  alertPrunedBudgets,
  normalizeTusdTipoClienteValue,
  buildProposalUpsertPayload,
} from '../proposalHelpers'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('BUDGETS_STORAGE_KEY has expected value', () => {
    expect(BUDGETS_STORAGE_KEY).toBe('solarinvest-orcamentos')
  })

  it('PROPOSAL_SERVER_ID_MAP_STORAGE_KEY has expected value', () => {
    expect(PROPOSAL_SERVER_ID_MAP_STORAGE_KEY).toBe('solarinvest-proposal-server-id-map')
  })

  it('BUDGET_ID_PREFIXES match proposal types', () => {
    expect(BUDGET_ID_PREFIXES.LEASING).toBe('SLRINVST-LSE-')
    expect(BUDGET_ID_PREFIXES.VENDA_DIRETA).toBe('SLRINVST-VND-')
  })

  it('DEFAULT_BUDGET_ID_PREFIX equals LEASING prefix', () => {
    expect(DEFAULT_BUDGET_ID_PREFIX).toBe(BUDGET_ID_PREFIXES.LEASING)
  })

  it('BUDGET_ID_SUFFIX_LENGTH is 8', () => {
    expect(BUDGET_ID_SUFFIX_LENGTH).toBe(8)
  })

  it('BUDGET_ID_MAX_ATTEMPTS is 1000', () => {
    expect(BUDGET_ID_MAX_ATTEMPTS).toBe(1000)
  })
})

// ---------------------------------------------------------------------------
// tick
// ---------------------------------------------------------------------------

describe('tick', () => {
  it('resolves after a microtask', async () => {
    let resolved = false
    const p = tick().then(() => { resolved = true })
    expect(resolved).toBe(false)
    await p
    expect(resolved).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateBudgetId
// ---------------------------------------------------------------------------

describe('generateBudgetId', () => {
  it('generates a LEASING id by default', () => {
    const id = generateBudgetId()
    expect(id.startsWith('SLRINVST-LSE-')).toBe(true)
  })

  it('generates a VENDA_DIRETA id when specified', () => {
    const id = generateBudgetId(new Set(), 'VENDA_DIRETA')
    expect(id.startsWith('SLRINVST-VND-')).toBe(true)
  })

  it('suffix has correct length', () => {
    const id = generateBudgetId()
    const suffix = id.replace('SLRINVST-LSE-', '')
    expect(suffix).toHaveLength(BUDGET_ID_SUFFIX_LENGTH)
  })

  it('avoids collisions with existing ids', () => {
    const first = generateBudgetId()
    const existing = new Set([first])
    const second = generateBudgetId(existing)
    expect(second).not.toBe(first)
  })

  it('throws after max attempts', () => {
    // Fill a set with all possible ids for the prefix pattern by exhausting attempts
    // via mocking Math.random to always return the same value
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const existingIds = new Set(['SLRINVST-LSE-00000000'])
    expect(() => generateBudgetId(existingIds)).toThrow('único')
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// createDraftBudgetId
// ---------------------------------------------------------------------------

describe('createDraftBudgetId', () => {
  it('starts with DRAFT-', () => {
    const id = createDraftBudgetId()
    expect(id.startsWith('DRAFT-')).toBe(true)
  })

  it('produces unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createDraftBudgetId()))
    expect(ids.size).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// normalizeTusdTipoClienteValue
// ---------------------------------------------------------------------------

describe('normalizeTusdTipoClienteValue', () => {
  it('returns residencial for unknown / empty input', () => {
    expect(normalizeTusdTipoClienteValue(null)).toBe('residencial')
    expect(normalizeTusdTipoClienteValue(undefined)).toBe('residencial')
    expect(normalizeTusdTipoClienteValue('')).toBe('residencial')
  })

  it('normalizes valid TUSD tipo client values', () => {
    // The actual normalized values depend on normalizeTipoBasico; at minimum these
    // should not throw and should return a string.
    expect(typeof normalizeTusdTipoClienteValue('residencial')).toBe('string')
    expect(typeof normalizeTusdTipoClienteValue('comercial')).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// toFiniteNonNegativeNumber
// ---------------------------------------------------------------------------

describe('toFiniteNonNegativeNumber', () => {
  it('returns null for null/undefined/empty', () => {
    expect(toFiniteNonNegativeNumber(null)).toBeNull()
    expect(toFiniteNonNegativeNumber(undefined)).toBeNull()
    expect(toFiniteNonNegativeNumber('')).toBeNull()
  })

  it('returns null for negative numbers', () => {
    expect(toFiniteNonNegativeNumber(-1)).toBeNull()
    expect(toFiniteNonNegativeNumber(-0.001)).toBeNull()
  })

  it('returns null for non-finite values', () => {
    expect(toFiniteNonNegativeNumber(Infinity)).toBeNull()
    expect(toFiniteNonNegativeNumber(NaN)).toBeNull()
    expect(toFiniteNonNegativeNumber('abc')).toBeNull()
  })

  it('returns the number for valid non-negative values', () => {
    expect(toFiniteNonNegativeNumber(0)).toBe(0)
    expect(toFiniteNonNegativeNumber(42)).toBe(42)
    expect(toFiniteNonNegativeNumber('3.14')).toBeCloseTo(3.14)
    expect(toFiniteNonNegativeNumber('1,5')).toBeCloseTo(1.5)
  })
})

// ---------------------------------------------------------------------------
// resolveConsumptionFromSnapshot
// ---------------------------------------------------------------------------

describe('resolveConsumptionFromSnapshot', () => {
  it('returns null for null snapshot', () => {
    expect(resolveConsumptionFromSnapshot(null)).toBeNull()
  })

  it('reads kcKwhMes from top-level snapshot', () => {
    const snapshot = { kcKwhMes: 450 } as unknown as OrcamentoSnapshotData
    expect(resolveConsumptionFromSnapshot(snapshot)).toBe(450)
  })

  it('falls back to leasingSnapshot energiaContratadaKwhMes', () => {
    const snapshot = {
      leasingSnapshot: { energiaContratadaKwhMes: 300 },
    } as unknown as OrcamentoSnapshotData
    expect(resolveConsumptionFromSnapshot(snapshot)).toBe(300)
  })

  it('falls back to vendaForm consumo_kwh_mes', () => {
    const snapshot = {
      vendaForm: { consumo_kwh_mes: 200 },
    } as unknown as OrcamentoSnapshotData
    expect(resolveConsumptionFromSnapshot(snapshot)).toBe(200)
  })

  it('returns null when no valid candidate exists', () => {
    const snapshot = {} as OrcamentoSnapshotData
    expect(resolveConsumptionFromSnapshot(snapshot)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveSystemKwpFromSnapshot
// ---------------------------------------------------------------------------

describe('resolveSystemKwpFromSnapshot', () => {
  it('returns null for null snapshot', () => {
    expect(resolveSystemKwpFromSnapshot(null)).toBeNull()
  })

  it('reads from leasingSnapshot dadosTecnicos potenciaInstaladaKwp', () => {
    const snapshot = {
      leasingSnapshot: { dadosTecnicos: { potenciaInstaladaKwp: 5.5 } },
    } as unknown as OrcamentoSnapshotData
    expect(resolveSystemKwpFromSnapshot(snapshot)).toBeCloseTo(5.5)
  })

  it('falls back to vendaForm potencia_instalada_kwp', () => {
    const snapshot = {
      vendaForm: { potencia_instalada_kwp: 4.2 },
    } as unknown as OrcamentoSnapshotData
    expect(resolveSystemKwpFromSnapshot(snapshot)).toBeCloseTo(4.2)
  })

  it('returns null when no valid candidate exists', () => {
    const snapshot = {} as OrcamentoSnapshotData
    expect(resolveSystemKwpFromSnapshot(snapshot)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveTermMonthsFromSnapshot
// ---------------------------------------------------------------------------

describe('resolveTermMonthsFromSnapshot', () => {
  it('returns null for null snapshot', () => {
    expect(resolveTermMonthsFromSnapshot(null)).toBeNull()
  })

  it('reads prazoContratualMeses from leasingSnapshot', () => {
    const snapshot = {
      leasingSnapshot: { prazoContratualMeses: 120 },
    } as unknown as OrcamentoSnapshotData
    expect(resolveTermMonthsFromSnapshot(snapshot)).toBe(120)
  })

  it('falls back to snapshot.prazoMeses', () => {
    const snapshot = { prazoMeses: 60 } as unknown as OrcamentoSnapshotData
    expect(resolveTermMonthsFromSnapshot(snapshot)).toBe(60)
  })

  it('returns null when no valid candidate exists', () => {
    const snapshot = {} as OrcamentoSnapshotData
    expect(resolveTermMonthsFromSnapshot(snapshot)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// serverProposalToOrcamento
// ---------------------------------------------------------------------------

describe('serverProposalToOrcamento', () => {
  const baseRow: ProposalRow = {
    id: 'uuid-123',
    proposal_code: 'SLRINVST-LSE-00001234',
    proposal_type: 'leasing',
    client_name: 'João Silva',
    client_city: 'Goiânia',
    client_state: 'GO',
    client_document: '12345678901',
    owner_user_id: 'user-1',
    owner_email: null,
    owner_display_name: 'Consultor A',
    created_at: '2024-01-01T00:00:00Z',
    payload_json: {
      kcKwhMes: 500,
      cliente: {
        nome: 'João Silva',
        cidade: 'Goiânia',
        uf: 'GO',
        documento: '12345678901',
        uc: '1234567890',
      },
    } as unknown as Record<string, unknown>,
  }

  it('uses proposal_code as id when available', () => {
    const result = serverProposalToOrcamento(baseRow)
    expect(result.id).toBe('SLRINVST-LSE-00001234')
  })

  it('falls back to row.id when no proposal_code', () => {
    const row = { ...baseRow, proposal_code: null }
    const result = serverProposalToOrcamento(row)
    expect(result.id).toBe('uuid-123')
  })

  it('maps proposal_type leasing to LEASING tipoProposta', () => {
    const result = serverProposalToOrcamento(baseRow)
    expect(result.dados.tipoProposta).toBe('LEASING')
  })

  it('maps proposal_type venda to VENDA_DIRETA tipoProposta', () => {
    const row = { ...baseRow, proposal_type: 'venda' as const }
    const result = serverProposalToOrcamento(row)
    expect(result.dados.tipoProposta).toBe('VENDA_DIRETA')
  })

  it('prefers server client_name over snapshot nome', () => {
    const result = serverProposalToOrcamento(baseRow)
    expect(result.clienteNome).toBe('João Silva')
  })

  it('includes ownerName when owner_display_name is set', () => {
    const result = serverProposalToOrcamento(baseRow)
    expect(result.ownerName).toBe('Consultor A')
  })

  it('uses owner_email when no display name', () => {
    const row = { ...baseRow, owner_display_name: null, owner_email: 'a@b.com' }
    const result = serverProposalToOrcamento(row)
    expect(result.ownerName).toBe('a@b.com')
  })

  it('includes snapshot in result', () => {
    const result = serverProposalToOrcamento(baseRow)
    expect(result.snapshot).toBeDefined()
  })

  it('includes clienteUc when present in snapshot', () => {
    const result = serverProposalToOrcamento(baseRow)
    expect(result.clienteUc).toBe('1234567890')
  })
})

// ---------------------------------------------------------------------------
// alertPrunedBudgets
// ---------------------------------------------------------------------------

describe('alertPrunedBudgets', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when droppedCount is 0', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    alertPrunedBudgets(0)
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('calls window.alert with singular message for 1 dropped', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    alertPrunedBudgets(1)
    expect(alertSpy).toHaveBeenCalledOnce()
    expect(alertSpy.mock.calls[0][0]).toContain('mais antigo foi removido')
  })

  it('calls window.alert with plural message for multiple dropped', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    alertPrunedBudgets(3)
    expect(alertSpy).toHaveBeenCalledOnce()
    expect(alertSpy.mock.calls[0][0]).toContain('3 orçamentos antigos')
  })
})

// ---------------------------------------------------------------------------
// buildProposalUpsertPayload
// ---------------------------------------------------------------------------

describe('buildProposalUpsertPayload', () => {
  const makeSnapshot = (overrides: Partial<OrcamentoSnapshotData> = {}): OrcamentoSnapshotData =>
    ({
      kcKwhMes: 400,
      cliente: {
        nome: 'Maria Souza',
        documento: '987.654.321-00',
        cidade: 'São Paulo',
        uf: 'SP',
        telefone: '11999990000',
        email: 'maria@example.com',
        cep: '01310-000',
        uc: '111',
      },
      ucBeneficiarias: [{ numero: 'UC-001' }, { numero: 'UC-002' }],
      leasingSnapshot: {
        energiaContratadaKwhMes: 400,
        prazoContratualMeses: 120,
        dadosTecnicos: { potenciaInstaladaKwp: 5 },
      },
      ...overrides,
    } as unknown as OrcamentoSnapshotData)

  it('includes payload_json as the raw snapshot', () => {
    const snapshot = makeSnapshot()
    const payload = buildProposalUpsertPayload(snapshot)
    expect(payload.payload_json).toBe(snapshot)
  })

  it('includes client_name when nome is present', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.client_name).toBe('Maria Souza')
  })

  it('includes normalized client_document', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.client_document).toBe('98765432100')
  })

  it('includes client_city and client_state', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.client_city).toBe('São Paulo')
    expect(payload.client_state).toBe('SP')
  })

  it('includes consumption_kwh_month from kcKwhMes', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.consumption_kwh_month).toBe(400)
  })

  it('includes system_kwp from leasingSnapshot dadosTecnicos', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.system_kwp).toBe(5)
  })

  it('includes term_months from leasingSnapshot', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.term_months).toBe(120)
  })

  it('includes uc_beneficiaria as comma-separated list', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.uc_beneficiaria).toBe('UC-001, UC-002')
  })

  it('normalizes cep to digits only for client_cep', () => {
    const payload = buildProposalUpsertPayload(makeSnapshot())
    expect(payload.client_cep).toBe('01310000')
  })

  it('omits optional fields when missing', () => {
    const snapshot = makeSnapshot({
      cliente: {} as OrcamentoSnapshotData['cliente'],
      ucBeneficiarias: [],
    })
    const payload = buildProposalUpsertPayload(snapshot)
    expect(payload.client_name).toBeUndefined()
    expect(payload.client_document).toBeUndefined()
    expect(payload.uc_beneficiaria).toBeUndefined()
  })
})
