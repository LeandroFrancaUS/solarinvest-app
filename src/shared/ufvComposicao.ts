export type TipoInstalacao =
  | 'fibrocimento'
  | 'metalico'
  | 'ceramico'
  | 'laje'
  | 'solo'
  | 'outros'

export type UfvComposicaoTelhadoValores = {
  projeto: number
  instalacao: number
  materialCa: number
  crea: number
  art: number
  placa: number
  comissaoLiquida: number
  lucroBruto: number
  impostoRetido: number
}

export type UfvComposicaoSoloValores = UfvComposicaoTelhadoValores & {
  estruturaSolo: number
  tela: number
  portaoTela: number
  maoObraTela: number
  casaInversor: number
  brita: number
  terraplanagem: number
  trafo: number
  rede: number
}
