import type { RequiredClientField } from './validateRequiredFields'

export type LeasingProposalRequiredFieldsInput = {
  clienteNome: string
  consumoKwhMes: number
}

export const buildRequiredFieldsLeasingProposta = ({
  clienteNome,
  consumoKwhMes,
}: LeasingProposalRequiredFieldsInput): RequiredClientField[] => [
  {
    key: 'nomeRazao',
    label: 'Nome ou Razão social',
    selector: '[data-field="cliente-nomeRazao"]',
    getValue: () => clienteNome,
  },
  {
    key: 'consumoKwhMes',
    label: 'Consumo (kWh/mês)',
    selector: '[data-field="proposta-consumoKwhMes"]',
    getValue: () =>
      Number.isFinite(consumoKwhMes) && consumoKwhMes > 0 ? consumoKwhMes : '',
  },
]
