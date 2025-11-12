import React, { useMemo } from 'react'

import './styles/print-common.css'
import './styles/proposal-leasing.css'
import { currency, formatCpfCnpj, tarifaCurrency } from '../../utils/formatters'
import {
  formatMoneyBR,
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
} from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'
import PrintableProposalImages from './PrintableProposalImages'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'
import { agrupar, type Linha } from '../../lib/pdf/grouping'
import { anosAlvoEconomia } from '../../lib/finance/years'
import { calcularEconomiaAcumuladaPorAnos } from '../../lib/finance/economia'

const BUDGET_ITEM_EXCLUSION_PATTERNS: RegExp[] = [
  /@/i,
  /\bemail\b/i,
  /brsolarinvest/i,
  /\btelefone\b/i,
  /\bwhatsapp\b/i,
  /\bcnpj\b/i,
  /\bcpf\b/i,
  /\brg\b/i,
  /\bdados do cliente\b/i,
  /\bcliente\b/i,
  /^or[cç]amento\b/i,
  /\bendere[cç]o\b/i,
  /\bbairro\b/i,
  /\bcidade\b/i,
  /\bestado\b/i,
  /\bcep\b/i,
  /\bc[óo]digo do or[cç]amento\b/i,
  /portf[óo]lio/i,
  /sobre\s+n[óo]s/i,
  /proposta comercial/i,
  /contato/i,
  /\baceite da proposta\b/i,
  /\bassinatura\b/i,
  /\bdocumento\b/i,
  /\bru[áa]/i,
  /\bjardim/i,
  /\betapa/i,
  /an[áa]polis/i,
  /\bdistribuidora\b/i,
  /\buc\b/i,
  /vamos avan[çc]ar/i,
  /valor\s+total/i,
  /cot[aã][cç][aã]o\b/i,
  /entrega\s+escolhida/i,
  /transportadora/i,
  /condi[cç][aã]o\s+de\s+pagamento/i,
  /pot[êe]ncia\s+do\s+sistema/i,
]

const INFORMACOES_IMPORTANTES_TEXTO_REMOVIDO =
  'Valores estimativos; confirmação no contrato definitivo.'

const formatAnosDetalhado = (valor: number): string => {
  const fractionDigits = Number.isInteger(valor) ? 0 : 1
  const numero = formatNumberBRWithOptions(valor, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  const singular = Math.abs(valor - 1) < 1e-6
  return `${numero} ${singular ? 'ano' : 'anos'}`
}

const formatPrazoContratual = (meses: number): string => {
  if (!Number.isFinite(meses) || meses <= 0) {
    return '—'
  }

  const mesesTexto = formatNumberBRWithOptions(meses, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const anos = meses / 12
  const anosTexto = anos >= 1 ? formatNumberBRWithOptions(anos, { maximumFractionDigits: 1 }) : null
  const anosLabel = anosTexto ? ` (${anosTexto} anos de economia garantida)` : ''

  return `${mesesTexto} meses${anosLabel}`
}

const toDisplayPercent = (value?: number, fractionDigits = 1) => {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return formatPercentBRWithDigits((value ?? 0) / 100, fractionDigits)
}

const sanitizeItemText = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.replace(/\s+/g, ' ')
}

const sanitizeTextField = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const stripDiacritics = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

const hasBudgetItemExclusion = (value: string): boolean => {
  if (!value) {
    return false
  }
  const normalized = stripDiacritics(value)
  return BUDGET_ITEM_EXCLUSION_PATTERNS.some((pattern) => pattern.test(value) || pattern.test(normalized))
}

const formatKwhMes = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  return `${formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} kWh/mês`
}

const formatKwp = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  return `${formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kWp`
}

const formatWp = (value?: number) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  return `${formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} Wp`
}

const formatTipoSistema = (value?: PrintableProposalProps['tipoSistema']) => {
  switch (value) {
    case 'ON_GRID':
      return 'On-grid'
    case 'OFF_GRID':
      return 'Off-grid'
    case 'HIBRIDO':
      return 'Híbrido'
    default:
      return '—'
  }
}

