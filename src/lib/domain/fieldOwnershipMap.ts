/**
 * src/lib/domain/fieldOwnershipMap.ts
 *
 * DATA DICTIONARY — Single Source of Truth field ownership map.
 *
 * This is the canonical reference for every important field in the system.
 * It answers:
 *   • Which table/column owns this field?
 *   • Where does the value come from in the proposal?
 *   • Is the field required before "Fechar Negócio"?
 *   • Is it computed by an engine?
 *   • Can it be edited manually after closing?
 *
 * Architecture:
 *   Proposta   = capture point (OrcamentoSnapshotData + payload_json columns)
 *   Banco      = persisted source of truth (Neon/PostgreSQL canonical tables)
 *   Carteira   = normalized operational view of the closed client
 *   Engines    = compute derived values (financial, technical)
 *
 * OWNERSHIP DOMAINS:
 *   A — Client registration  → clients table
 *   B — Energy / UC          → clients table (operational) + client_energy_profile
 *   C — Technical / Usina    → client_usina_config
 *   D — Contract             → client_contracts
 *   E — Billing              → client_billing_profile
 *   F — Derived/Calculated   → persisted to the domain table of the result
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataDomain = 'client_registration' | 'energy_uc' | 'technical_usina' | 'contract' | 'billing' | 'derived'

export type CanonicalTable =
  | 'clients'
  | 'client_energy_profile'
  | 'client_usina_config'
  | 'client_contracts'
  | 'client_billing_profile'
  | 'client_lifecycle'

export type EngineType =
  | 'financial_analysis'
  | 'technical_calculation'
  | 'billing_engine'
  | 'none'

/** Describes how a single field is owned, sourced, and validated. */
export interface FieldOwnerDescriptor {
  /** Human-readable UI label shown in forms */
  uiLabel: string
  /** Domain this field belongs to */
  domain: DataDomain
  /** Path inside the proposal snapshot (OrcamentoSnapshotData / payload_json) */
  proposalSource: string | string[]
  /** Canonical owner table */
  canonicalTable: CanonicalTable
  /** Column name in the canonical table */
  dbColumn: string
  /** Whether the field must be present/valid before "Fechar Negócio" is allowed */
  requiredForClosing: boolean
  /** Whether the value is computed by an engine (true) or entered by user (false) */
  computed: boolean
  /** Engine responsible for computing this value (only when computed = true) */
  engine?: EngineType
  /** Whether the field may be edited manually in the portfolio after closing */
  editableAfterClosing: boolean
  /** Optional notes for developers */
  notes?: string
}

// ─── Field Ownership Map ─────────────────────────────────────────────────────
//
// Key = stable machine-readable identifier.  Value = descriptor.
//
// IMPORTANT: Keep this map in sync with database migrations and UI forms.
//

