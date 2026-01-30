import type { SegmentoCliente } from '../finance/roi'
import type { ClienteDados } from '../../types/printableProposal'
import type { RequiredClientField } from './validateRequiredFields'

export type RequiredFieldsInput = {
  cliente: ClienteDados
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro: string
  kcKwhMes: number
  tarifaCheia: number
  tipoRede: string
}

const resolveTipoEdificacaoValue = ({
  segmentoCliente,
  tipoEdificacaoOutro,
}: Pick<RequiredFieldsInput, 'segmentoCliente' | 'tipoEdificacaoOutro'>) => {
  if (!segmentoCliente) {
    return ''
  }
  if (segmentoCliente === 'outros') {
    return tipoEdificacaoOutro
  }
  return segmentoCliente
}

export const buildRequiredFieldsBase = ({
  cliente,
  segmentoCliente,
  tipoEdificacaoOutro,
  kcKwhMes,
  tarifaCheia,
  tipoRede,
}: RequiredFieldsInput): RequiredClientField[] => [
  {
    key: 'nomeRazao',
    label: 'Nome ou Razão social',
    selector: '[data-field="cliente-nomeRazao"]',
    getValue: () => cliente.nome,
  },
  {
    key: 'cpfCnpj',
    label: 'CPF/CNPJ',
    selector: '[data-field="cliente-cpfCnpj"]',
    getValue: () => cliente.documento,
  },
  {
    key: 'cep',
    label: 'CEP',
    selector: '[data-field="cliente-cep"]',
    getValue: () => cliente.cep,
  },
  {
    key: 'tipoEdificacao',
    label: 'Tipo de Edificação',
    selector: '[data-field="cliente-tipoEdificacao"]',
    getValue: () =>
      resolveTipoEdificacaoValue({
        segmentoCliente,
        tipoEdificacaoOutro,
      }),
  },
  {
    key: 'consumoKwhMes',
    label: 'Consumo (kWh/mês)',
    selector: '[data-field="cliente-consumoKwhMes"]',
    getValue: () => (Number.isFinite(kcKwhMes) && kcKwhMes > 0 ? 'ok' : ''),
  },
  {
    key: 'tarifaCheia',
    label: 'Tarifa cheia (R$/kWh)',
    selector: '[data-field="cliente-tarifaCheia"]',
    getValue: () => (Number.isFinite(tarifaCheia) && tarifaCheia > 0.9 ? 'ok' : ''),
  },
  {
    key: 'tipoRede',
    label: 'Tipo de rede',
    selector: '[data-field="cliente-tipoRede"]',
    getValue: () => (tipoRede && tipoRede !== 'nenhum' ? 'ok' : ''),
  },
]

export const buildRequiredFieldsVenda = (input: RequiredFieldsInput): RequiredClientField[] =>
  buildRequiredFieldsBase(input)
