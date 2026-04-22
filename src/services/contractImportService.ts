import type { ContractAttachment, PortfolioClientRow } from '../types/clientPortfolio'
import { patchPortfolioContract, patchPortfolioPlan, patchPortfolioProfile } from './clientPortfolioApi'
import { buildContractImportAuditLog } from '../lib/contracts/contractImport/audit'
import { parseContractFromText, extractPdfText } from '../lib/contracts/contractImport/parser'
import { compareImportedWithPlan } from '../lib/contracts/contractImport/planComparator'
import { buildImportEligibility } from '../lib/contracts/contractImport/validators'
import type {
  ContractImportComparisonItem,
  ContractImportPayload,
  ContractImportPreview,
} from '../lib/contracts/contractImport/types'
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
    category: 'contrato_assinado',
    origin: 'importacao_contrato',
  }
}

function stringifyValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function buildComparisons(client: PortfolioClientRow, preview: {
  contractorName: string | null
  contractorDocument: string | null
  signedAt: string | null
  signatureFound: boolean
  kwhContratado: number | null
  prazoMeses: number | null
  proposalCode: string | null
  city: string | null
  state: string | null
  cep: string | null
}): ContractImportComparisonItem[] {
  const rows: Array<Omit<ContractImportComparisonItem, 'status' | 'requiresManualApproval'>> = [
    { code: 'CMP_CONTRACTOR_NAME', field: 'contractorName', label: 'Nome do contratante', currentValue: stringifyValue(client.name), importedValue: stringifyValue(preview.contractorName) },
    { code: 'CMP_CONTRACTOR_DOCUMENT', field: 'contractorDocument', label: 'CPF/CNPJ', currentValue: stringifyValue(client.document), importedValue: stringifyValue(preview.contractorDocument) },
    { code: 'CMP_SIGNATURE_FOUND', field: 'signatureFound', label: 'Assinatura encontrada', currentValue: null, importedValue: preview.signatureFound ? 'Sim' : 'Não' },
    { code: 'CMP_SIGNED_AT', field: 'signedAt', label: 'Data assinatura', currentValue: stringifyValue(client.contract_signed_at), importedValue: stringifyValue(preview.signedAt) },
    { code: 'CMP_KWH', field: 'kwhContratado', label: 'KWh contratado', currentValue: stringifyValue(client.kwh_mes_contratado ?? client.kwh_contratado), importedValue: stringifyValue(preview.kwhContratado) },
    { code: 'CMP_TERM', field: 'prazo', label: 'Prazo', currentValue: stringifyValue(client.prazo_meses ?? client.contractual_term_months), importedValue: stringifyValue(preview.prazoMeses) },
    { code: 'CMP_PROPOSAL_CODE', field: 'proposalCode', label: 'Código', currentValue: stringifyValue(client.source_proposal_id), importedValue: stringifyValue(preview.proposalCode) },
    { code: 'CMP_CITY', field: 'city', label: 'Cidade', currentValue: stringifyValue(client.city), importedValue: stringifyValue(preview.city) },
    { code: 'CMP_STATE', field: 'state', label: 'UF', currentValue: stringifyValue(client.state), importedValue: stringifyValue(preview.state) },
    { code: 'CMP_CEP', field: 'cep', label: 'CEP', currentValue: null, importedValue: stringifyValue(preview.cep) },
  ]

  return rows.map((row) => {
    if (!row.currentValue) {
      return { ...row, status: 'green', requiresManualApproval: false }
    }
    if (row.currentValue === row.importedValue) {
      return { ...row, status: 'yellow', requiresManualApproval: false }
    }
    return { ...row, status: 'red', requiresManualApproval: true }
  })
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
    contractorCity: parsedFields.city,
    contractorState: parsedFields.state,
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

  const checksum = await sha256Hex(file)
  const attachmentMetadata = buildAttachment(file, checksum)
  const comparisons = buildComparisons(client, {
    contractorName: parsed.fields.contractorName,
    contractorDocument: parsed.fields.contractorDocument,
    signedAt: parsed.contractorSignature?.signedAt ?? null,
    signatureFound: Boolean(parsed.contractorSignature),
    kwhContratado: parsed.fields.kwhContratado,
    prazoMeses: parsed.fields.contractualTermMonths,
    proposalCode: parsed.fields.proposalCode,
    city: parsed.fields.city,
    state: parsed.fields.state,
    cep: parsed.fields.contractorPostalCode,
  })
  const comparisonDiscrepancies = comparisons
    .filter((item) => item.status === 'red')
    .map((item) => ({
      field: item.field,
      label: item.label,
      currentValue: item.currentValue,
      importedValue: item.importedValue,
      severity: 'blocking' as const,
      code: item.code,
    }))
  const allDiscrepancies = [...discrepancies, ...comparisonDiscrepancies]
  const eligibility = buildImportEligibility({
    isPdf,
    parsedText: plainText,
    fields: parsed.fields,
    contractorSignature: parsed.contractorSignature,
    discrepancies: allDiscrepancies,
    manualApprovalCodes: new Set<string>(),
  })

  const payload = buildPayload({
    payload: {} as ContractImportPayload,
    signatures: parsed.signatures,
    contractorSignature: parsed.contractorSignature,
    discrepancies: allDiscrepancies,
    eligibility,
    attachmentMetadata,
    warnings: eligibility.warnings,
    parsedFields: parsed.fields,
    plainText,
    comparisons: [],
  }, [])

  return {
    payload,
    signatures: parsed.signatures,
    contractorSignature: parsed.contractorSignature,
    discrepancies: allDiscrepancies,
    eligibility,
    attachmentMetadata,
    warnings: eligibility.warnings,
    parsedFields: parsed.fields,
    plainText,
    comparisons,
  }
}

