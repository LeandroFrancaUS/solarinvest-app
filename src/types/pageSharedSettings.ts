import type { SegmentoCliente } from '../lib/finance/roi'
import type { TipoInstalacao, TipoSistema } from './printableProposal'

export type PageSharedSettingsSnapshot = {
  kcKwhMes: number
  tarifaCheia: number
  taxaMinima: number
  ufTarifa: string
  distribuidoraTarifa: string
  potenciaModulo: number
  numeroModulosManual: number | ''
  segmentoCliente: SegmentoCliente
  tipoInstalacao: TipoInstalacao
  tipoSistema: TipoSistema
  consumoManual: boolean
  potenciaModuloDirty: boolean
  tipoInstalacaoDirty: boolean
}
