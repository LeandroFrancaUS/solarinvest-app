export const CLIENT_REQUIRED_ACTIONS = [
  'salvar-cliente',
  'gerar-contratos',
  'gerar-propostas',
  'salvar-proposta',
  'enviar-proposta',
  'refresh',
] as const

export type ClientRequiredAction = (typeof CLIENT_REQUIRED_ACTIONS)[number]

export type ClientFieldKey =
  | 'nomeRazao'
  | 'cpfCnpj'
  | 'rg'
  | 'estadoCivil'
  | 'email'
  | 'telefone'
  | 'cep'
  | 'distribuidoraAneel'
  | 'tipoEdificacao'
  | 'ucGeradoraNumero'
  | 'enderecoContratante'
  | 'enderecoInstalacaoUcGeradora'
  | 'cidadeUf'

export interface RequiredClientField {
  key: ClientFieldKey
  label: string
  selector: string
  getValue: () => unknown
}

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

export function isMissing(value: unknown): boolean {
  return normalizeText(value) === ''
}
