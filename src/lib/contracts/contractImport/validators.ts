import type {
  ContractImportDiscrepancy,
  ImportEligibility,
  ParsedContractFields,
  ParsedSignature,
} from './types'
import { normalizeDocument, normalizePersonName } from './normalizers'

export function detectMainContractorSignature(
  fields: ParsedContractFields,
  signatures: ParsedSignature[],
): ParsedSignature | null {
  const contractorDoc = normalizeDocument(fields.contractorDocument)
  if (contractorDoc) {
    const byDoc = signatures.find((sig) => normalizeDocument(sig.signerDocument) === contractorDoc)
    if (byDoc) return byDoc
  }

  const contractorName = fields.contractorName ? normalizePersonName(fields.contractorName) : null
  if (contractorName) {
    const byName = signatures.find((sig) => {
      if (!sig.signerName) return false
      return normalizePersonName(sig.signerName) === contractorName
    })
    if (byName) return byName
  }

  return null
}

export function buildImportEligibility(
  args: {
    isPdf: boolean
    parsedText: string
    fields: ParsedContractFields
    contractorSignature: ParsedSignature | null
    discrepancies: ContractImportDiscrepancy[]
    manualApprovalCodes: Set<string>
  },
): ImportEligibility {
  const reasons: string[] = []
  const warnings: string[] = []

  if (!args.isPdf) reasons.push('Arquivo inválido: envie um PDF.')
  if (!args.parsedText.trim()) reasons.push('PDF não parseável: nenhum texto encontrado.')
  if (!args.fields.contractorName) reasons.push('Contratante principal não identificado no contrato.')
  if (!args.fields.contractorDocument) reasons.push('CPF/CNPJ do contratante não identificado no contrato.')
  if (!args.contractorSignature) reasons.push('Assinatura eletrônica do contratante principal não encontrada.')
  if (args.contractorSignature && !args.contractorSignature.signedAt) {
    reasons.push('Data/hora da assinatura do contratante não encontrada.')
  }
  if (args.contractorSignature && args.fields.contractorDocument) {
    const signerDoc = normalizeDocument(args.contractorSignature.signerDocument)
    const contractorDoc = normalizeDocument(args.fields.contractorDocument)
    if (signerDoc && contractorDoc && signerDoc !== contractorDoc) {
      reasons.push('CPF/CNPJ da assinatura é diferente do CPF/CNPJ do contratante.')
    }
  }

  for (const diff of args.discrepancies) {
    if (diff.severity === 'blocking') {
      if (!diff.code || !args.manualApprovalCodes.has(diff.code)) {
        reasons.push(`Discrepância crítica pendente: ${diff.label}.`)
      }
    } else {
      warnings.push(`Divergência: ${diff.label}.`)
    }
  }

  return {
    canImport: reasons.length === 0,
    reasons,
    warnings,
  }
}
