import type { UcBeneficiariaFormState } from '../types/ucBeneficiaria'

const createUcBeneficiariaId = () =>
  `UCB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

export const createEmptyUcBeneficiaria = (): UcBeneficiariaFormState => ({
  id: createUcBeneficiariaId(),
  numero: '',
  endereco: '',
  consumoKWh: '',
  rateioPercentual: '',
})
