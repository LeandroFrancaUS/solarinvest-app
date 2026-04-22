import type { ContractAttachment, PortfolioClientRow } from '../types/clientPortfolio'
import { patchPortfolioContract, patchPortfolioPlan } from './clientPortfolioApi'
import { buildContractImportAuditLog } from '../lib/contracts/contractImport/audit'
import { parseContractFromText, extractPdfText } from '../lib/contracts/contractImport/parser'
import { compareImportedWithPlan } from '../lib/contracts/contractImport/planComparator'
import { buildImportEligibility } from '../lib/contracts/contractImport/validators'
import type { ContractImportPayload, ContractImportPreview } from '../lib/contracts/contractImport/types'
import { formatCpfCnpj } from '../lib/contracts/contractImport/normalizers'

async function sha256Hex(file: File): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const data = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function buildAttachment(file: File, checksum: string | null): ContractAttachment {
  const objectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : null

  return {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
    sizeBytes: file.size,
    storageKey: checksum ? `sha256:${checksum}` : null,
    uploadedAt: new Date().toISOString(),
    url: objectUrl,
  }
}

function buildPayload(preview: ContractImportPreview, manualApprovals: string[]): ContractImportPayload {
  const { parsedFields, contractorSignature, warnings } = preview
  return {
    contractType: 'leasing_operacional',
    contractorName: parsedFields.contractorName,
    contractorDocument: formatCpfCnpj(parsedFields.contractorDocument),
    contractorEmail: parsedFields.contractorEmail,
    contractorPhone: parsedFields.contractorPhone,
    contractorAddress: parsedFields.contractorAddress,
    signedAt: contractorSignature?.signedAt ?? null,
    status: 'active',
    proposalCode: parsedFields.proposalCode,
    unitConsumerNumber: parsedFields.unitConsumerNumber,
    distributor: parsedFields.distributor,
    kwhContratado: parsedFields.kwhContratado,
    prazoContratualMeses: parsedFields.contractualTermMonths,
    importedFromSignedPdf: true,
    importedFileId: preview.attachmentMetadata.id,
    importWarnings: warnings,
    manualApprovals,
  }
}

export async function previewContractImport(file: File, client: PortfolioClientRow): Promise<ContractImportPreview> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const plainText = isPdf ? await extractPdfText(file) : ''
  const parsed = parseContractFromText(plainText)
  const discrepancies = compareImportedWithPlan(parsed.fields, {
    kwh_contratado: client.kwh_contratado,
    kwh_mes_contratado: client.kwh_mes_contratado,
    prazo_meses: client.prazo_meses,
    modalidade: client.modalidade ?? null,
    uc: client.uc,
    distribuidora: client.distribuidora,
    document: client.document,
    name: client.name,
  })

  const eligibility = buildImportEligibility({
    isPdf,
    parsedText: plainText,
    fields: parsed.fields,
    contractorSignature: parsed.contractorSignature,
    discrepancies,
    manualApprovalCodes: new Set<string>(),
  })

  const checksum = await sha256Hex(file)
  const attachmentMetadata = buildAttachment(file, checksum)

  const payload = buildPayload({
    payload: {} as ContractImportPayload,
    signatures: parsed.signatures,
    contractorSignature: parsed.contractorSignature,
    discrepancies,
    eligibility,
    attachmentMetadata,
    warnings: eligibility.warnings,
    parsedFields: parsed.fields,
    plainText,
  }, [])

  return {
    payload,
    signatures: parsed.signatures,
    contractorSignature: parsed.contractorSignature,
    discrepancies,
    eligibility,
    attachmentMetadata,
    warnings: eligibility.warnings,
    parsedFields: parsed.fields,
    plainText,
  }
}

export async function applyContractImport(input: {
  client: PortfolioClientRow
  preview: ContractImportPreview
  existingAttachments: ContractAttachment[]
  approvedCodes: string[]
  userId?: string
}): Promise<{ savedContractId: number; attachment: ContractAttachment; payload: ContractImportPayload }> {
  const manualApprovalCodes = new Set(input.approvedCodes)
  const eligibility = buildImportEligibility({
    isPdf: true,
    parsedText: input.preview.plainText,
    fields: input.preview.parsedFields,
    contractorSignature: input.preview.contractorSignature,
    discrepancies: input.preview.discrepancies,
    manualApprovalCodes,
  })

  if (!eligibility.canImport) {
    throw new Error(eligibility.reasons[0] ?? 'Importação inválida. Revise os dados do contrato.')
  }

  const payload = buildPayload(input.preview, input.approvedCodes)
  const mergedAttachments = [...input.existingAttachments, input.preview.attachmentMetadata]

  const auditLog = buildContractImportAuditLog({
    userId: input.userId ?? 'unknown',
    fileName: input.preview.attachmentMetadata.fileName,
    detectedContractorName: input.preview.parsedFields.contractorName,
    detectedContractorDocument: input.preview.parsedFields.contractorDocument,
    detectedSignedAt: input.preview.contractorSignature?.signedAt ?? null,
    activatedAutomatically: true,
    discrepancies: input.preview.discrepancies,
    manualApprovalCodes,
  })

  const savedContractId = await patchPortfolioContract(input.client.id, {
    id: input.client.contract_id ?? undefined,
    contract_type: input.client.contract_type ?? 'leasing',
    contract_status: 'active',
    source_proposal_id: payload.proposalCode,
    contract_signed_at: payload.signedAt ? payload.signedAt.slice(0, 10) : null,
    contractual_term_months: payload.prazoContratualMeses,
    notes: input.client.contract_notes,
    contract_attachments: mergedAttachments,
    contract_import_audit: auditLog,
    imported_from_signed_pdf: true,
  })

  await patchPortfolioPlan(input.client.id, {
    kwh_contratado: payload.kwhContratado,
    prazo_meses: payload.prazoContratualMeses,
    modalidade: input.client.modalidade ?? 'leasing',
  })

  return {
    savedContractId,
    attachment: input.preview.attachmentMetadata,
    payload,
  }
}
