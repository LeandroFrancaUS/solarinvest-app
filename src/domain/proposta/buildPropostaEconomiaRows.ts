export type PropostaEconomiaRow = {
  anoIndex: number
  tarifaCheia: number
  tarifaComDesconto: number
  mensalidadeSolarInvest: number
  faturaDistribuidora: number | null
  encargosDistribuidora: number
  consumoKwhMes: number | null
  encargosEstimados: boolean
  despesaMensalEstimada: number
}

export type BuildPropostaEconomiaRowsInput = {
  prazoContratualTotalAnos: number
  tarifaCheiaBase: number
  descontoFracao: number
  inflacaoEnergiaFracao: number
  energiaContratadaKwh: number | null | undefined
  taxaMinimaMensal: number
  tusdMedioPorAno: Record<number, number>
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100

const getConsumoKwhMes = (energiaContratadaKwh: number | null | undefined): number | null => {
  if (!Number.isFinite(energiaContratadaKwh)) {
    return null
  }
  return Math.max(0, energiaContratadaKwh ?? 0)
}

const calcularFaturaDistribuidora = (
  consumoKwhMes: number | null,
  tarifaCheiaAno: number,
  encargosDistribuidora: number,
): number | null => {
  if (!Number.isFinite(tarifaCheiaAno) || tarifaCheiaAno <= 0) {
    return null
  }
  if (consumoKwhMes == null) {
    return null
  }
  return roundMoney(consumoKwhMes * tarifaCheiaAno + encargosDistribuidora)
}

export const buildEconomiaRows = (
  input: BuildPropostaEconomiaRowsInput,
): PropostaEconomiaRow[] => {
  const consumoKwhMes = getConsumoKwhMes(input.energiaContratadaKwh)
  const energiaContratadaBase = consumoKwhMes ?? 0
  const anosConsiderados = Array.from({ length: input.prazoContratualTotalAnos }, (_, index) => index + 1)

  const linhas: PropostaEconomiaRow[] = anosConsiderados.map((ano) => {
    const fator = Math.pow(1 + Math.max(-0.99, input.inflacaoEnergiaFracao), Math.max(0, ano - 1))
    const tarifaAno = input.tarifaCheiaBase * fator
    const tarifaComDesconto = tarifaAno * (1 - input.descontoFracao)
    const tusdMedio = input.tusdMedioPorAno[ano]
    const encargosDistribuidora = Number.isFinite(tusdMedio) ? Math.max(0, tusdMedio ?? 0) : 0
    const encargosEstimados = !Number.isFinite(tusdMedio)
    const mensalidadeSolarInvest = energiaContratadaBase * tarifaComDesconto + input.taxaMinimaMensal
    const faturaDistribuidora = calcularFaturaDistribuidora(consumoKwhMes, tarifaAno, encargosDistribuidora)
    const despesaMensalEstimada = mensalidadeSolarInvest + encargosDistribuidora

    return {
      anoIndex: ano,
      tarifaCheia: tarifaAno,
      tarifaComDesconto,
      mensalidadeSolarInvest,
      faturaDistribuidora,
      encargosDistribuidora,
      consumoKwhMes,
      encargosEstimados,
      despesaMensalEstimada,
    }
  })

  const anosTusdOrdenados = Object.keys(input.tusdMedioPorAno)
    .map((chave) => Number(chave))
    .filter((valor) => Number.isFinite(valor) && valor > 0)
    .sort((a, b) => a - b)

  let tusdPosContrato = 0
  for (let index = anosTusdOrdenados.length - 1; index >= 0; index -= 1) {
    const ano = anosTusdOrdenados[index]
    if (ano <= input.prazoContratualTotalAnos) {
      const valorTusd = input.tusdMedioPorAno[ano]
      if (Number.isFinite(valorTusd)) {
        tusdPosContrato = Math.max(0, valorTusd ?? 0)
        break
      }
    }
  }

  const anoPosContrato = input.prazoContratualTotalAnos + 1
  const fatorPosContrato = Math.pow(
    1 + Math.max(-0.99, input.inflacaoEnergiaFracao),
    Math.max(0, anoPosContrato - 1),
  )
  const tarifaAnoPosContrato = input.tarifaCheiaBase * fatorPosContrato
  const encargosDistribuidoraPosContrato = Math.max(0, tusdPosContrato + input.taxaMinimaMensal)
  const encargosEstimadosPosContrato = anosTusdOrdenados.length === 0
  const faturaDistribuidoraPosContrato = calcularFaturaDistribuidora(
    consumoKwhMes,
    tarifaAnoPosContrato,
    encargosDistribuidoraPosContrato,
  )

  linhas.push({
    anoIndex: anoPosContrato,
    tarifaCheia: tarifaAnoPosContrato,
    tarifaComDesconto: tarifaAnoPosContrato,
    encargosDistribuidora: encargosDistribuidoraPosContrato,
    mensalidadeSolarInvest: 0,
    faturaDistribuidora: faturaDistribuidoraPosContrato,
    consumoKwhMes,
    encargosEstimados: encargosEstimadosPosContrato,
    despesaMensalEstimada: encargosDistribuidoraPosContrato,
  })

  return linhas
}
