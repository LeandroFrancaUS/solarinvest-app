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
    label: 'Informações da UC geradora',
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
  ...(leasingContrato.ucGeradoraTitularDiferente
    ? [
        {
          key: 'ucGeradoraTitularNomeCompleto',
          label: 'Nome completo do titular da UC geradora',
          selector: '[data-field="ucGeradoraTitular-nomeCompleto"]',
          getValue: () => leasingContrato.ucGeradoraTitular?.nomeCompleto,
        },
        {
          key: 'ucGeradoraTitularCpf',
          label: 'CPF do titular da UC geradora',
          selector: '[data-field="ucGeradoraTitular-cpf"]',
          getValue: () => leasingContrato.ucGeradoraTitular?.cpf,
        },
        {
          key: 'ucGeradoraTitularRg',
          label: 'RG do titular da UC geradora',
          selector: '[data-field="ucGeradoraTitular-rg"]',
          getValue: () => leasingContrato.ucGeradoraTitular?.rg,
        },
        {
          key: 'ucGeradoraTitularEnderecoCep',
          label: 'CEP do titular da UC geradora',
          selector: '[data-field="ucGeradoraTitular-cep"]',
          getValue: () => leasingContrato.ucGeradoraTitular?.endereco.cep,
        },
        {
          key: 'ucGeradoraTitularEnderecoLogradouro',
          label: 'Logradouro do titular da UC geradora',
          selector: '[data-field="ucGeradoraTitular-logradouro"]',
          getValue: () => leasingContrato.ucGeradoraTitular?.endereco.logradouro,
        },
        {
          key: 'ucGeradoraTitularEnderecoCidade',
          label: 'Cidade do titular da UC geradora',
          selector: '[data-field="ucGeradoraTitular-cidade"]',
          getValue: () => leasingContrato.ucGeradoraTitular?.endereco.cidade,
        },
        {
          key: 'ucGeradoraTitularEnderecoUf',
          label: 'UF do titular da UC geradora',
          selector: '[data-field="ucGeradoraTitular-uf"]',
          getValue: () => leasingContrato.ucGeradoraTitular?.endereco.uf,
        },
      ]
    : []),
]

export const buildRequiredFieldsVenda = (input: RequiredFieldsInput): RequiredClientField[] =>
  buildRequiredFieldsBase(input)