export async function applyContractImport(input: {
  client: PortfolioClientRow
  preview: ContractImportPreview
  existingAttachments: ContractAttachment[]
  approvedCodes: string[]
  decisions?: Record<string, 'import' | 'keep' | undefined>
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
  const decisions = input.decisions ?? {}
  const choose = <T>(code: string, imported: T | null | undefined, current: T | null | undefined): T | null => {
    if (decisions[code] === 'keep') return (current ?? null) as T | null
    return (imported ?? null) as T | null
  }
  const chosenContractorName = choose('CMP_CONTRACTOR_NAME', input.preview.parsedFields.contractorName, input.client.name)
  const chosenContractorDocument = choose('CMP_CONTRACTOR_DOCUMENT', input.preview.parsedFields.contractorDocument, input.client.document)
  const chosenContractorEmail = choose('CMP_CONTRACTOR_EMAIL', input.preview.parsedFields.contractorEmail, input.client.email)
  const chosenContractorPhone = choose('CMP_CONTRACTOR_PHONE', input.preview.parsedFields.contractorPhone, input.client.phone)
  const chosenContractorAddress = choose('CMP_CONTRACTOR_ADDRESS', input.preview.parsedFields.contractorAddress, input.client.address ?? null)
  const chosenCity = choose('CMP_CITY', input.preview.parsedFields.city, input.client.city)
  const chosenState = choose('CMP_STATE', input.preview.parsedFields.state, input.client.state)
  const chosenKwh = choose('CMP_KWH', payload.kwhContratado, input.client.kwh_mes_contratado ?? input.client.kwh_contratado)
  const chosenTerm = choose('CMP_TERM', payload.prazoContratualMeses, input.client.prazo_meses ?? input.client.contractual_term_months)
  const chosenCode = choose('CMP_PROPOSAL_CODE', payload.proposalCode, input.client.source_proposal_id)
  const chosenSignedAt = choose('CMP_SIGNED_AT', payload.signedAt, input.client.contract_signed_at)
  const mergedAttachments = [
    ...input.existingAttachments.filter((att) => att.origin !== 'importacao_contrato'),
    input.preview.attachmentMetadata,
  ]

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
    source_proposal_id: chosenCode,
    contract_signed_at: chosenSignedAt ? String(chosenSignedAt).slice(0, 10) : null,
    contractual_term_months: chosenTerm,
    notes: input.client.contract_notes,
    contract_attachments: mergedAttachments,
    contract_import_audit: auditLog,
    imported_from_signed_pdf: true,
  })

  await patchPortfolioPlan(input.client.id, {
    kwh_contratado: chosenKwh,
    prazo_meses: chosenTerm,
    modalidade: input.client.modalidade ?? 'leasing',
  })

  await patchPortfolioProfile(input.client.id, {
    client_name: chosenContractorName ?? undefined,
    client_document: chosenContractorDocument ?? undefined,
    client_phone: chosenContractorPhone ?? undefined,
    client_email: chosenContractorEmail ?? undefined,
    client_city: chosenCity ?? undefined,
    client_state: chosenState ?? undefined,
    client_address: chosenContractorAddress ?? undefined,
    client_cep: input.preview.parsedFields.contractorPostalCode ?? undefined,
  })

  return {
    savedContractId,
    attachment: input.preview.attachmentMetadata,
    payload: {
      ...payload,
      contractorName: chosenContractorName,
      contractorDocument: chosenContractorDocument,
      contractorEmail: chosenContractorEmail,
      contractorPhone: chosenContractorPhone,
      contractorAddress: chosenContractorAddress,
      contractorCity: chosenCity,
      contractorState: chosenState,
      signedAt: chosenSignedAt,
      proposalCode: chosenCode,
      kwhContratado: chosenKwh,
      prazoContratualMeses: chosenTerm,
    },
  }
}
