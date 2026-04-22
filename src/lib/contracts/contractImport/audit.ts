import type { ContractImportAuditLog, ContractImportDiscrepancy } from './types'

export function buildContractImportAuditLog(input: {
  userId: string
  fileName: string
  detectedContractorName: string | null
  detectedContractorDocument: string | null
  detectedSignedAt: string | null
  activatedAutomatically: boolean
  discrepancies: ContractImportDiscrepancy[]
  manualApprovalCodes: Set<string>
}): ContractImportAuditLog {
  return {
    userId: input.userId,
    importedAt: new Date().toISOString(),
    fileName: input.fileName,
    detectedContractorName: input.detectedContractorName,
    detectedContractorDocument: input.detectedContractorDocument,
    detectedSignedAt: input.detectedSignedAt,
    activatedAutomatically: input.activatedAutomatically,
    discrepancies: input.discrepancies.map((item) => ({
      field: item.field,
      currentValue: item.currentValue,
      importedValue: item.importedValue,
      approvedManually: Boolean(item.code && input.manualApprovalCodes.has(item.code)),
    })),
  }
}
