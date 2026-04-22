import type { ContractAttachment, PortfolioClientRow } from '../../../types/clientPortfolio'

export type ContractImportState =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'validating'
  | 'ready'
  | 'warning'
  | 'error'
  | 'imported'

export type SignatureRoleHint =
  | 'contratante'
  | 'corresponsavel'
  | 'proprietario'
  | 'solarinvest'
  | 'unknown'

export type ParsedSignature = {
  signerName: string | null
  signerDocument: string | null
  signedAt: string | null
  roleHint?: SignatureRoleHint
  rawBlock: string
}

export type ParsedContractFields = {
  contractorName: string | null
  contractorDocument: string | null
  contractorEmail: string | null
  contractorPhone: string | null
  contractorAddress: string | null
  proposalCode: string | null
  contractualTermMonths: number | null
  contractualTermCandidates: number[]
  kwhContratado: number | null
  city: string | null
  state: string | null
  contractorPostalCode: string | null
  distributor: string | null
  unitConsumerNumber: string | null
  installationType: string | null
}

export type ContractImportDiscrepancy = {
  field: string
  label: string
  currentValue: unknown
  importedValue: unknown
  severity: 'blocking' | 'warning'
  approvedManually?: boolean
  code?: string
}

export type ImportEligibility = {
  canImport: boolean
  reasons: string[]
  warnings: string[]
}

export type ContractImportAuditLog = {
  userId: string
  importedAt: string
  fileName: string
  detectedContractorName: string | null
  detectedContractorDocument: string | null
  detectedSignedAt: string | null
  activatedAutomatically: boolean
  discrepancies: Array<{
    field: string
    currentValue: unknown
    importedValue: unknown
    approvedManually: boolean
  }>
}

export type ContractImportPayload = {
  contractType: 'leasing_operacional'
  contractorName: string | null
  contractorDocument: string | null
  contractorEmail: string | null
  contractorPhone: string | null
  contractorAddress: string | null
  contractorCity: string | null
  contractorState: string | null
  signedAt: string | null
  status: 'active'
  proposalCode: string | null
  unitConsumerNumber: string | null
  distributor: string | null
  kwhContratado: number | null
  prazoContratualMeses: number | null
  importedFromSignedPdf: true
  importedFileId?: string
  importWarnings?: string[]
  manualApprovals?: string[]
}

export const CONTRACT_TAG_MAP = {
  nomeCompleto: 'contract.contractorName',
  cpfCnpj: 'contract.contractorDocument',
  enderecoCompleto: 'contract.contractorAddress',
  email: 'contract.contractorEmail',
  telefone: 'contract.contractorPhone',
  kwhContratado: 'plan.kwhContratado',
  prazoContratual: 'plan.prazoContratual',
  cidade: 'contract.city',
  UF: 'contract.state',
  dia: 'contract.instrumentDay',
  mes: 'contract.instrumentMonth',
  anoContrato: 'contract.instrumentYear',
} as const

export type PlanComparableData = Pick<
  PortfolioClientRow,
  | 'kwh_contratado'
  | 'kwh_mes_contratado'
  | 'prazo_meses'
  | 'modalidade'
  | 'uc'
  | 'distribuidora'
  | 'document'
  | 'name'
>

export type ContractImportPreview = {
  payload: ContractImportPayload
  signatures: ParsedSignature[]
  contractorSignature: ParsedSignature | null
  discrepancies: ContractImportDiscrepancy[]
  eligibility: ImportEligibility
  attachmentMetadata: ContractAttachment
  warnings: string[]
  parsedFields: ParsedContractFields
  plainText: string
  comparisons: ContractImportComparisonItem[]
}

export type ComparisonStatus = 'green' | 'yellow' | 'red'

export type ContractImportComparisonItem = {
  code: string
  field: string
  label: string
  currentValue: string | null
  importedValue: string | null
  status: ComparisonStatus
  requiresManualApproval: boolean
}
