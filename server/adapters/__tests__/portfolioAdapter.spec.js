// server/adapters/__tests__/portfolioAdapter.spec.js
// Unit tests for server/adapters/portfolioAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import { fromDb, enrichFromContracts } from '../portfolioAdapter.js'

const BASE_ROW = {
  id:                       1001,
  name:                     'Lúcia Ferreira',
  email:                    'lucia@example.com',
  phone:                    '62977777777',
  city:                     'Goiânia',
  state:                    'GO',
  address:                  'Setor Sul, 200',
  document:                 '111.222.333-44',
  document_type:            'cpf',
  owner_user_id:            'owner-lf',
  created_by_user_id:       'creator-lf',
  consumption_kwh_month:    600,
  system_kwp:               12.5,
  term_months:              60,
  distribuidora:            'CELG',
  uc:                       'UC-LF-001',
  uc_beneficiaria:          null,
  status_comercial:         'GANHO',
  status_cliente:           'ATIVO',
  consultant_id:            3,
  is_converted_customer:    true,
  exported_to_portfolio_at: '2024-03-01T00:00:00Z',
  exported_by_user_id:      'exporter-user',
  client_created_at:        '2024-01-01T00:00:00Z',
  client_updated_at:        '2024-06-01T00:00:00Z',
}

// ─── fromDb ───────────────────────────────────────────────────────────────────

describe('PortfolioAdapter.fromDb', () => {
  it('maps all fields from a full row', () => {
    const model = fromDb(BASE_ROW)

    expect(model.id).toBe(1001)
    expect(model.name).toBe('Lúcia Ferreira')
    expect(model.email).toBe('lucia@example.com')
    expect(model.phone).toBe('62977777777')
    expect(model.city).toBe('Goiânia')
    expect(model.state).toBe('GO')
    expect(model.uc).toBe('UC-LF-001')
    expect(model.is_converted_customer).toBe(true)
    expect(model.status_comercial).toBe('GANHO')
    expect(model.status_cliente).toBe('ATIVO')
  })

  it('falls back to client_name column alias when name is absent', () => {
    const row = { id: 2, client_name: 'Alias Name' }
    const model = fromDb(row)
    expect(model.name).toBe('Alias Name')
  })

  it('falls back to uc_geradora when uc is absent', () => {
    const row = { id: 3, uc_geradora: 'UC-ALIAS' }
    const model = fromDb(row)
    expect(model.uc).toBe('UC-ALIAS')
  })

  it('falls back to portfolio_exported_at when exported_to_portfolio_at is absent', () => {
    const row = { id: 4, portfolio_exported_at: '2024-01-01T00:00:00Z' }
    const model = fromDb(row)
    expect(model.exported_to_portfolio_at).toBe('2024-01-01T00:00:00Z')
  })

  it('defaults is_converted_customer to false when absent', () => {
    const model = fromDb({ id: 5 })
    expect(model.is_converted_customer).toBe(false)
  })

  it('returns null for null input', () => {
    expect(fromDb(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(fromDb('x')).toBeNull()
  })
})

// ─── enrichFromContracts ──────────────────────────────────────────────────────

describe('PortfolioAdapter.enrichFromContracts', () => {
  it('returns a copy without mutating the original', () => {
    const original = fromDb(BASE_ROW)
    const enriched = enrichFromContracts(original, {})
    expect(enriched).not.toBe(original)
    expect(original.contract).toBeUndefined()
  })

  it('appends contract data when provided', () => {
    const base = fromDb(BASE_ROW)
    const contract = {
      id:                        101,
      contract_type:             'leasing',
      contract_status:           'active',
      contract_signed_at:        '2024-03-01T00:00:00Z',
      contract_start_date:       '2024-04-01',
      source_proposal_id:        'PROP-LEGACY-TEXT',
      consultant_id:             'CONSULT-TEXT',
    }

    const enriched = enrichFromContracts(base, { contract })

    expect(enriched.contract).toBeDefined()
    expect(enriched.contract.id).toBe(101)
    expect(enriched.contract.contract_type).toBe('leasing')
    expect(enriched.contract.contract_status).toBe('active')
    // Legacy TEXT fields must be preserved as-is
    expect(enriched.contract.source_proposal_id).toBe('PROP-LEGACY-TEXT')
    expect(enriched.contract.consultant_id).toBe('CONSULT-TEXT')
  })

  it('appends project_status when provided', () => {
    const base = fromDb(BASE_ROW)
    const projectStatus = {
      project_status:      'commissioned',
      installation_status: 'complete',
    }

    const enriched = enrichFromContracts(base, { projectStatus })

    expect(enriched.project_status).toBeDefined()
    expect(enriched.project_status.project_status).toBe('commissioned')
    expect(enriched.project_status.installation_status).toBe('complete')
  })

  it('appends billing_profile when provided', () => {
    const base = fromDb(BASE_ROW)
    const billingProfile = {
      due_day:         10,
      payment_status:  'current',
    }

    const enriched = enrichFromContracts(base, { billingProfile })

    expect(enriched.billing_profile).toBeDefined()
    expect(enriched.billing_profile.due_day).toBe(10)
    expect(enriched.billing_profile.payment_status).toBe('current')
  })

  it('appends energy_profile when provided', () => {
    const base = fromDb(BASE_ROW)
    const energyProfile = {
      kwh_contratado: 550,
      potencia_kwp:   10.0,
      desconto_percentual: 20,
    }

    const enriched = enrichFromContracts(base, { energyProfile })

    expect(enriched.energy_profile).toBeDefined()
    expect(enriched.energy_profile.kwh_contratado).toBe(550)
    expect(enriched.energy_profile.desconto_percentual).toBe(20)
  })

  it('appends usina config when provided', () => {
    const base = fromDb(BASE_ROW)
    const usinaConfig = {
      wifi_status:  'online',
      usina_config: { inverter: 'Growatt' },
    }

    const enriched = enrichFromContracts(base, { usinaConfig })

    expect(enriched.usina).toBeDefined()
    expect(enriched.usina.wifi_status).toBe('online')
  })

  it('skips sections whose extras are null or absent', () => {
    const base = fromDb(BASE_ROW)
    const enriched = enrichFromContracts(base, { contract: null, billingProfile: undefined })
    expect(enriched.contract).toBeUndefined()
    expect(enriched.billing_profile).toBeUndefined()
  })

  it('throws TypeError when portfolioClient is null', () => {
    expect(() => enrichFromContracts(null, {})).toThrow(TypeError)
  })
})
