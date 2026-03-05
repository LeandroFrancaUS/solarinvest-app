import type { ClienteDados } from './printableProposal'
import type { PrintableProposalTipo } from './printableProposal'

export type PropostaImportOrcamentoItem = {
  produto: string
  descricao?: string
  quantidade?: number | null
  unidade?: string | null
  precoUnit?: number | null
  precoTotal?: number | null
}

/** Data embedded in generated proposal PDFs for round-trip import. */
export type PropostaImportData = {
  /** Schema version – must be 1. */
  _v: 1
  tipo: PrintableProposalTipo
  cliente: ClienteDados
  consumo_kwh_mes: number
  tarifa_r_kwh: number
  inflacao_energia_aa: number
  uf: string
  distribuidora: string
  irradiacao_kwhm2_dia?: number
  potencia_modulo_wp?: number
  n_modulos?: number
  geracao_estimada_kwh_mes?: number
  tipo_instalacao?: string
  tipo_sistema?: string
  modelo_modulo?: string
  modelo_inversor?: string
  desconto_pct?: number
  leasing_prazo_meses?: number
  orcamento_itens?: PropostaImportOrcamentoItem[]
  valor_total?: number
  budget_id?: string
}

export const IMPORT_MARKER_START = 'SOLARINVEST_IMPORT_V1_START:'
export const IMPORT_MARKER_END = ':SOLARINVEST_IMPORT_V1_END'
