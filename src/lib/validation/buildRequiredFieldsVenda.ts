import type { SegmentoCliente } from '../finance/roi'
import type { LeasingContratoDados } from '../../store/useLeasingStore'
import type { ClienteDados } from '../../types/printableProposal'
import type { RequiredClientField } from './validateRequiredFields'

export type RequiredFieldsInput = {
  cliente: ClienteDados
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro: string
  leasingContrato: LeasingContratoDados
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
  leasingContrato,
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
    key: 'rg',
    label: 'RG',
    selector: '[data-field="cliente-rg"]',
    getValue: () => cliente.rg,
  },
  {
    key: 'estadoCivil',
    label: 'Estado Civil',
    selector: '[data-field="cliente-estadoCivil"]',
    getValue: () => cliente.estadoCivil,
  },
  {
    key: 'email',
    label: 'E-mail',
    selector: '[data-field="cliente-email"]',
    getValue: () => cliente.email,
  },
  {
    key: 'telefone',
    label: 'Telefone',
    selector: '[data-field="cliente-telefone"]',
    getValue: () => cliente.telefone,
  },
  {
    key: 'cep',
    label: 'CEP',
    selector: '[data-field="cliente-cep"]',
    getValue: () => cliente.cep,
  },
  {
    key: 'distribuidoraAneel',
    label: 'Distribuidora (ANEEL)',
    selector: '[data-field="cliente-distribuidoraAneel"]',
    getValue: () => cliente.distribuidora,
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
    key: 'ucGeradoraNumero',
    label: 'UC Geradora (número)',
    selector: '[data-field="cliente-ucGeradoraNumero"]',
    getValue: () => cliente.uc,
  },
  {
    key: 'enderecoContratante',
    label: 'Endereço do Contratante',
    selector: '[data-field="cliente-enderecoContratante"]',
    getValue: () => cliente.endereco,
  },
  {
    key: 'enderecoInstalacaoUcGeradora',
    label: 'Endereço de instalação da UC geradora',
    selector: '[data-field="cliente-enderecoInstalacaoUcGeradora"]',
    getValue: () => leasingContrato.localEntrega,
  },
  {
    key: 'cidadeUf',
    label: 'Cidade e UF ou Estado',
    selector: '[data-field="cliente-cidade"], [data-field="cliente-uf"]',
    getValue: () => {
      const cidade = cliente.cidade
      const uf = cliente.uf
      return cidade?.trim() && uf?.trim() ? 'ok' : ''
    },
  },
]

export const buildRequiredFieldsVenda = (input: RequiredFieldsInput): RequiredClientField[] =>
  buildRequiredFieldsBase(input)
