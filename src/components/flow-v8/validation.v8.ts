/**
 * Flow V8 - Step Validation
 * Validates required fields per step without blocking calculations
 */

export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5

export interface ValidationResult {
  valid: boolean
  missing: string[]
}

// Define required fields per step for Vendas
export const vendasRequiredFieldsByStep: Record<StepIndex, string[]> = {
  0: ['nomeCliente', 'email'], // Cliente
  1: ['consumoMedioMensal'], // Consumo & Tarifa
  2: ['tipoInstalacao', 'tipoSistema'], // Sistema
  3: [], // Kit & Custos (optional, can use auto or manual)
  4: [], // Resultados (read-only)
  5: [], // Revisão (final check)
}

// Define required fields per step for Leasing
export const leasingRequiredFieldsByStep: Record<StepIndex, string[]> = {
  0: ['nomeCliente', 'email'], // Cliente
  1: ['consumoMedioMensal'], // Consumo & Tarifa
  2: ['tipoInstalacao', 'tipoSistema'], // Sistema
  3: ['leasingPrazo'], // Oferta de Leasing
  4: [], // Projeções (read-only)
  5: [], // Revisão (final check)
}

/**
 * Get missing required fields for a specific step
 */
export function getMissingForStep(
  stepIndex: StepIndex,
  values: Record<string, unknown>,
  mode: 'vendas' | 'leasing'
): string[] {
  const requiredMap = mode === 'vendas' ? vendasRequiredFieldsByStep : leasingRequiredFieldsByStep
  const requiredFields = requiredMap[stepIndex]
  
  const missing: string[] = []
  
  for (const field of requiredFields) {
    const value = values[field]
    if (value === null || value === undefined || value === '') {
      missing.push(field)
    }
  }
  
  return missing
}

/**
 * Check if a specific step is complete
 */
export function isStepComplete(
  stepIndex: StepIndex,
  values: Record<string, unknown>,
  mode: 'vendas' | 'leasing'
): boolean {
  const missing = getMissingForStep(stepIndex, values, mode)
  return missing.length === 0
}

/**
 * Get the first missing field across all steps (for checklist)
 */
export function getFirstMissingOverall(
  values: Record<string, unknown>,
  mode: 'vendas' | 'leasing'
): { step: StepIndex; field: string } | null {
  const requiredMap = mode === 'vendas' ? vendasRequiredFieldsByStep : leasingRequiredFieldsByStep
  
  for (let step = 0; step <= 5; step++) {
    const missing = getMissingForStep(step as StepIndex, values, mode)
    if (missing.length > 0 && missing[0]) {
      return { step: step as StepIndex, field: missing[0] }
    }
  }
  
  return null
}

/**
 * Get all missing fields for final validation before proposal generation
 */
export function getAllMissingFields(
  values: Record<string, unknown>,
  mode: 'vendas' | 'leasing'
): Array<{ step: StepIndex; field: string; label: string }> {
  const requiredMap = mode === 'vendas' ? vendasRequiredFieldsByStep : leasingRequiredFieldsByStep
  const allMissing: Array<{ step: StepIndex; field: string; label: string }> = []
  
  const fieldLabels: Record<string, string> = {
    nomeCliente: 'Nome do cliente',
    email: 'E-mail',
    consumoMedioMensal: 'Consumo médio mensal',
    tipoInstalacao: 'Tipo de instalação',
    tipoSistema: 'Tipo de sistema',
    leasingPrazo: 'Prazo do leasing',
  }
  
  for (let step = 0; step <= 5; step++) {
    const missing = getMissingForStep(step as StepIndex, values, mode)
    for (const field of missing) {
      allMissing.push({
        step: step as StepIndex,
        field,
        label: fieldLabels[field] || field,
      })
    }
  }
  
  return allMissing
}

/**
 * Validate if proposal can be generated
 */
export function canGenerateProposal(
  values: Record<string, unknown>,
  mode: 'vendas' | 'leasing'
): ValidationResult {
  const missing = getAllMissingFields(values, mode)
  return {
    valid: missing.length === 0,
    missing: missing.map((m) => m.label),
  }
}
