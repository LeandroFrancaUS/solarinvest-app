// server/adapters/__tests__/integration/portfolioAdapter.integration.spec.js
//
// Integration tests for PortfolioAdapter — no live DB required.
// Validates that the adapter correctly assembles the PortfolioClient model
// from the shape returned by the existing listPortfolioClients() repository.
// @integration

import { describe, it, expect } from 'vitest'
import { fromDb, enrichFromContracts } from '../../portfolioAdapter.js'

describe('PortfolioAdapter [integration — no DB required]', () => {
  // Simulate the exact column aliases used by listPortfolioClients() in
  // server/client-portfolio/repository.js
  const PORTFOLIO_QUERY_ROW = {
    id:                       2001,
    name:                     'Pedro Alves',          // alias: client_name
    email:                    'pedro@example.com',    // alias: client_email
    phone:                    '62966666666',          // alias: client_phone
    city:                     'Anápolis',             // alias: client_city
    state:                    'GO',                   // alias: client_state
    document:                 '222.333.444-55',       // alias: client_document
    document_type:            'cpf',
    consumption_kwh_month:    700,
    system_kwp:               15,
    term_months:              '120',
    distribuidora:            'CELG',
    uc:                       'UC-PA-001',            // alias: uc_geradora
    uc_beneficiaria:          null,
    owner_user_id:            'owner-pa',
    created_by_user_id:       'creator-pa',
    client_created_at:        '2024-02-01T00:00:00Z',
    client_updated_at:        '2024-07-01T00:00:00Z',
    is_converted_customer:    true,                   // alias: in_portfolio
    exported_to_portfolio_at: '2024-04-01T00:00:00Z', // alias: portfolio_exported_at
    exported_by_user_id:      'exporter-pa',
  }

  it('correctly maps the repository column aliases', () => {
    const model = fromDb(PORTFOLIO_QUERY_ROW)

    expect(model.id).toBe(2001)
    expect(model.name).toBe('Pedro Alves')
    expect(model.email).toBe('pedro@example.com')
    expect(model.uc).toBe('UC-PA-001')
    expect(model.is_converted_customer).toBe(true)
    expect(model.exported_to_portfolio_at).toBe('2024-04-01T00:00:00Z')
  })

  it('assembles full enriched model from all auxiliary tables', () => {
    const base = fromDb(PORTFOLIO_QUERY_ROW)

    const enriched = enrichFromContracts(base, {
      contract: {
        id: 200, contract_type: 'leasing', contract_status: 'active',
        source_proposal_id: 'PROP-LEGACY', consultant_id: 'CONSULT-01',
      },
      projectStatus: {
        project_status: 'commissioned',
        installation_status: 'complete',
      },
      billingProfile: {
        due_day: 15,
        payment_status: 'current',
      },
      energyProfile: {
        kwh_contratado: 650,
        desconto_percentual: 22,
      },
      usinaConfig: {
        wifi_status: 'online',
        usina_config: { brand: 'Growatt' },
      },
    })

    expect(enriched.contract.id).toBe(200)
    expect(enriched.contract.source_proposal_id).toBe('PROP-LEGACY')
    expect(enriched.project_status.project_status).toBe('commissioned')
    expect(enriched.billing_profile.due_day).toBe(15)
    expect(enriched.energy_profile.kwh_contratado).toBe(650)
    expect(enriched.usina.wifi_status).toBe('online')
  })
})
