import type { MultiUcClasse, MultiUcTarifa } from '../types/multiUc'

export const ESCALONAMENTO_PADRAO: Record<number, number> = {
  2023: 15,
  2024: 30,
  2025: 45,
  2026: 60,
  2027: 75,
  2028: 90,
  2029: 100,
}

export type MultiUcParametrosMLGD = {
  anoVigencia: number
  escalonamentoPadrao?: Record<number, number>
  overrideEscalonamento: boolean
  escalonamentoCustomPercent?: number | null
}

export type MultiUcCalculoUc = {
  id: string
  classe: MultiUcClasse
  consumoKWh: number
  rateioPercentual: number
  manualRateioKWh?: number | null
  tarifas: MultiUcTarifa
  observacoes?: string | null
}

export type MultiUcCalculoInput = {
  energiaGeradaTotalKWh: number
  distribuicaoPorPercentual: boolean
  ucs: MultiUcCalculoUc[]
  parametrosMLGD: MultiUcParametrosMLGD
}

export type MultiUcCalculoUcResultado = MultiUcCalculoUc & {
  creditosKWh: number
  kWhFaturados: number
  kWhCompensados: number
  tusdOutros: number
  tusdNaoCompensavel: number
  tusdNaoCompensada: number
  tusdMensal: number
  teMensal: number
  totalMensal: number
}

export type MultiUcCalculoResultado = {
  escalonamentoPercentual: number
  ucs: MultiUcCalculoUcResultado[]
  totalTusd: number
  totalTe: number
  totalContrato: number
  energiaGeradaTotalKWh: number
  energiaGeradaUtilizadaKWh: number
  sobraCreditosKWh: number
  warnings: string[]
  errors: string[]
}

