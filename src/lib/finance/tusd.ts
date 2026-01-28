import type { TipoBasicoCliente } from '../../types/tipoBasico'

export type TipoClienteTUSD = TipoBasicoCliente

export const DEFAULT_TUSD_ANO_REFERENCIA = 2026

export interface TUSDInput {
  ano: number
  tipoCliente: TipoClienteTUSD
  subTipo?: string | null
  consumoMensal_kWh: number
  tarifaCheia_R_kWh?: number | null
  tusd_R_kWh?: number | null
  pesoTUSD?: number | null
  simultaneidadePadrao?: number | null
}

export interface TUSDSaida {
  fatorAno: number
  simultaneidadeUsada: number
  kWhInstantaneo: number
  kWhCompensado: number
  tusdNaoComp_R_kWh: number
  custoTUSD_Mes_R: number
}

export type SimultaneidadeConfig = {
  [K in TipoClienteTUSD]: Record<string, number>
}

export const SIMULTANEIDADE_PADRAO: SimultaneidadeConfig = {
  residencial: {
    padrao: 0.3,
    ems: 0.45,
    baterias: 0.6,
  },
  comercial: {
    diurno: 0.7,
    refrig_continua: 0.55,
    noturno: 0.4,
  },
  industrial: {
    leve: 0.75,
    media: 0.6,
  },
  cond_vertical: {
    padrao: 0.35,
  },
  cond_horizontal: {
    padrao: 0.35,
  },
  outros: {
    padrao: 0.3,
  },
}

export const PESO_TUSD_PADRAO = 0.27
export const SIMULTANEIDADE_FALLBACK = 0.3

const clampNumero = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  return value
}

const normalizarFracao = (value?: number | null): number | undefined => {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return undefined
  }

  const numero = Number(value)
  if (numero <= 0) {
    return 0
  }

  if (numero > 1) {
    if (numero <= 100) {
      return Math.min(1, numero / 100)
    }
    return 1
  }

  return numero
}

const encontrarValorConfigurado = (config: Record<string, number>, chave: string): number | undefined => {
  const chaveNormalizada = chave.trim().toLowerCase()
  for (const [key, valor] of Object.entries(config)) {
    if (key.trim().toLowerCase() === chaveNormalizada) {
      return valor
    }
  }
  return undefined
}

const resolverSimultaneidade = (
  input: TUSDInput,
  configuracao: SimultaneidadeConfig,
): number => {
  const override = normalizarFracao(input.simultaneidadePadrao)
  if (typeof override === 'number') {
    return override
  }

  const grupo = configuracao[input.tipoCliente]
  if (grupo) {
    const subTipo = typeof input.subTipo === 'string' ? input.subTipo : undefined
    if (subTipo) {
      const encontrado = encontrarValorConfigurado(grupo, subTipo)
      if (typeof encontrado === 'number') {
        return Math.min(Math.max(encontrado, 0), 1)
      }
    }

    const padrao = encontrarValorConfigurado(grupo, 'padrao')
    if (typeof padrao === 'number') {
      return Math.min(Math.max(padrao, 0), 1)
    }

    const primeiro = Object.values(grupo)[0]
    if (typeof primeiro === 'number') {
      return Math.min(Math.max(primeiro, 0), 1)
    }
  }

  return SIMULTANEIDADE_FALLBACK
}

const resolverBaseTUSD = (input: TUSDInput): number => {
  const tusdInformada = clampNumero(Number(input.tusd_R_kWh ?? 0))
  if (tusdInformada > 0) {
    return tusdInformada
  }

  const tarifa = clampNumero(Number(input.tarifaCheia_R_kWh ?? 0))
  if (tarifa <= 0) {
    return 0
  }

  const peso = normalizarFracao(input.pesoTUSD)
  const fator = typeof peso === 'number' ? peso : PESO_TUSD_PADRAO
  return tarifa * fator
}

export const fatorAnoTUSD = (ano: number): number => {
  if (ano === 2025) return 0.45
  if (ano === 2026) return 0.6
  if (ano === 2027) return 0.75
  if (ano === 2028) return 0.9
  return 1
}

export const calcTusdNaoCompensavel = (
  input: TUSDInput,
  configuracao: SimultaneidadeConfig = SIMULTANEIDADE_PADRAO,
): TUSDSaida => {
  const consumoMensal = clampNumero(Number(input.consumoMensal_kWh))
  const simultaneidade = Math.min(
    Math.max(resolverSimultaneidade(input, configuracao), 0),
    1,
  )

  const kWhInstantaneo = consumoMensal * simultaneidade
  const kWhCompensado = consumoMensal * (1 - simultaneidade)

  const baseTUSD = resolverBaseTUSD(input)
  const fatorAno = fatorAnoTUSD(Math.trunc(input.ano))
  const tusdNaoComp_R_kWh = baseTUSD * fatorAno
  const custoTUSD_Mes_R = tusdNaoComp_R_kWh * kWhCompensado

  return {
    fatorAno,
    simultaneidadeUsada: simultaneidade,
    kWhInstantaneo,
    kWhCompensado,
    tusdNaoComp_R_kWh,
    custoTUSD_Mes_R,
  }
}

const resolverAnoReferencia = (ano?: number | null): number => {
  if (!Number.isFinite(ano ?? Number.NaN)) {
    return DEFAULT_TUSD_ANO_REFERENCIA
  }

  const numero = Math.trunc(Number(ano))
  if (numero <= 0) {
    return DEFAULT_TUSD_ANO_REFERENCIA
  }

  return numero
}

const resolverAnoPorMes = (anoBase: number, mes: number): number => {
  if (!Number.isFinite(mes)) {
    return anoBase
  }

  const indice = Math.max(1, Math.trunc(mes)) - 1
  if (indice <= 0) {
    return anoBase
  }

  const anosExtras = Math.floor(indice / 12)
  return anoBase + anosExtras
}

export const calcTusdEncargoMensal = ({
  consumoMensal_kWh,
  tarifaCheia_R_kWh,
  mes,
  anoReferencia,
  tipoCliente,
  subTipo,
  pesoTUSD,
  tusd_R_kWh,
  simultaneidadePadrao,
}: {
  consumoMensal_kWh: number
  tarifaCheia_R_kWh: number
  mes: number
  anoReferencia?: number | null
  tipoCliente?: TipoClienteTUSD | null
  subTipo?: string | null
  pesoTUSD?: number | null
  tusd_R_kWh?: number | null
  simultaneidadePadrao?: number | null
}): number => {
  if (!Number.isFinite(mes) || mes <= 0) {
    return 0
  }

  const anoBase = resolverAnoReferencia(anoReferencia)
  const ano = resolverAnoPorMes(anoBase, mes)
  const input: TUSDInput = {
    ano,
    tipoCliente: tipoCliente ?? 'residencial',
    subTipo: subTipo ?? null,
    consumoMensal_kWh,
    tarifaCheia_R_kWh,
    tusd_R_kWh: tusd_R_kWh ?? null,
    pesoTUSD: pesoTUSD ?? null,
    simultaneidadePadrao: simultaneidadePadrao ?? null,
  }

  return calcTusdNaoCompensavel(input).custoTUSD_Mes_R
}
