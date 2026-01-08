import type { SegmentoCliente } from '../finance/roi'
import type { ClienteDados } from '../../types/printableProposal'
import type { RequiredClientField } from './validateRequiredFields'

export type BuildRequiredFieldsParams = {
  cliente: ClienteDados
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro: string
}

export const buildRequiredFieldsVenda = (
  params: BuildRequiredFieldsParams,
): RequiredClientField[] => {
  const { cliente, segmentoCliente, tipoEdificacaoOutro } = params
  const tipoEdificacaoValue =
    segmentoCliente === 'outros' ? tipoEdificacaoOutro : segmentoCliente
  const tipoEdificacaoSelector =
    segmentoCliente === 'outros'
      ? '[data-field="cliente-tipoEdificacaoOutro"]'
      : '[data-field="cliente-tipoEdificacao"]'

  return [
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
      label: 'E-MAIL',
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
      key: 'distribuidora',
      label: 'Distribuidora (ANEEL)',
      selector: '[data-field="cliente-distribuidoraAneel"]',
      getValue: () => cliente.distribuidora,
    },
    {
      key: 'tipoEdificacao',
      label: 'Tipo de Edificação',
      selector: tipoEdificacaoSelector,
      getValue: () => tipoEdificacaoValue,
    },
    {
      key: 'ucGeradora',
      label: 'UC Geradora (número)',
      selector: '[data-field="cliente-ucGeradoraNumero"]',
      getValue: () => cliente.uc,
    },
    {
      key: 'enderecoContratante',
      label: 'Endereço do Contratante',
      selector: '[data-field="cliente-enderecoContratante"]',
      getValue: () => cliente.enderecoContratante,
    },
    {
      key: 'enderecoInstalacao',
      label: 'Endereço de instalação da UC geradora',
      selector: '[data-field="cliente-enderecoInstalacaoUcGeradora"]',
      getValue: () => cliente.endereco,
    },
    {
      key: 'cidadeUf',
      label: 'Cidade e UF ou Estado',
      selector: '[data-field="cliente-cidade"]',
      getValue: () =>
        cliente.cidade.trim() && cliente.uf.trim() ? 'ok' : '',
    },
  ]
}
