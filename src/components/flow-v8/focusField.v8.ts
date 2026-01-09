/**
 * Flow V8 - Field Focus Utilities
 * Focuses on specific fields when navigating from checklist
 */

/**
 * Attempt to focus a field by data-field attribute or fallback to container
 */
export function focusField(fieldName: string, stepContainerSelector?: string): boolean {
  // Try to find by data-field attribute first
  const fieldSelector = `[data-field="${fieldName}"]`
  const field = document.querySelector(fieldSelector) as HTMLElement
  
  if (field) {
    // Scroll into view
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
    
    // Focus if it's an input/select/textarea
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    ) {
      setTimeout(() => {
        field.focus()
      }, 300)
      return true
    }
    
    // If it's a container with an input, focus the first input
    const firstInput = field.querySelector('input, select, textarea') as HTMLElement
    if (firstInput) {
      setTimeout(() => {
        firstInput.focus()
      }, 300)
      return true
    }
    
    return true
  }
  
  // Fallback: scroll to step container
  if (stepContainerSelector) {
    const container = document.querySelector(stepContainerSelector)
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }
  }
  
  return false
}

/**
 * Map field names to data-field selectors
 */
export const fieldSelectors: Record<string, string> = {
  nomeCliente: 'nomeCliente',
  email: 'email',
  consumoMedioMensal: 'consumoMedioMensal',
  tipoInstalacao: 'tipoInstalacao',
  tipoSistema: 'tipoSistema',
  leasingPrazo: 'leasingPrazo',
}

/**
 * Get user-friendly field label
 */
export function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    nomeCliente: 'Nome do cliente',
    email: 'E-mail',
    consumoMedioMensal: 'Consumo médio mensal',
    tipoInstalacao: 'Tipo de instalação',
    tipoSistema: 'Tipo de sistema',
    leasingPrazo: 'Prazo do leasing',
  }
  
  return labels[fieldName] || fieldName
}
