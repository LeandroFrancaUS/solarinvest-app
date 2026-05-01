// server/adapters/portfolioAdapter.js
//
// Compatibility adapter: production portfolio join result → unified PortfolioClient model.
//
// Portfolio queries join the following tables:
//   clients            — identity + contact
//   client_lifecycle   — conversion status (optional auxiliary table)
//   client_contracts   — contract data
//   client_project_status — installation progress
//   client_billing_profile — billing config
//   client_usina_config    — usina/WiFi data (if present)
//   client_energy_profile  — energy profile
//
// No toDb: portfolio writes go through ClientAdapter + ContractAdapter individually.
// This module is a PURE DATA-MAPPING layer — no DB access.

/**
 * Map a flat portfolio join row (from listPortfolioClients or equivalent) to
 * a unified PortfolioClient app model.
 *
 * Tolerates missing join columns (auxiliary tables may not be joined on every query).
 *
 * @param {object} row - Flat join row from portfolio query
 * @returns {object} Unified PortfolioClient model
 */
export function fromDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    // ── Identity (clients table) ──────────────────────────────────────────────
    id:                       row.id,
    name:                     row.name          ?? row.client_name  ?? null,
    email:                    row.email         ?? row.client_email ?? null,
    phone:                    row.phone         ?? row.client_phone ?? null,
    city:                     row.city          ?? row.client_city  ?? null,
    state:                    row.state         ?? row.client_state ?? null,
    address:                  row.address       ?? row.client_address ?? null,
    document:                 row.document      ?? row.client_document ?? null,
    document_type:            row.document_type ?? null,
    owner_user_id:            row.owner_user_id ?? null,
    created_by_user_id:       row.created_by_user_id ?? null,
    // Energy / commercial
    consumption_kwh_month:    row.consumption_kwh_month ?? null,
    system_kwp:               row.system_kwp    ?? null,
    term_months:              row.term_months   ?? null,
    distribuidora:            row.distribuidora ?? null,
    uc:                       row.uc            ?? row.uc_geradora  ?? null,
    uc_beneficiaria:          row.uc_beneficiaria ?? null,
    // Status
    status_comercial:         row.status_comercial ?? null,
    status_cliente:           row.status_cliente   ?? null,
    consultant_id:            row.consultant_id    ?? null,
    // Portfolio lifecycle
    is_converted_customer:    row.is_converted_customer    ?? row.in_portfolio ?? false,
    exported_to_portfolio_at: row.exported_to_portfolio_at ?? row.portfolio_exported_at ?? null,
    exported_by_user_id:      row.exported_by_user_id      ?? row.portfolio_exported_by_user_id ?? null,
    // Audit
    client_created_at:        row.client_created_at ?? row.created_at ?? null,
    client_updated_at:        row.client_updated_at ?? row.updated_at ?? null,
  }
}

/**
 * Enrich a PortfolioClient model with contract and billing data.
 * Both arguments are shallow-merged — no DB access.
 *
 * @param {object} portfolioClient - Result of fromDb()
 * @param {object} [extras] - Additional joined data:
 *   @param {object} [extras.contract]       - client_contracts row
 *   @param {object} [extras.projectStatus]  - client_project_status row
 *   @param {object} [extras.billingProfile] - client_billing_profile row
 *   @param {object} [extras.energyProfile]  - client_energy_profile row
 *   @param {object} [extras.usinaConfig]    - client_usina_config row
 * @returns {object} Enriched PortfolioClient
 */
export function enrichFromContracts(portfolioClient, extras = {}) {
  if (!portfolioClient || typeof portfolioClient !== 'object') {
    throw new TypeError('PortfolioAdapter.enrichFromContracts: portfolioClient must be a non-null object')
  }

  const { contract, projectStatus, billingProfile, energyProfile, usinaConfig } = extras

  const enriched = { ...portfolioClient }

  // ── Contract ──────────────────────────────────────────────────────────────
  if (contract && typeof contract === 'object') {
    enriched.contract = {
      id:                        contract.id,
      contract_type:             contract.contract_type    ?? null,
      contract_status:           contract.contract_status  ?? null,
      contract_signed_at:        contract.contract_signed_at ?? null,
      contract_start_date:       contract.contract_start_date ?? null,
      billing_start_date:        contract.billing_start_date  ?? null,
      expected_billing_end_date: contract.expected_billing_end_date ?? null,
      contractual_term_months:   contract.contractual_term_months   ?? null,
      buyout_eligible:           contract.buyout_eligible   ?? false,
      // Legacy text fields — preserved as-is
      source_proposal_id:        contract.source_proposal_id ?? null,
      consultant_id:             contract.consultant_id      ?? null,
    }
  }

  // ── Project status ────────────────────────────────────────────────────────
  if (projectStatus && typeof projectStatus === 'object') {
    enriched.project_status = {
      project_status:          projectStatus.project_status         ?? null,
      installation_status:     projectStatus.installation_status    ?? null,
      engineering_status:      projectStatus.engineering_status     ?? null,
      homologation_status:     projectStatus.homologation_status    ?? null,
      commissioning_status:    projectStatus.commissioning_status   ?? null,
      commissioning_date:      projectStatus.commissioning_date     ?? null,
      first_injection_date:    projectStatus.first_injection_date   ?? null,
      first_generation_date:   projectStatus.first_generation_date  ?? null,
      expected_go_live_date:   projectStatus.expected_go_live_date  ?? null,
    }
  }

  // ── Billing profile ───────────────────────────────────────────────────────
  if (billingProfile && typeof billingProfile === 'object') {
    enriched.billing_profile = {
      due_day:             billingProfile.due_day            ?? null,
      reading_day:         billingProfile.reading_day        ?? null,
      first_billing_date:  billingProfile.first_billing_date ?? null,
      recurrence_type:     billingProfile.recurrence_type    ?? null,
      payment_status:      billingProfile.payment_status     ?? null,
      delinquency_status:  billingProfile.delinquency_status ?? null,
    }
  }

  // ── Energy profile ────────────────────────────────────────────────────────
  if (energyProfile && typeof energyProfile === 'object') {
    enriched.energy_profile = {
      kwh_contratado:       energyProfile.kwh_contratado      ?? null,
      potencia_kwp:         energyProfile.potencia_kwp        ?? null,
      tipo_rede:            energyProfile.tipo_rede           ?? null,
      tarifa_atual:         energyProfile.tarifa_atual        ?? null,
      desconto_percentual:  energyProfile.desconto_percentual ?? null,
      mensalidade:          energyProfile.mensalidade         ?? null,
      modalidade:           energyProfile.modalidade          ?? null,
      prazo_meses:          energyProfile.prazo_meses         ?? null,
    }
  }

  // ── Usina / WiFi ──────────────────────────────────────────────────────────
  if (usinaConfig && typeof usinaConfig === 'object') {
    enriched.usina = {
      wifi_status:          usinaConfig.wifi_status           ?? null,
      usina_config:         usinaConfig.usina_config          ?? null,
    }
  }

  return enriched
}
