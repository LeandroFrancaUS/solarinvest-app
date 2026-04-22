import type { ContractImportDiscrepancy, ParsedContractFields, PlanComparableData } from './types'
import { normalizeDocument } from './normalizers'

export function compareImportedWithPlan(
  imported: ParsedContractFields,
  plan: PlanComparableData,
): ContractImportDiscrepancy[] {
  const diffs: ContractImportDiscrepancy[] = []

  const currentKwh = plan.kwh_mes_contratado ?? plan.kwh_contratado
  if (imported.kwhContratado != null && currentKwh != null && imported.kwhContratado !== currentKwh) {
    diffs.push({
      field: 'kwhContratado',
      label: 'kWh contratado',
      currentValue: currentKwh,
      importedValue: imported.kwhContratado,
      severity: 'warning',
    })
  }

  if (imported.contractualTermMonths != null && plan.prazo_meses != null && imported.contractualTermMonths !== plan.prazo_meses) {
    diffs.push({
      field: 'prazoContratual',
      label: 'Prazo contratual (meses)',
      currentValue: plan.prazo_meses,
      importedValue: imported.contractualTermMonths,
      severity: 'warning',
    })
  }

  if (imported.distributor && plan.distribuidora && imported.distributor !== plan.distribuidora) {
    diffs.push({
      field: 'distribuidora',
      label: 'Distribuidora',
      currentValue: plan.distribuidora,
      importedValue: imported.distributor,
      severity: 'warning',
    })
  }

  const systemDocument = normalizeDocument(plan.document)
  const importedDoc = normalizeDocument(imported.contractorDocument)
  if (systemDocument && importedDoc && systemDocument !== importedDoc) {
    diffs.push({
      field: 'contractorDocument',
      label: 'CPF/CNPJ do contratante',
      currentValue: plan.document,
      importedValue: imported.contractorDocument,
      severity: 'blocking',
      code: 'CONTRACT_DOCUMENT_MISMATCH',
    })
  }

  if (imported.contractorName && plan.name && imported.contractorName !== plan.name) {
    diffs.push({
      field: 'contractorName',
      label: 'Nome do contratante',
      currentValue: plan.name,
      importedValue: imported.contractorName,
      severity: 'warning',
    })
  }

  return diffs
}