const clampNumero = (valor: unknown): number => {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return valor
  }
  if (typeof valor === 'string' && valor.trim() !== '') {
    const parsed = Number(valor)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const normalizarTarifa = (tarifa: MultiUcTarifa): MultiUcTarifa => ({
  TE: Math.max(0, clampNumero(tarifa.TE)),
  TUSD_total: Math.max(0, clampNumero(tarifa.TUSD_total)),
  TUSD_FioB: Math.max(0, clampNumero(tarifa.TUSD_FioB)),
})

const calcularEscalonamentoPercentual = ({
  anoVigencia,
  escalonamentoPadrao,
  overrideEscalonamento,
  escalonamentoCustomPercent,
}: MultiUcParametrosMLGD): number => {
  if (overrideEscalonamento && escalonamentoCustomPercent != null) {
    return Math.max(0, escalonamentoCustomPercent) / 100
  }
  const tabela = escalonamentoPadrao ?? ESCALONAMENTO_PADRAO
  const percentual = tabela[anoVigencia] ?? 0
  return Math.max(0, percentual) / 100
}

export const calcularMultiUc = ({
  energiaGeradaTotalKWh,
  distribuicaoPorPercentual,
  ucs,
  parametrosMLGD,
}: MultiUcCalculoInput): MultiUcCalculoResultado => {
  const warnings: string[] = []
  const errors: string[] = []

  const energiaGerada = Math.max(0, clampNumero(energiaGeradaTotalKWh))
  const escalonamentoPercentual = calcularEscalonamentoPercentual(parametrosMLGD)

  const linhas: MultiUcCalculoUcResultado[] = []

  const percentuais = ucs.map((uc) => Math.max(0, clampNumero(uc.rateioPercentual)))
  const somaPercent = percentuais.reduce((acc, valor) => acc + valor, 0)
  const somaManual = ucs.reduce(
    (acc, uc) => acc + Math.max(0, clampNumero(uc.manualRateioKWh ?? 0)),
    0,
  )

  if (distribuicaoPorPercentual) {
    if (energiaGerada > 0 && Math.abs(somaPercent - 100) > 0.001) {
      errors.push('A soma dos percentuais de rateio deve totalizar 100%.')
    }
    if (energiaGerada > 0 && somaPercent === 0) {
      warnings.push('Todos os percentuais de rateio estão zerados. Nenhum crédito será distribuído.')
    }
  } else if (energiaGerada > 0 && Math.abs(somaManual - energiaGerada) > 0.001) {
    errors.push('A soma do rateio manual em kWh deve ser igual à energia gerada total.')
  }

  let totalTusd = 0
  let totalTe = 0
  let energiaCompensadaTotal = 0
  let energiaDistribuida = 0

  ucs.forEach((uc, index) => {
    const consumo = Math.max(0, clampNumero(uc.consumoKWh))
    const tarifa = normalizarTarifa(uc.tarifas)
    const rateioPercentual = Math.max(0, percentuais[index])
    const rateioManualKWh = Math.max(0, clampNumero(uc.manualRateioKWh ?? 0))

    let creditosKWh: number
    if (distribuicaoPorPercentual) {
      creditosKWh = energiaGerada * (rateioPercentual / 100)
    } else {
      creditosKWh = rateioManualKWh
    }

    const tusdOutros = Math.max(0, tarifa.TUSD_total - tarifa.TUSD_FioB)
    if (tarifa.TUSD_FioB > tarifa.TUSD_total + 1e-6) {
      warnings.push(
        `UC ${uc.id}: TUSD Fio B maior que a TUSD total. Ajustamos o componente "outros" para zero.`,
      )
    }

    if (tarifa.TE === 0 || tarifa.TUSD_total === 0 || tarifa.TUSD_FioB === 0) {
      warnings.push(`UC ${uc.id}: tarifas incompletas. Verifique TE e TUSD informados.`)
    }

    const kWhCompensados = Math.min(consumo, creditosKWh)
    const kWhFaturados = Math.max(consumo - creditosKWh, 0)
    const tusdNaoCompensavel = kWhCompensados * tarifa.TUSD_FioB * escalonamentoPercentual
    const tusdNaoCompensada = kWhFaturados * tarifa.TUSD_total
    const tusdMensal = tusdNaoCompensavel + tusdNaoCompensada
    const teMensal = kWhFaturados * tarifa.TE
    const totalMensal = tusdMensal + teMensal

    energiaDistribuida += creditosKWh
    energiaCompensadaTotal += kWhCompensados
    totalTusd += tusdMensal
    totalTe += teMensal

    linhas.push({
      ...uc,
      tarifas: tarifa,
      rateioPercentual,
      manualRateioKWh: distribuicaoPorPercentual ? null : rateioManualKWh,
      creditosKWh,
      kWhFaturados,
      kWhCompensados,
      tusdOutros,
      tusdNaoCompensavel,
      tusdNaoCompensada,
      tusdMensal,
      teMensal,
      totalMensal,
    })
  })

  if (
    !distribuicaoPorPercentual &&
    energiaGerada > 0 &&
    Math.abs(energiaDistribuida - energiaGerada) > 0.001
  ) {
    warnings.push(
      `Rateio manual distribuiu ${energiaDistribuida.toFixed(2)} kWh, diferente da geração total de ${energiaGerada.toFixed(
        2,
      )} kWh.`,
    )
  }

  const sobraCreditos = Math.max(0, energiaGerada - energiaCompensadaTotal)
  if (sobraCreditos > 0.001) {
    warnings.push(
      `Há ${sobraCreditos.toFixed(2)} kWh de créditos não compensados. Considere ajustar o rateio ou adicionar novas UCs.`,
    )
  }

  return {
    escalonamentoPercentual,
    ucs: linhas,
    totalTusd,
    totalTe,
    totalContrato: totalTusd + totalTe,
    energiaGeradaTotalKWh: energiaGerada,
    energiaGeradaUtilizadaKWh: energiaCompensadaTotal,
    sobraCreditosKWh: sobraCreditos,
    warnings,
    errors,
  }
}
