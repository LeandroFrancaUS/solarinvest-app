export interface TarifaContexto {
  kcKwhMes: number
  tarifaCheia: number
  descontoConsiderado: number

  inflacaoAa: number
  taxaMinima: number
  taxaMinimaInputEmpty: boolean

  tipoRede: string

  tusdPercent: number
  tusdTipoCliente: string
  tusdSubtipo: string
  tusdSimultaneidade: number
  tusdTarifaRkwh: number
  tusdAnoReferencia: number

  mesReajuste: number
  mesReferencia: number

  encargosFixos: number
  cidKwhBase: number

  baseIrradiacao: number
  eficienciaNormalizada: number
  diasMesNormalizado: number

  potenciaModulo: number

  ufTarifa: string

  aplicaTaxaMinima: boolean
}
