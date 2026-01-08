import { useVendaStore } from '../../store/useVendaStore'
import { normalizeText, type RequiredClientField } from './clientRequiredFields'

export function buildRequiredFieldsVenda(): RequiredClientField[] {
  const { cliente, configuracao } = useVendaStore.getState()
  const cidade = normalizeText(cliente.cidade)
  const uf = normalizeText(cliente.uf)

  return [
    {
      key: 'nomeRazao',
      label: 'Nome ou Razão social',
      selector: '[data-field="cliente-nome"]',
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
      key: 'distribuidoraAneel',
      label: 'Distribuidora (ANEEL)',
      selector: '[data-field="cliente-distribuidora"]',
      getValue: () => cliente.distribuidora,
    },
    {
      key: 'tipoEdificacao',
      label: 'Tipo de Edificação',
      selector: '[data-field="cliente-tipoEdificacao"]',
      getValue: () => configuracao.segmento,
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
      selector: '[data-field="cliente-enderecoInstalacao"]',
      getValue: () => cliente.enderecoInstalacaoUcGeradora,
    },
    {
      key: 'cidadeUf',
      label: 'Cidade e UF ou Estado',
      selector: '[data-field="cliente-cidade"], [data-field="cliente-uf"]',
      getValue: () => (cidade && uf ? 'ok' : ''),
    },
  ]
}
