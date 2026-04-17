// src/utils/contractReadiness.ts
// Pure helper to evaluate whether a contract can be generated from a proposal,
// independently of whether the client is persisted to the backend/portfolio.

/**
 * Minimum client data required to fill a contract template.
 * These fields must come from in-memory proposal data, NOT from a
 * persisted server record.
 */
export interface ContractClientData {
  nome?: string | null
  documento?: string | null
  cep?: string | null
  endereco?: string | null
  cidade?: string | null
  uf?: string | null
  uc?: string | null
  distribuidora?: string | null
}

export interface ContractReadinessInput {
  /** In-memory client data from the proposal form */
  clientData: ContractClientData
  /** Whether the client has a stable server-persisted ID */
  clientId?: string | null
  /** Whether the client is already in the portfolio */
  inPortfolio?: boolean
  /** Whether the proposal has a conflict flag */
  isConflicted?: boolean
  /** Conflict reason from the proposal */
  conflictReason?: string | null
}

export interface ContractReadinessResult {
  /** Whether the contract can be generated (minimum data present) */
  canGenerate: boolean
  /** Whether the contract can be directly linked to a portfolio client */
  canLinkNow: boolean
  /** Whether the contract will be generated in pending-link mode */
  willUsePendingMode: boolean
  /** List of missing required fields preventing generation */
  missingFields: string[]
  /** Human-readable reason if generation is blocked */
  reason?: string | null
}

/**
 * Normalizes a document string (CPF/CNPJ) to digits only.
 */
function normalizeDocDigits(doc: string | null | undefined): string {
  if (!doc) return ''
  return doc.replace(/\D/g, '')
}

/**
 * Evaluates whether a contract can be generated from the available data.
 *
 * This function is PURE — no side effects, no API calls, no state mutations.
 * It separates "can we generate the document?" from "can we link it to a
 * portfolio client?" — these are independent concerns.
 */
export function evaluateContractGenerationReadiness(
  input: ContractReadinessInput,
): ContractReadinessResult {
  const { clientData, clientId, inPortfolio } = input
  const missingFields: string[] = []

  const nome = clientData.nome?.trim() ?? ''
  const docDigits = normalizeDocDigits(clientData.documento)
  const cepDigits = normalizeDocDigits(clientData.cep)
  const endereco = clientData.endereco?.trim() ?? ''
  const cidade = clientData.cidade?.trim() ?? ''
  const uf = clientData.uf?.trim() ?? ''
  const uc = normalizeDocDigits(clientData.uc)
  const distribuidora = clientData.distribuidora?.trim() ?? ''

  if (!nome) missingFields.push('nome ou razão social')
  if (!docDigits || (docDigits.length !== 11 && docDigits.length !== 14)) {
    missingFields.push('CPF ou CNPJ completo')
  }
  if (!cepDigits || cepDigits.length !== 8) {
    missingFields.push('CEP com 8 dígitos')
  }
  if (!endereco) missingFields.push('endereço de instalação')
  if (!cidade) missingFields.push('cidade')
  if (!uf) missingFields.push('estado (UF)')
  if (!distribuidora) missingFields.push('distribuidora (ANEEL)')
  if (!uc) missingFields.push('código da unidade consumidora (UC)')

  const canGenerate = missingFields.length === 0
  const canLinkNow = canGenerate && Boolean(clientId) && Boolean(inPortfolio)
  const willUsePendingMode = canGenerate && !canLinkNow

  return {
    canGenerate,
    canLinkNow,
    willUsePendingMode,
    missingFields,
    reason: canGenerate
      ? null
      : `Campos obrigatórios faltando: ${missingFields.join(', ')}`,
  }
}