export const FIELD_OWNERSHIP_MAP: Record<string, FieldOwnerDescriptor> = {

  // ── A. CLIENT REGISTRATION ─────────────────────────────────────────────────

  client_name: {
    uiLabel: 'Nome / Razão Social',
    domain: 'client_registration',
    proposalSource: 'cliente.nome',
    canonicalTable: 'clients',
    dbColumn: 'client_name',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
  },

  client_document: {
    uiLabel: 'CPF / CNPJ',
    domain: 'client_registration',
    proposalSource: 'cliente.documento',
    canonicalTable: 'clients',
    dbColumn: 'client_document',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: false,
    notes: 'Must pass CPF or CNPJ check-digit validation.',
  },

  client_email: {
    uiLabel: 'E-mail',
    domain: 'client_registration',
    proposalSource: 'cliente.email',
    canonicalTable: 'clients',
    dbColumn: 'client_email',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
  },

  client_phone: {
    uiLabel: 'Telefone',
    domain: 'client_registration',
    proposalSource: 'cliente.telefone',
    canonicalTable: 'clients',
    dbColumn: 'client_phone',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
  },

  client_cep: {
    uiLabel: 'CEP',
    domain: 'client_registration',
    proposalSource: 'cliente.cep',
    canonicalTable: 'clients',
    dbColumn: 'client_cep',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
    notes: 'Must be exactly 8 digits.',
  },

  client_city: {
    uiLabel: 'Cidade',
    domain: 'client_registration',
    proposalSource: 'cliente.cidade',
    canonicalTable: 'clients',
    dbColumn: 'client_city',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
  },

  client_state: {
    uiLabel: 'UF',
    domain: 'client_registration',
    proposalSource: 'cliente.uf',
    canonicalTable: 'clients',
    dbColumn: 'client_state',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
  },

  client_address: {
    uiLabel: 'Endereço',
    domain: 'client_registration',
    proposalSource: 'cliente.endereco',
    canonicalTable: 'clients',
    dbColumn: 'client_address',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  estado_civil: {
    uiLabel: 'Estado Civil',
    domain: 'client_registration',
    proposalSource: 'cliente.estadoCivil',
    canonicalTable: 'clients',
    dbColumn: 'metadata.estadoCivil',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  nacionalidade: {
    uiLabel: 'Nacionalidade',
    domain: 'client_registration',
    proposalSource: 'cliente.nacionalidade',
    canonicalTable: 'clients',
    dbColumn: 'metadata.nacionalidade',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  indicacao: {
    uiLabel: 'Indicação',
    domain: 'client_registration',
    proposalSource: 'cliente.indicacaoNome',
    canonicalTable: 'client_energy_profile',
    dbColumn: 'indicacao',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  // ── B. ENERGY / UC ─────────────────────────────────────────────────────────

  distribuidora: {
    uiLabel: 'Distribuidora',
    domain: 'energy_uc',
    proposalSource: 'cliente.distribuidora',
    canonicalTable: 'clients',
    dbColumn: 'distribuidora',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
  },

  uc_geradora: {
    uiLabel: 'UC Geradora',
    domain: 'energy_uc',
    proposalSource: 'cliente.uc',
    canonicalTable: 'clients',
    dbColumn: 'uc',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: false,
    notes: 'Must be exactly 15 digits.',
  },

  uc_beneficiaria: {
    uiLabel: 'UC Beneficiária',
    domain: 'energy_uc',
    proposalSource: 'ucBeneficiarias[].numero',
    canonicalTable: 'clients',
    dbColumn: 'uc_beneficiaria',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
    notes: 'Validated when present. Not required if leasing residential.',
  },

  consumption_kwh_month: {
    uiLabel: 'Consumo (kWh/mês)',
    domain: 'energy_uc',
    proposalSource: ['kcKwhMes', 'vendaSnapshot.parametros.consumo_kwh_mes', 'leasingSnapshot.energiaContratadaKwhMes'],
    canonicalTable: 'clients',
    dbColumn: 'consumption_kwh_month',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: true,
  },

  term_months: {
    uiLabel: 'Prazo Contratual (meses)',
    domain: 'energy_uc',
    proposalSource: ['prazoMeses', 'leasingSnapshot.prazoContratualMeses'],
    canonicalTable: 'clients',
    dbColumn: 'term_months',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: false,
  },

  kwh_contratado: {
    uiLabel: 'Energia contratada (kWh/mês)',
    domain: 'energy_uc',
    proposalSource: 'leasingSnapshot.dadosTecnicos.energiaContratadaKwhMes',
    canonicalTable: 'client_energy_profile',
    dbColumn: 'kwh_contratado',
    requiredForClosing: false,
    computed: true,
    engine: 'technical_calculation',
    editableAfterClosing: false,
  },

  tarifa_atual: {
    uiLabel: 'Tarifa atual (R$/kWh)',
    domain: 'energy_uc',
    proposalSource: 'tarifaCheia',
    canonicalTable: 'client_energy_profile',
    dbColumn: 'tarifa_atual',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  desconto_percentual: {
    uiLabel: 'Desconto contratual (%)',
    domain: 'energy_uc',
    proposalSource: 'leasingSnapshot.descontoContratual',
    canonicalTable: 'client_energy_profile',
    dbColumn: 'desconto_percentual',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: false,
  },

  tipo_rede: {
    uiLabel: 'Tipo de Rede',
    domain: 'energy_uc',
    proposalSource: 'tipoRede',
    canonicalTable: 'client_energy_profile',
    dbColumn: 'tipo_rede',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  // ── C. TECHNICAL / USINA ───────────────────────────────────────────────────

  system_kwp: {
    uiLabel: 'Potência do Sistema (kWp)',
    domain: 'technical_usina',
    proposalSource: [
      'leasingSnapshot.dadosTecnicos.potenciaInstaladaKwp',
      'vendaSnapshot.configuracao.potencia_sistema_kwp',
      'vendaForm.potencia_sistema_kwp',
    ],
    canonicalTable: 'clients',
    dbColumn: 'system_kwp',
    requiredForClosing: true,
    computed: true,
    engine: 'technical_calculation',
    editableAfterClosing: true,
    notes: 'Derived from module count × module power.',
  },

  potencia_modulo_wp: {
    uiLabel: 'Potência do Módulo (Wp)',
    domain: 'technical_usina',
    proposalSource: ['leasingSnapshot.dadosTecnicos.potenciaPlacaWp', 'vendaSnapshot.configuracao.potencia_modulo_wp', 'potenciaModulo'],
    canonicalTable: 'client_usina_config',
    dbColumn: 'potencia_modulo_wp',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  numero_modulos: {
    uiLabel: 'Número de Módulos',
    domain: 'technical_usina',
    proposalSource: ['leasingSnapshot.dadosTecnicos.numeroModulos', 'vendaSnapshot.configuracao.n_modulos'],
    canonicalTable: 'client_usina_config',
    dbColumn: 'numero_modulos',
    requiredForClosing: false,
    computed: true,
    engine: 'technical_calculation',
    editableAfterClosing: true,
  },

  tipo_instalacao: {
    uiLabel: 'Tipo de Instalação',
    domain: 'technical_usina',
    proposalSource: ['leasingSnapshot.dadosTecnicos.tipoInstalacao', 'vendaSnapshot.configuracao.tipo_instalacao', 'tipoInstalacao'],
    canonicalTable: 'client_usina_config',
    dbColumn: 'tipo_instalacao',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  area_instalacao_m2: {
    uiLabel: 'Área Utilizada (m²)',
    domain: 'technical_usina',
    proposalSource: ['leasingSnapshot.dadosTecnicos.areaUtilM2', 'vendaSnapshot.configuracao.area_m2'],
    canonicalTable: 'client_usina_config',
    dbColumn: 'area_instalacao_m2',
    requiredForClosing: false,
    computed: true,
    engine: 'technical_calculation',
    editableAfterClosing: true,
  },

  geracao_estimada_kwh: {
    uiLabel: 'Geração Estimada (kWh/mês)',
    domain: 'technical_usina',
    proposalSource: [
      'leasingSnapshot.dadosTecnicos.geracaoEstimadakWhMes',
      'vendaSnapshot.configuracao.geracao_estimada_kwh_mes',
      'vendaForm.geracao_estimada_kwh_mes',
    ],
    canonicalTable: 'client_usina_config',
    dbColumn: 'geracao_estimada_kwh',
    requiredForClosing: true,
    computed: true,
    engine: 'technical_calculation',
    editableAfterClosing: true,
  },

  modelo_modulo: {
    uiLabel: 'Modelo do Módulo',
    domain: 'technical_usina',
    proposalSource: 'vendaSnapshot.configuracao.modelo_modulo',
    canonicalTable: 'client_usina_config',
    dbColumn: 'modelo_modulo',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  modelo_inversor: {
    uiLabel: 'Modelo do Inversor',
    domain: 'technical_usina',
    proposalSource: ['vendaSnapshot.configuracao.modelo_inversor', 'leasingSnapshot.contrato.inversoresFV'],
    canonicalTable: 'client_usina_config',
    dbColumn: 'modelo_inversor',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
  },

  valordemercado: {
    uiLabel: 'Valor de Mercado do Sistema (R$)',
    domain: 'technical_usina',
    proposalSource: [
      'vendaSnapshot.composicao.venda_total',
      'leasingSnapshot.valorDeMercadoEstimado',
      'vendaForm.capex_total',
    ],
    canonicalTable: 'client_usina_config',
    dbColumn: 'valordemercado',
    requiredForClosing: false,
    computed: true,
    engine: 'financial_analysis',
    editableAfterClosing: true,
    notes: 'For leasing: valor de mercado estimado. For venda: total contract value.',
  },

  // ── D. CONTRACT ────────────────────────────────────────────────────────────

  contract_type: {
    uiLabel: 'Tipo de Contrato',
    domain: 'contract',
    proposalSource: 'activeTab',
    canonicalTable: 'client_contracts',
    dbColumn: 'contract_type',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: false,
    notes: 'Derived from activeTab: "leasing" → leasing, "venda" → sale.',
  },

  contractual_term_months: {
    uiLabel: 'Prazo Contratual (meses)',
    domain: 'contract',
    proposalSource: ['prazoMeses', 'leasingSnapshot.prazoContratualMeses'],
    canonicalTable: 'client_contracts',
    dbColumn: 'contractual_term_months',
    requiredForClosing: true,
    computed: false,
    editableAfterClosing: false,
  },

  valor_sistema_fotovoltaico: {
    uiLabel: 'Valor do Sistema Fotovoltaico (R$)',
    domain: 'contract',
    proposalSource: [
      'vendaSnapshot.composicao.venda_total',
      'leasingSnapshot.valorDeMercadoEstimado',
    ],
    canonicalTable: 'client_contracts',
    dbColumn: 'buyout_amount_reference',
    requiredForClosing: false,
    computed: true,
    engine: 'financial_analysis',
    editableAfterClosing: false,
  },

  buyout_eligible: {
    uiLabel: 'Elegível para Buyout',
    domain: 'contract',
    proposalSource: 'leasingSnapshot.prazoContratualMeses',
    canonicalTable: 'client_contracts',
    dbColumn: 'buyout_eligible',
    requiredForClosing: false,
    computed: true,
    engine: 'financial_analysis',
    editableAfterClosing: false,
    notes: 'Only applicable for leasing contracts.',
  },

  // ── E. BILLING ─────────────────────────────────────────────────────────────

  due_day: {
    uiLabel: 'Dia de Vencimento',
    domain: 'billing',
    proposalSource: 'cliente.diaVencimento',
    canonicalTable: 'client_billing_profile',
    dbColumn: 'due_day',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
    notes: 'Default: 10. User selects from fixed options.',
  },

  auto_reminder_enabled: {
    uiLabel: 'Lembrete Automático',
    domain: 'billing',
    proposalSource: '',
    canonicalTable: 'client_billing_profile',
    dbColumn: 'auto_reminder_enabled',
    requiredForClosing: false,
    computed: false,
    editableAfterClosing: true,
    notes: 'Default: true. No proposal source — set after closing.',
  },

  // ── F. DERIVED ─────────────────────────────────────────────────────────────

  mensalidade: {
    uiLabel: 'Mensalidade (R$/mês)',
    domain: 'derived',
    proposalSource: 'leasingSnapshot.projecao.mensalidadesAno[0].mensalidade',
    canonicalTable: 'client_energy_profile',
    dbColumn: 'mensalidade',
    requiredForClosing: false,
    computed: true,
    engine: 'financial_analysis',
    editableAfterClosing: false,
  },

  potencia_kwp: {
    uiLabel: 'Potência (kWp) — energy profile',
    domain: 'derived',
    proposalSource: [
      'leasingSnapshot.dadosTecnicos.potenciaInstaladaKwp',
      'vendaSnapshot.configuracao.potencia_sistema_kwp',
    ],
    canonicalTable: 'client_energy_profile',
    dbColumn: 'potencia_kwp',
    requiredForClosing: false,
    computed: true,
    engine: 'technical_calculation',
    editableAfterClosing: true,
    notes: 'Mirror of system_kwp stored in client_energy_profile for legacy queries.',
  },
}

// ─── Convenience exports ──────────────────────────────────────────────────────

/**
 * Describes a single field transformation from a proposal to the portfolio.
 *
 * Used for audit trails, diagnostics, and auto-hydration during close.
 */
export interface ProposalToPortfolioMapping {
  /** The machine-readable field id from FIELD_OWNERSHIP_MAP */
  fieldId: string
  /** Dot-path to the value inside OrcamentoSnapshotData / payload_json */
  from: string | string[]
  /** Canonical destination table */
  toTable: CanonicalTable
  /** Canonical destination column */
  toField: string
  /** Whether the field must be present for "Fechar Negócio" */
  requiredForClosing: boolean
  /** Optional transform description */
  transform?: string
  /** Explicit source priority when multiple paths are available */
  sourcePriority?: string[]
}

/**
 * Convenience list of all required-for-closing fields derived from the map.
 */
export const REQUIRED_FOR_CLOSING_FIELDS = Object.entries(FIELD_OWNERSHIP_MAP)
  .filter(([, d]) => d.requiredForClosing)
  .map(([id, d]) => ({ id, ...d }))
