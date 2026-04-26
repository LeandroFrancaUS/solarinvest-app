import { createStore } from '../../store/createStore'

export type AfModo = 'venda' | 'leasing'
export type AfUfOverride = '' | 'GO' | 'DF'

export interface AfInputState {
  afModo: AfModo
  afConsumoOverride: number
  afNumModulosOverride: number | null
  afModuloWpOverride: number
  afIrradiacaoOverride: number
  afPROverride: number
  afDiasOverride: number
  afUfOverride: AfUfOverride
  afCustoKit: number
  afCustoKitManual: boolean
  afFrete: number
  afFreteManual: boolean
  afDescarregamento: number
  afHotelPousada: number
  afTransporteCombustivel: number
  afOutros: number
  afPlaca: number
  afValorContrato: number
  afMensalidadeBase: number
  afImpostosVenda: number
  afImpostosLeasing: number
  afInadimplencia: number
  afCustoOperacional: number
  afMesesProjecao: number
  afMargemLiquidaVenda: number
  afMargemLiquidaMinima: number
  afComissaoMinimaPercent: number
  afTaxaDesconto: number
  afAutoMaterialCA: number
  afMaterialCAOverride: number | null
  afProjetoOverride: number | null
  afCreaOverride: number | null
}

export interface AfInputActions {
  setAfModo: (value: AfModo) => void
  setAfConsumoOverride: (value: number) => void
  setAfNumModulosOverride: (value: number | null) => void
  setAfModuloWpOverride: (value: number) => void
  setAfIrradiacaoOverride: (value: number) => void
  setAfPROverride: (value: number) => void
  setAfDiasOverride: (value: number) => void
  setAfUfOverride: (value: AfUfOverride) => void
  setAfCustoKit: (value: number) => void
  setAfCustoKitManual: (value: boolean) => void
  setAfFrete: (value: number) => void
  setAfFreteManual: (value: boolean) => void
  setAfDescarregamento: (value: number) => void
  setAfHotelPousada: (value: number) => void
  setAfTransporteCombustivel: (value: number) => void
  setAfOutros: (value: number) => void
  setAfPlaca: (value: number) => void
  setAfValorContrato: (value: number) => void
  setAfMensalidadeBase: (value: number) => void
  setAfImpostosVenda: (value: number) => void
  setAfImpostosLeasing: (value: number) => void
  setAfInadimplencia: (value: number) => void
  setAfCustoOperacional: (value: number) => void
  setAfMesesProjecao: (value: number) => void
  setAfMargemLiquidaVenda: (value: number) => void
  setAfMargemLiquidaMinima: (value: number) => void
  setAfComissaoMinimaPercent: (value: number) => void
  setAfTaxaDesconto: (value: number) => void
  setAfAutoMaterialCA: (value: number) => void
  setAfMaterialCAOverride: (value: number | null) => void
  setAfProjetoOverride: (value: number | null) => void
  setAfCreaOverride: (value: number | null) => void
  resetAfInputs: () => void
}

export type AfInputStore = AfInputState & AfInputActions

const AF_INPUT_DEFAULTS: AfInputState = {
  afModo: 'venda',
  afConsumoOverride: 0,
  afNumModulosOverride: null,
  afModuloWpOverride: 0,
  afIrradiacaoOverride: 0,
  afPROverride: 0,
  afDiasOverride: 0,
  afUfOverride: '',
  afCustoKit: 0,
  afCustoKitManual: false,
  afFrete: 0,
  afFreteManual: false,
  afDescarregamento: 0,
  afHotelPousada: 0,
  afTransporteCombustivel: 0,
  afOutros: 0,
  afPlaca: 18,
  afValorContrato: 0,
  afMensalidadeBase: 0,
  afImpostosVenda: 6,
  afImpostosLeasing: 4,
  afInadimplencia: 2,
  afCustoOperacional: 3,
  afMesesProjecao: 60,
  afMargemLiquidaVenda: 25,
  afMargemLiquidaMinima: 15,
  afComissaoMinimaPercent: 5,
  afTaxaDesconto: 20,
  afAutoMaterialCA: 0,
  afMaterialCAOverride: null,
  afProjetoOverride: null,
  afCreaOverride: null,
}

export const useAfInputStore = createStore<AfInputStore>((set) => ({
  ...AF_INPUT_DEFAULTS,
  setAfModo: (value) => set({ afModo: value }),
  setAfConsumoOverride: (value) => set({ afConsumoOverride: value }),
  setAfNumModulosOverride: (value) => set({ afNumModulosOverride: value }),
  setAfModuloWpOverride: (value) => set({ afModuloWpOverride: value }),
  setAfIrradiacaoOverride: (value) => set({ afIrradiacaoOverride: value }),
  setAfPROverride: (value) => set({ afPROverride: value }),
  setAfDiasOverride: (value) => set({ afDiasOverride: value }),
  setAfUfOverride: (value) => set({ afUfOverride: value }),
  setAfCustoKit: (value) => set({ afCustoKit: value }),
  setAfCustoKitManual: (value) => set({ afCustoKitManual: value }),
  setAfFrete: (value) => set({ afFrete: value }),
  setAfFreteManual: (value) => set({ afFreteManual: value }),
  setAfDescarregamento: (value) => set({ afDescarregamento: value }),
  setAfHotelPousada: (value) => set({ afHotelPousada: value }),
  setAfTransporteCombustivel: (value) => set({ afTransporteCombustivel: value }),
  setAfOutros: (value) => set({ afOutros: value }),
  setAfPlaca: (value) => set({ afPlaca: value }),
  setAfValorContrato: (value) => set({ afValorContrato: value }),
  setAfMensalidadeBase: (value) => set({ afMensalidadeBase: value }),
  setAfImpostosVenda: (value) => set({ afImpostosVenda: value }),
  setAfImpostosLeasing: (value) => set({ afImpostosLeasing: value }),
  setAfInadimplencia: (value) => set({ afInadimplencia: value }),
  setAfCustoOperacional: (value) => set({ afCustoOperacional: value }),
  setAfMesesProjecao: (value) => set({ afMesesProjecao: value }),
  setAfMargemLiquidaVenda: (value) => set({ afMargemLiquidaVenda: value }),
  setAfMargemLiquidaMinima: (value) => set({ afMargemLiquidaMinima: value }),
  setAfComissaoMinimaPercent: (value) => set({ afComissaoMinimaPercent: value }),
  setAfTaxaDesconto: (value) => set({ afTaxaDesconto: value }),
  setAfAutoMaterialCA: (value) => set({ afAutoMaterialCA: value }),
  setAfMaterialCAOverride: (value) => set({ afMaterialCAOverride: value }),
  setAfProjetoOverride: (value) => set({ afProjetoOverride: value }),
  setAfCreaOverride: (value) => set({ afCreaOverride: value }),
  resetAfInputs: () => set({ ...AF_INPUT_DEFAULTS }),
}))
