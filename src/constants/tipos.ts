export const TIPOS_CLIENTE = [
  'residencial',
  'comercial',
  'condominio_vertical',
  'condominio_horizontal',
  'outros',
] as const

export type TipoCliente = (typeof TIPOS_CLIENTE)[number]

export const TIPOS_INSTALACAO = [
  'telhado_fibrocimento',
  'telhado_metalico',
  'telhado_ceramico',
  'telhado_madeira',
  'telhado_plano',
  'laje_concreto',
  'solo',
  'outros',
] as const

export type TipoInstalacaoDetalhado = (typeof TIPOS_INSTALACAO)[number]