function PrintableProposalLeasingInner(
  props: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    cliente,
    budgetId,
    descontoContratualPct,
    tarifaCheia,
    energiaContratadaKwh,
    geracaoMensalKwh,
    numeroModulos,
    potenciaModulo,
    potenciaInstaladaKwp,
    tipoInstalacao,
    tipoSistema,
    areaInstalacao,
    buyoutResumo,
    anos,
    leasingROI,
    parcelasLeasing,
    distribuidoraTarifa,
    leasingDataInicioOperacao,
    leasingValorInstalacaoCliente,
    leasingValorDeMercadoEstimado,
    leasingPrazoContratualMeses,
    leasingInflacaoEnergiaAa,
    leasingModeloInversor,
    leasingModeloModulo,
    orcamentoItens,
    informacoesImportantesObservacao,
    configuracaoUsinaObservacoes,
    imagensInstalacao,
    multiUcResumo,
    vendaSnapshot,
    vendasConfigSnapshot,
    ucGeradora,
    ucsBeneficiarias,
  } = props

  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : null
  const telefoneCliente = cliente.telefone?.trim() || null
  const emailCliente = cliente.email?.trim() || null
  const enderecoCliente = cliente.endereco?.trim() || null
  const cidadeCliente = cliente.cidade?.trim() || null
  const ufCliente = cliente.uf?.trim() || null
  const codigoOrcamento = budgetId?.trim() || null
  const nomeCliente = cliente.nome?.trim() || null
  const ucCliente = cliente.uc?.trim() || null
  const distribuidoraLabel = distribuidoraTarifa?.trim() || cliente.distribuidora?.trim() || null

  const formatClienteEnderecoCompleto = () => {
    const endereco = cliente.endereco?.trim() || ''
    const cidade = cliente.cidade?.trim() || ''
    const uf = cliente.uf?.trim() || ''
    const cep = cliente.cep?.trim() || ''
    const partes: string[] = []
    if (endereco) {
      partes.push(endereco)
    }
    if (cidade || uf) {
      partes.push([cidade, uf].filter(Boolean).join(' / '))
    }
    if (cep) {
      partes.push(`CEP ${cep}`)
    }
    return partes.filter(Boolean).join(' • ')
  }

  const ucGeradoraNumero = ucGeradora?.numero?.trim() || ucCliente || ''
  const ucGeradoraEndereco = ucGeradora?.endereco?.trim() || formatClienteEnderecoCompleto()

  const ucsBeneficiariasLista = useMemo(() => {
    if (!Array.isArray(ucsBeneficiarias)) {
      return [] as { numero: string; endereco: string; rateioPercentual: number | null }[]
    }
    return ucsBeneficiarias
      .map((item) => {
        const numero = item?.numero?.trim() || ''
        const endereco = item?.endereco?.trim() || ''
        const rateio =
          item?.rateioPercentual != null && Number.isFinite(item.rateioPercentual)
            ? Number(item.rateioPercentual)
            : null
        if (!numero && !endereco && rateio == null) {
          return null
        }
        return { numero, endereco, rateioPercentual: rateio }
      })
      .filter((item): item is { numero: string; endereco: string; rateioPercentual: number | null } =>
        Boolean(item),
      )
  }, [ucsBeneficiarias])

  const formatRateioLabel = (valor: number | null) => {
    if (valor == null || !Number.isFinite(valor)) {
      return null
    }
    const numero = Number(valor)
    const texto = formatNumberBRWithOptions(numero, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(numero) ? 0 : 2,
    })
    return `${texto}%`
  }

  const ucGeradoraNumeroLabel = ucGeradoraNumero || '—'
  const ucGeradoraEnderecoLabel = ucGeradoraEndereco || '—'
  const hasBeneficiarias = ucsBeneficiariasLista.length > 0

  const prazoContratual = useMemo(() => {
    if (Number.isFinite(leasingPrazoContratualMeses) && (leasingPrazoContratualMeses ?? 0) > 0) {
      return Math.max(0, Math.floor(leasingPrazoContratualMeses ?? 0))
    }
    if (parcelasLeasing.length > 0) {
      const ultimo = parcelasLeasing[parcelasLeasing.length - 1]
      if (Number.isFinite(ultimo?.mes)) {
        return Math.max(0, Math.floor(ultimo.mes))
      }
    }
    return 0
  }, [leasingPrazoContratualMeses, parcelasLeasing])

  const inflacaoEnergiaFracao = useMemo(() => {
    const base = Number.isFinite(leasingInflacaoEnergiaAa)
      ? leasingInflacaoEnergiaAa ?? 0
      : buyoutResumo?.infEnergia ?? 0
    return (base ?? 0) / 100
  }, [buyoutResumo?.infEnergia, leasingInflacaoEnergiaAa])

  const descontoFracao = Number.isFinite(descontoContratualPct) ? (descontoContratualPct ?? 0) / 100 : 0
  const tarifaCheiaBase = Number.isFinite(tarifaCheia) ? Math.max(0, tarifaCheia ?? 0) : 0
  const energiaContratadaBase = Number.isFinite(energiaContratadaKwh) ? Math.max(0, energiaContratadaKwh ?? 0) : 0
  const valorInstalacaoCliente = Number.isFinite(leasingValorInstalacaoCliente)
    ? Math.max(0, leasingValorInstalacaoCliente ?? 0)
    : 0
  const inicioOperacaoTexto = leasingDataInicioOperacao?.trim() || null

  const multiUcResumoDados = multiUcResumo && multiUcResumo.ucs.length > 0 ? multiUcResumo : null
  const multiUcEscalonamentoTexto = multiUcResumoDados
    ? formatPercentBRWithDigits(multiUcResumoDados.escalonamentoPercentual, 0)
    : null
  const multiUcRateioDescricao = multiUcResumoDados
    ? multiUcResumoDados.distribuicaoPorPercentual
      ? 'Percentual (%) informado por UC'
      : 'Manual (kWh) informado por UC'
    : null

  const taxaMinimaMensal = (() => {
    const valor = vendaSnapshot?.parametros?.taxa_minima_rs_mes
    return Number.isFinite(valor) ? Math.max(0, valor ?? 0) : 0
  })()

  const formatKwhValor = (valor: number, fractionDigits = 2): string =>
    `${formatNumberBRWithOptions(valor, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })} kWh`

  const resumoCampos: ClientInfoField[] = [
    { label: 'Cliente', value: nomeCliente || '—' },
    { label: 'Documento', value: documentoCliente || '—' },
    { label: 'UC', value: ucCliente || '—' },
    { label: 'Distribuidora', value: distribuidoraLabel || '—' },
    { label: 'E-mail', value: emailCliente || '—' },
    { label: 'Telefone', value: telefoneCliente || '—' },
    {
      label: 'Cidade / UF',
      value:
        cidadeCliente || ufCliente ? `${cidadeCliente || '—'} / ${ufCliente || '—'}` : '—',
    },
    {
      label: 'Endereço',
      value:
        enderecoCliente
          ? enderecoCliente
          : cidadeCliente || ufCliente
          ? `${cidadeCliente || '—'} / ${ufCliente || '—'}`
          : '—',
      wide: true,
    },
  ]

  const snapshotPagamento = vendaSnapshot?.pagamento ?? null
  const validadePropostaDiasPadrao = Number.isFinite(vendasConfigSnapshot?.validade_proposta_dias)
    ? Math.max(0, Number(vendasConfigSnapshot?.validade_proposta_dias ?? 0))
    : null
  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  if ((validadePropostaDiasPadrao ?? 0) > 0) {
    validadeData.setDate(validadeData.getDate() + (validadePropostaDiasPadrao ?? 0))
  }
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const validadeResumoPadrao = (() => {
    if (validadePropostaDiasPadrao == null || validadePropostaDiasPadrao <= 0) {
      return `Até ${validadeTexto}`
    }
    const plural = validadePropostaDiasPadrao === 1 ? 'dia' : 'dias'
    return `${validadePropostaDiasPadrao} ${plural} · Até ${validadeTexto}`
  })()
  const validadeResumoTexto =
    sanitizeTextField(snapshotPagamento?.validade_proposta_txt) ?? validadeResumoPadrao

  const resumoProposta = [
    {
      label: 'Modalidade de contratação',
      value: 'Leasing SolarInvest - Sem custo para o cliente',
    },
    {
      label: 'Prazo de validade da proposta',
      value: validadeResumoTexto,
    },
    {
      label: 'Início estimado da operação',
      value: inicioOperacaoTexto
        ? `${inicioOperacaoTexto} · Até 60 dias após assinatura do contrato`
        : 'Até 60 dias após assinatura do contrato',
    },
    {
      label: 'Tipo de instalação',
      value: tipoInstalacao === 'SOLO' ? 'Solo' : 'Telhado',
    },
    {
      label: 'Distribuidora atendida',
      value: distribuidoraLabel || '—',
    },
    {
      label: 'Responsabilidades da SolarInvest',
      value:
        'Operação, manutenção, suporte técnico, limpeza e seguro integral da usina durante o contrato.',
    },
  ]

  const modelosCatalogo = useMemo(() => {
    if (!orcamentoItens || orcamentoItens.length === 0) {
      return { modeloModulo: null, modeloInversor: null }
    }

    const linhas: Linha[] = []

    orcamentoItens.forEach((item) => {
      const produto = sanitizeItemText(item.produto)
      const descricao = sanitizeItemText(item.descricao)
      const combinedText = [produto, descricao].filter(Boolean).join(' ')

      if (!combinedText || hasBudgetItemExclusion(combinedText)) {
        return
      }

      const quantidade = Number.isFinite(item.quantidade) ? Number(item.quantidade) : null
      const codigo = sanitizeItemText(item.codigo)
      const modelo = sanitizeItemText(item.modelo)
      const fabricante = sanitizeItemText(item.fabricante)

      linhas.push({
        nome: produto ?? descricao ?? combinedText,
        codigo: codigo ?? undefined,
        modelo: modelo ?? undefined,
        fabricante: fabricante ?? undefined,
        quantidade,
      })
    })

    if (linhas.length === 0) {
      return { modeloModulo: null, modeloInversor: null }
    }

    const agrupado = agrupar(linhas)

    const formatModelo = (linha: Linha | undefined): string | null => {
      if (!linha) {
        return null
      }

      const modelo = sanitizeItemText(linha.modelo)
      const fabricante = sanitizeItemText(linha.fabricante)
      if (modelo && fabricante) {
        return `${fabricante} · ${modelo}`
      }

      return modelo || fabricante || sanitizeItemText(linha.nome) || null
    }

    return {
      modeloModulo: formatModelo(agrupado.Hardware.Modulos[0]),
      modeloInversor: formatModelo(agrupado.Hardware.Inversores[0]),
    }
  }, [orcamentoItens])

  const modeloModuloManual = sanitizeItemText(leasingModeloModulo)
  const modeloInversorManual = sanitizeItemText(leasingModeloInversor)
  const modeloModuloSnapshot = sanitizeItemText(vendaSnapshot?.configuracao?.modelo_modulo)
  const modeloInversorSnapshot = sanitizeItemText(vendaSnapshot?.configuracao?.modelo_inversor)
  const modeloModulo = modeloModuloManual ?? modeloModuloSnapshot ?? modelosCatalogo.modeloModulo
  const modeloInversor = modeloInversorManual ?? modeloInversorSnapshot ?? modelosCatalogo.modeloInversor

  const especificacoesUsina = [
    {
      label: 'Tipo de Sistema',
      value: formatTipoSistema(tipoSistema),
    },
    {
      label: 'Potência instalada (kWp)',
      value: formatKwp(potenciaInstaladaKwp),
    },
    {
      label: 'Modelo do inversor',
      value: modeloInversor ?? '—',
    },
    {
      label: 'Modelo dos módulos',
      value: modeloModulo ?? '—',
    },
    {
      label: 'Potência do Módulos (Wp)',
      value: formatWp(potenciaModulo),
    },
    {
      label: 'Número de módulos',
      value:
        Number.isFinite(numeroModulos) && (numeroModulos ?? 0) > 0
          ? formatNumberBRWithOptions(numeroModulos ?? 0, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })
          : '—',
    },
    {
      label: 'Energia contratada (kWh/mês)',
      value: formatKwhMes(energiaContratadaKwh),
    },
    {
      label: 'Geração estimada (kWh/mês)',
      value: formatKwhMes(geracaoMensalKwh),
    },
    {
      label: 'Área útil necessária (m²)',
      value:
        Number.isFinite(areaInstalacao) && (areaInstalacao ?? 0) > 0
          ? `${formatNumberBRWithOptions(areaInstalacao ?? 0, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })} m²`
          : '—',
    },
  ]

  const tarifaInicialProjetada = tarifaCheiaBase > 0 ? tarifaCheiaBase * (1 - descontoFracao) : 0

  const tusdMedioPorAno = useMemo<Record<number, number>>(() => {
    if (!Array.isArray(parcelasLeasing) || parcelasLeasing.length === 0) {
      return {}
    }

    const acumulado: Record<number, { soma: number; quantidade: number }> = {}

    parcelasLeasing.forEach((parcela) => {
      const mes = Number.isFinite(parcela?.mes) ? Math.max(1, Math.floor(parcela.mes)) : NaN
      if (!Number.isFinite(mes)) {
        return
      }

      const ano = Math.ceil(mes / 12)
      if (!Number.isFinite(ano) || ano <= 0) {
        return
      }

      const tusd = Number.isFinite(parcela?.tusd) ? Math.max(0, parcela.tusd) : 0
      const grupo = acumulado[ano] ?? { soma: 0, quantidade: 0 }
      grupo.soma += tusd
      grupo.quantidade += 1
      acumulado[ano] = grupo
    })

    return Object.keys(acumulado).reduce<Record<number, number>>((acc, chave) => {
      const ano = Number(chave)
      const { soma, quantidade } = acumulado[ano]
      acc[ano] = quantidade > 0 ? soma / quantidade : 0
      return acc
    }, {})
  }, [parcelasLeasing])

  const condicoesFinanceiras = [
    {
      label: 'Investimento no sistema fotovoltaico',
      value: 'Investimento 100% feito pela SolarInvest',
    },
    {
      label: 'Investimento do cliente',
      value: currency(valorInstalacaoCliente),
    },
    {
      label: 'Tarifa cheia da distribuidora (R$/kWh)',
      value: tarifaCheiaBase > 0 ? tarifaCurrency(tarifaCheiaBase) : '—',
    },
    {
      label: 'Tarifa inicial SolarInvest (R$/kWh)',
      value: tarifaInicialProjetada > 0 ? tarifaCurrency(tarifaInicialProjetada) : '—',
    },
    {
      label: 'Desconto contratual',
      value: toDisplayPercent(descontoContratualPct),
    },
    {
      label: 'Prazo contratual',
      value: formatPrazoContratual(prazoContratual),
    },
  ]

  const prazoContratualTotalAnos = useMemo(() => {
    if (prazoContratual > 0) {
      return Math.max(1, Math.ceil(prazoContratual / 12))
    }
    return 5
  }, [prazoContratual])

  const mensalidadesPorAno = useMemo(() => {
    const anosConsiderados = Array.from({ length: prazoContratualTotalAnos }, (_, index) => index + 1)

    const linhas = anosConsiderados.map((ano) => {
      const fator = Math.pow(1 + Math.max(-0.99, inflacaoEnergiaFracao), Math.max(0, ano - 1))
      const tarifaAno = tarifaCheiaBase * fator
      const tarifaComDesconto = tarifaAno * (1 - descontoFracao)
      const tusdMedio = tusdMedioPorAno[ano] ?? 0
      const mensalidade = energiaContratadaBase * tarifaComDesconto + tusdMedio
      const contaDistribuidora = energiaContratadaBase * tarifaAno
      return {
        ano,
        tarifaCheiaAno: tarifaAno,
        tarifaComDesconto,
        contaDistribuidora,
        mensalidade,
      }
    })

    const anosTusdOrdenados = Object.keys(tusdMedioPorAno)
      .map((chave) => Number(chave))
      .filter((valor) => Number.isFinite(valor) && valor > 0)
      .sort((a, b) => a - b)

    let tusdPosContrato = 0
    for (let index = anosTusdOrdenados.length - 1; index >= 0; index -= 1) {
      const ano = anosTusdOrdenados[index]
      if (ano <= prazoContratualTotalAnos) {
        const valorTusd = tusdMedioPorAno[ano]
        if (Number.isFinite(valorTusd)) {
          tusdPosContrato = Math.max(0, valorTusd ?? 0)
          break
        }
      }
    }

    const anoPosContrato = prazoContratualTotalAnos + 1
    const fatorPosContrato = Math.pow(1 + Math.max(-0.99, inflacaoEnergiaFracao), Math.max(0, anoPosContrato - 1))
    const tarifaAnoPosContrato = tarifaCheiaBase * fatorPosContrato
    const contaDistribuidoraPosContrato = Math.max(0, tusdPosContrato + taxaMinimaMensal)

    linhas.push({
      ano: anoPosContrato,
      tarifaCheiaAno: tarifaAnoPosContrato,
      tarifaComDesconto: tarifaAnoPosContrato,
      contaDistribuidora: contaDistribuidoraPosContrato,
      mensalidade: 0,
    })

    return linhas
  }, [
    descontoFracao,
    energiaContratadaBase,
    inflacaoEnergiaFracao,
    prazoContratualTotalAnos,
    taxaMinimaMensal,
    tusdMedioPorAno,
    tarifaCheiaBase,
  ])

  const prazoEconomiaMeses = prazoContratual > 0 ? prazoContratual : 60

  const economiaMarcos = useMemo(() => {
    const alvos = anosAlvoEconomia(prazoEconomiaMeses)

    if (anos.length === 0) {
      return alvos
    }

    const anosDisponiveis = new Set(anos)
    const filtrados = alvos.filter((ano) => anosDisponiveis.has(ano))

    return filtrados.length > 0 ? filtrados : alvos
  }, [anos, prazoEconomiaMeses])

  const economiaProjetada = useMemo(() => {
    const serie = calcularEconomiaAcumuladaPorAnos(
      economiaMarcos,
      (ano) => leasingROI[ano - 1] ?? 0,
    )

    return serie.map((row, index) => {
      const acumuladoAnterior = index > 0 ? serie[index - 1].economiaAcumulada : 0
      return {
        ano: row.ano,
        acumulado: row.economiaAcumulada,
        economiaAnual: row.economiaAcumulada - acumuladoAnterior,
      }
    })
  }, [economiaMarcos, leasingROI])

  const prazoContratualAnos = useMemo(() => (prazoContratual > 0 ? prazoContratual / 12 : 0), [prazoContratual])
  const valorMercadoUsina = useMemo(
    () =>
      Number.isFinite(leasingValorDeMercadoEstimado)
        ? Math.max(0, leasingValorDeMercadoEstimado ?? 0)
        : 0,
    [leasingValorDeMercadoEstimado],
  )

  const economiaProjetadaGrafico = useMemo(() => {
    if (!Array.isArray(leasingROI) || leasingROI.length === 0) {
      return []
    }

    const totalAnos = leasingROI.length
    const obterBeneficioPorAno = (ano: number): number => {
      if (!Number.isFinite(ano) || ano <= 0) {
        return 0
      }

      const indice = Math.min(totalAnos, Math.max(1, Math.ceil(ano))) - 1
      return leasingROI[indice] ?? 0
    }

    const destinos: Array<{ ano: number; tipo: 'prazo' | 'posPrazo' | 'marco' }> = []

    if (prazoContratualAnos > 0) {
      destinos.push({ ano: prazoContratualAnos, tipo: 'prazo' })
      destinos.push({ ano: prazoContratualAnos + 1, tipo: 'posPrazo' })
    }

    destinos.push(
      { ano: 10, tipo: 'marco' },
      { ano: 15, tipo: 'marco' },
      { ano: 20, tipo: 'marco' },
      { ano: 30, tipo: 'marco' },
    )

    const vistos = new Set<number>()

    return destinos.reduce<{ ano: number; label: string; acumulado: number }[]>((acc, destino) => {
      const { ano, tipo } = destino
      if (!Number.isFinite(ano) || ano <= 0) {
        return acc
      }

      const chave = Number(ano.toFixed(4))
      if (vistos.has(chave)) {
        return acc
      }

      vistos.add(chave)

      const beneficioBase = obterBeneficioPorAno(ano)
      const deveAdicionarUsina = valorMercadoUsina > 0 && prazoContratualAnos > 0 && ano >= prazoContratualAnos
      const beneficioTotal = deveAdicionarUsina ? beneficioBase + valorMercadoUsina : beneficioBase

      let label = formatAnosDetalhado(ano)

      if (tipo === 'prazo') {
        label = `${label} (prazo do leasing)`
      } else if (tipo === 'posPrazo') {
        label = `${label} (após o prazo)`
      }

      acc.push({ ano, label, acumulado: Math.max(0, beneficioTotal) })
      return acc
    }, [])
  }, [leasingROI, prazoContratualAnos, valorMercadoUsina])

  const maxBeneficioGrafico = useMemo(
    () => economiaProjetadaGrafico.reduce((maior, item) => Math.max(maior, item.acumulado), 0),
    [economiaProjetadaGrafico],
  )

  const heroSummary =
    'Esta proposta foi feita especialmente para você aproveitar energia solar com desconto garantido desde o primeiro mês — e sem precisar investir nada. A SolarInvest realiza todo o investimento na usina; você só paga pela energia que ela gera, com desconto e previsibilidade. Após 60 meses, a usina passa a ser 100% sua, aumentando o valor do seu imóvel e sua independência energética.'
  const beneficioAno30 = economiaProjetada.find((item) => item.ano === 30) ?? null
  const economiaExplainer: React.ReactNode = beneficioAno30 ? (
    <>
      <strong>Em 30 anos de geração solar:</strong> sua economia pode alcançar{' '}
      <strong>{currency(beneficioAno30.acumulado)}</strong> — um retorno sustentável e garantido que continua crescendo mesmo
      após o contrato.
    </>
  ) : (
    <>Economia que continua crescendo mesmo após o contrato, com previsibilidade e segurança para o seu patrimônio energético.</>
  )
  const informacoesImportantesObservacaoTexto = useMemo(() => {
    if (typeof informacoesImportantesObservacao !== 'string') {
      return null
    }

    const texto = informacoesImportantesObservacao.trim()
    if (!texto || texto === INFORMACOES_IMPORTANTES_TEXTO_REMOVIDO) {
      return null
    }

    return texto
  }, [informacoesImportantesObservacao])
  const configuracaoUsinaObservacoesTexto = useMemo(() => {
    if (typeof configuracaoUsinaObservacoes !== 'string') {
      return null
    }

    const texto = configuracaoUsinaObservacoes.trim()
    return texto || null
  }, [configuracaoUsinaObservacoes])
  const configuracaoUsinaObservacoesParagrafos = useMemo(() => {
    if (!configuracaoUsinaObservacoesTexto) {
      return []
    }

    return configuracaoUsinaObservacoesTexto
      .split(/\r?\n\r?\n+/)
      .map((paragrafo) => paragrafo.trim())
      .filter(Boolean)
  }, [configuracaoUsinaObservacoesTexto])

  return (
    <div ref={ref} className="print-root">
      <div
        className="print-layout leasing-print-layout"
        data-print-section="proposal"
        aria-hidden="false"
      >
        <div className="print-page">
          <section className="print-section print-section--hero avoid-break">
            <div className="print-hero">
              <div className="print-hero__header">
                <div className="print-hero__identity">
                  <div className="print-logo">
                    <img src="/proposal-header-logo.svg" alt="Marca SolarInvest" />
                  </div>
                  <div className="print-hero__title">
                    <span className="print-hero__eyebrow">SolarInvest</span>
                    <div className="print-hero__headline">
                      <img
                        className="print-hero__title-logo"
                        src="/proposal-header-logo.svg"
                        alt="Marca SolarInvest"
                      />
                      <h1>Proposta Personalizada de Energia Solar com Leasing SolarInvest</h1>
                    </div>
                    <p className="print-hero__tagline">
                      Economia imediata, sem investimento inicial e com usina 100% sua ao final.
                    </p>
                  </div>
                </div>
              </div>
              <div className="print-hero__meta">
                <div className="print-hero__meta-item">
                  <small>Código do orçamento: </small>
                  <strong>{codigoOrcamento || '—'}</strong>
                </div>
              </div>
              <div className="print-hero__summary no-break-inside">
                <p>{heroSummary}</p>
                <div className="print-hero__benefits">
                  <p className="print-hero__benefits-title">💡 Benefícios SolarInvest</p>
                  <ul>
                    <li>
                      <strong>✔ Economia garantida</strong> desde o 1º mês
                    </li>
                    <li>
                      <strong>✔ Investimento 100% feito pela SolarInvest</strong>
                    </li>
                    <li>
                      <strong>✔ Manutenção, seguro e suporte</strong> sempre inclusos
                    </li>
                    <li>
                      <strong>✔ Transferência gratuita da usina</strong> ao completar 60 meses
                    </li>
                    <li>
                      <strong>✔ Energia limpa e valorização</strong> do seu imóvel
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
    
          <section className="print-section keep-together avoid-break">
            <h2 className="section-title keep-with-next">Identificação do Cliente</h2>
            <ClientInfoGrid
              fields={resumoCampos}
              className="print-client-grid no-break-inside"
              fieldClassName="print-client-field"
              wideFieldClassName="print-client-field--wide"
            />
          </section>

          <section className="print-section keep-together avoid-break">
            <h2 className="section-title keep-with-next">Dados da Instalação</h2>
            <div className="print-uc-details">
              <div className="print-uc-geradora">
                <h3 className="print-uc-heading">UC Geradora</h3>
                <p className="print-uc-text">
                  UC nº {ucGeradoraNumeroLabel} — {ucGeradoraEnderecoLabel}
                </p>
              </div>
              {hasBeneficiarias ? (
                <div className="print-uc-beneficiarias">
                  <h4 className="print-uc-beneficiarias-title">UCs Beneficiárias</h4>
                  <ul className="print-uc-beneficiarias-list">
                    {ucsBeneficiariasLista.map((uc, index) => {
                      const rateioLabel = formatRateioLabel(uc.rateioPercentual)
                      return (
                        <li key={`${uc.numero || 'uc'}-${index}`}>
                          UC nº {uc.numero || '—'}
                          {uc.endereco ? ` — ${uc.endereco}` : ''}
                          {rateioLabel ? ` — Rateio: ${rateioLabel}` : ''}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          <section
            id="resumo-proposta"
            className="print-section keep-together avoid-break page-break-before break-after"
          >
            <h2 className="section-title keep-with-next">Resumo da Proposta</h2>
            <p className="section-subtitle keep-with-next">Visão geral dos parâmetros comerciais e técnicos</p>
            <table className="no-break-inside">
              <thead>
                <tr>
                  <th>Parâmetro</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {resumoProposta.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td className="leasing-table-value">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
    
          <section className="print-section keep-together avoid-break">
            <h2 className="section-title keep-with-next">Especificações da Usina Solar</h2>
            <p className="section-subtitle keep-with-next">Configuração técnica do sistema proposto</p>
            <table className="no-break-inside">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Descrição/Valor</th>
                </tr>
              </thead>
              <tbody>
                {especificacoesUsina.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td className="leasing-table-value">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
    
          <section
            id="condicoes-financeiras"
            className="print-section keep-together avoid-break page-break-before break-after"
          >
            <h2 className="section-title keep-with-next">Condições Financeiras do Leasing</h2>
            <p className="section-subtitle keep-with-next">Valores projetados e vigência contratual</p>
            <table className="no-break-inside">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Descrição/Valor</th>
                </tr>
              </thead>
              <tbody>
                {condicoesFinanceiras.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td className="leasing-table-value">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
    
          {multiUcResumoDados ? (
            <section id="multi-uc" className="print-section keep-together">
              <h2 className="section-title keep-with-next">Cenário Misto (Multi-UC)</h2>
              <p className="section-subtitle keep-with-next">
                Distribuição dos créditos de energia entre unidades consumidoras
              </p>
              <div className="print-key-values">
                <p>
                  <strong>Energia gerada total</strong>
                  {formatKwhValor(multiUcResumoDados.energiaGeradaTotalKWh, 0)}
                </p>
                <p>
                  <strong>Energia compensada</strong>
                  {formatKwhValor(multiUcResumoDados.energiaGeradaUtilizadaKWh, 0)}
                </p>
                <p>
                  <strong>Créditos remanescentes</strong>
                  {formatKwhValor(multiUcResumoDados.sobraCreditosKWh)}
                </p>
                <p>
                  <strong>{`Escalonamento Fio B (${multiUcResumoDados.anoVigencia})`}</strong>
                  {multiUcEscalonamentoTexto ?? '—'}
                </p>
                <p>
                  <strong>Encargo TUSD (R$/mês)</strong>
                  {currency(multiUcResumoDados.totalTusd)}
                </p>
                <p>
                  <strong>Encargo TE (R$/mês)</strong>
                  {currency(multiUcResumoDados.totalTe)}
                </p>
                <p>
                  <strong>Custo total mensal (R$)</strong>
                  {currency(multiUcResumoDados.totalContrato)}
                </p>
                <p>
                  <strong>Modo de rateio</strong>
                  {multiUcRateioDescricao ?? '—'}
                </p>
              </div>
              <table className="no-break-inside">
                <thead>
                  <tr>
                    <th>UC</th>
                    <th>Classe</th>
                    <th>Consumo (kWh)</th>
                    <th>Créditos (kWh)</th>
                    <th>kWh faturados</th>
                    <th>kWh compensados</th>
                    <th>TE (R$/kWh)</th>
                    <th>TUSD total (R$/kWh)</th>
                    <th>TUSD Fio B (R$/kWh)</th>
                    <th>TUSD mensal (R$)</th>
                    <th>TE mensal (R$)</th>
                    <th>Total mensal (R$)</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {multiUcResumoDados.ucs.map((uc) => (
                    <tr key={uc.id}>
                      <td>{uc.id}</td>
                      <td>{uc.classe}</td>
                      <td className="leasing-table-value">{formatKwhValor(uc.consumoKWh)}</td>
                      <td className="leasing-table-value">
                        <div>{formatKwhValor(uc.creditosKWh)}</div>
                        <small className="muted">
                          {multiUcResumoDados.distribuicaoPorPercentual
                            ? `Rateio: ${formatPercentBRWithDigits((uc.rateioPercentual ?? 0) / 100, 2)}`
                            : uc.manualRateioKWh != null
                            ? `Manual: ${formatKwhValor(uc.manualRateioKWh)}`
                            : '—'}
                        </small>
                      </td>
                      <td className="leasing-table-value">{formatKwhValor(uc.kWhFaturados)}</td>
                      <td className="leasing-table-value">{formatKwhValor(uc.kWhCompensados)}</td>
                      <td className="leasing-table-value">{tarifaCurrency(uc.te)}</td>
                      <td className="leasing-table-value">{tarifaCurrency(uc.tusdTotal)}</td>
                      <td className="leasing-table-value">{tarifaCurrency(uc.tusdFioB)}</td>
                      <td className="leasing-table-value">{currency(uc.tusdMensal)}</td>
                      <td className="leasing-table-value">{currency(uc.teMensal)}</td>
                      <td className="leasing-table-value">{currency(uc.totalMensal)}</td>
                      <td className="leasing-table-value">{uc.observacoes?.trim() || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted no-break-inside">
                TUSD não compensável calculada sobre a energia compensada de cada UC conforme Lei 14.300/2022 e
                escalonamento vigente.
              </p>
            </section>
          ) : null}
    
          <section className="print-section keep-together avoid-break">
            <h2 className="section-title keep-with-next">Veja como sua conta cai mês a mês</h2>
            <p className="section-subtitle keep-with-next">
              Comparativo anual estimado entre tarifa convencional e SolarInvest
            </p>
            <table className="no-break-inside">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Tarifa cheia média</th>
                  <th>Tarifa com desconto média</th>
                  <th>Conta distribuidora (R$)</th>
                  <th>Mensalidade SolarInvest (R$)</th>
                </tr>
              </thead>
              <tbody>
                {mensalidadesPorAno.map((linha) => (
                  <tr key={`mensalidade-${linha.ano}`}>
                    <td>{`${linha.ano}º ano`}</td>
                    <td className="leasing-table-value">{tarifaCurrency(linha.tarifaCheiaAno)}</td>
                    <td className="leasing-table-value">{tarifaCurrency(linha.tarifaComDesconto)}</td>
                    <td className="leasing-table-value">{currency(linha.contaDistribuidora)}</td>
                    <td className="leasing-table-value">{currency(linha.mensalidade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Com o desconto SolarInvest, sua economia cresce automaticamente conforme a energia da distribuidora encarece.
              Você economiza todos os meses e ainda garante um ativo energético no seu nome ao final do contrato.
            </p>
            <p className="muted print-footnote">
              <strong>
                <em>
                  A partir do {`${prazoContratualTotalAnos + 1}º ano`}, a conta da distribuidora passa a contemplar apenas
                  TUSD, taxa mínima e iluminação pública para sistemas on-grid.
                </em>
              </strong>
            </p>
            <p className="muted print-footnote">
              <strong>
                <em>
                  A partir do {`${prazoContratualTotalAnos + 1}º ano`}, em caso de uso excedente, o cliente passa a pagar
                  tarifa cheia para a concessionária.
                </em>
              </strong>
            </p>
            <p className="muted print-footnote">
              <strong>
                <em>
                  Os valores são estimativas baseadas nas tarifas atuais e servem para demonstrar sua economia real já no
                  primeiro mês de uso. A SolarInvest garante que o desconto contratado será mantido durante toda a vigência.
                </em>
              </strong>
            </p>
          </section>

          <section
            id="economia-30-anos"
            className="print-section keep-together page-break-before break-after"
          >
            <h2 className="section-title keep-with-next">Seu patrimônio energético cresce mês a mês</h2>
            {economiaProjetadaGrafico.length ? (
              <>
                <p className="section-subtitle keep-with-next">
                  Cada mês de geração representa economia crescente e valorização do seu imóvel. Ao completar 60 meses, sua
                  usina estará quitada e 100% em seu nome.
                </p>
                <div
                  className="leasing-horizontal-chart no-break-inside"
                  role="img"
                  aria-label="Economia projetada em 30 anos"
                >
                  <div className="leasing-horizontal-chart__header-row">
                    <span className="leasing-horizontal-chart__axis-y-label">Tempo (anos)</span>
                    <span className="leasing-horizontal-chart__axis-x-label">Benefício acumulado (R$)</span>
                  </div>
                  <div className="leasing-horizontal-chart__rows">
                    {economiaProjetadaGrafico.map((linha) => {
                      const percentual = maxBeneficioGrafico > 0 ? (linha.acumulado / maxBeneficioGrafico) * 100 : 0
                      return (
                        <div
                          className="leasing-horizontal-chart__row"
                          key={`grafico-economia-${linha.ano.toFixed(2)}`}
                        >
                          <div className="leasing-horizontal-chart__y-value">{linha.label}</div>
                          <div className="leasing-horizontal-chart__bar-track" aria-hidden="true">
                            <div
                              className="leasing-horizontal-chart__bar"
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                          <div className="leasing-horizontal-chart__value">{formatMoneyBR(linha.acumulado)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p className="leasing-chart-note no-break-inside">{economiaExplainer}</p>
              </>
            ) : (
              <p className="muted no-break-inside">
                Não há dados suficientes para projetar a economia acumulada desta proposta.
              </p>
            )}
          </section>

          <PrintableProposalImages images={imagensInstalacao} />

          {configuracaoUsinaObservacoesParagrafos.length > 0 ? (
            <section
              id="observacoes-configuracao"
              className="print-section keep-together avoid-break"
            >
              <h2 className="section-title keep-with-next">Observações</h2>
              <div className="print-observacoes no-break-inside">
                {configuracaoUsinaObservacoesParagrafos.map((paragrafo, index) => {
                  const linhas = paragrafo.split(/\r?\n/)
                  return (
                    <p
                      key={`observacao-configuracao-${index}`}
                      className="print-observacoes__paragraph"
                    >
                      {linhas.map((linha, linhaIndex) => (
                        <React.Fragment
                          key={`observacao-configuracao-${index}-linha-${linhaIndex}`}
                        >
                          {linha}
                          {linhaIndex < linhas.length - 1 ? <br /> : null}
                        </React.Fragment>
                      ))}
                    </p>
                  )
                })}
              </div>
            </section>
          ) : null}

          <section
            id="infos-importantes"
            className="print-section print-important keep-together page-break-before break-after"
          >
            <h2 className="section-title keep-with-next">Informações Importantes</h2>
            <p className="section-subtitle keep-with-next">
              <strong>Responsabilidades, garantias e condições gerais</strong>
            </p>
            <ul className="no-break-inside">
              <li>
                Durante todo o contrato, a SolarInvest cuida de tudo para você —{' '}
                <strong>operação, manutenção, seguro e suporte técnico completos</strong>. Sua única preocupação será aproveitar a
                economia.
              </li>
              <li>
                Todas as projeções e valores desta proposta são estimativas baseadas nas tarifas atuais. No contrato final, a
                SolarInvest confirma os descontos e assegura que sua economia será mantida conforme acordado.
              </li>
              <li>
                Todos os equipamentos são certificados pelo <strong>INMETRO</strong> e atendem rigorosamente às{' '}
                <strong>normas da ANEEL e ABNT</strong>, garantindo eficiência e durabilidade.
              </li>
              <li>
                <strong>Disponibilidade do kit fotovoltaico:</strong> caso algum item esteja indisponível no momento da compra,
                fornecemos equipamentos equivalentes ou superiores, mantendo o desempenho projetado.
              </li>
              <li>
                A <strong>tabela de compra antecipada</strong> da usina está disponível mediante solicitação ao consultor
                SolarInvest.
              </li>
              <li>
                Os <strong>valores, taxas, tarifas e mensalidades</strong> apresentados são simulações preliminares com base em
                históricos de consumo e parâmetros técnicos atualizados; quaisquer ajustes são alinhados com você após a
                análise técnica detalhada.
              </li>
              <li>
                <strong>Instalação em solo:</strong> se houver necessidade de estruturas adicionais ou se desejar incluir o custo
                no leasing, a SolarInvest apresenta a atualização orçamentária correspondente para sua aprovação.
              </li>
              <li>
                Após a vistoria e validação técnica, todos os valores são formalizados no contrato definitivo com os descontos
                garantidos por escrito.
              </li>
            </ul>
            {informacoesImportantesObservacaoTexto ? (
              <p className="print-important__observation no-break-inside">{informacoesImportantesObservacaoTexto}</p>
            ) : null}
          </section>
    
          <section className="print-section print-section--footer no-break-inside avoid-break">
            <footer className="print-final-footer no-break-inside">
              <div className="print-final-footer__dates">
                <p>
                  <strong>Data de emissão da proposta:</strong> {emissaoTexto}
                </p>
              </div>
              <p className="print-final-footer__closing">
                Com esta proposta, você inicia sua jornada rumo à independência energética. Em apenas 60 meses, sua própria
                usina estará gerando economia, valorizando seu patrimônio e garantindo energia limpa por décadas.
              </p>
              <div className="print-final-footer__signature">
                <div className="signature-line" />
                <span>Assinatura do cliente</span>
              </div>
            </footer>

            <div className="print-brand-footer no-break-inside">
              <strong>SolarInvest</strong>
              <span>Energia inteligente, sem investimento inicial e com economia garantida desde o 1º mês.</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
