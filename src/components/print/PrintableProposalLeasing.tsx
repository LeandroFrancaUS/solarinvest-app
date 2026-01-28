import React, { useCallback, useMemo } from 'react'

import './styles/print-common.css'
import './styles/proposal-leasing.css'
import { currency, formatCpfCnpj, tarifaCurrency } from '../../utils/formatters'
import {
  formatMoneyBR,
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
} from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { TIPO_BASICO_LABELS } from '../../types/tipoBasico'
import PrintableProposalImages from './PrintableProposalImages'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'
import { agrupar, type Linha } from '../../lib/pdf/grouping'
import { anosAlvoEconomia } from '../../lib/finance/years'
import { calcularEconomiaAcumuladaPorAnos } from '../../lib/finance/economia'
import type { SegmentoCliente } from '../../lib/finance/roi'
import { sanitizePrintableText } from '../../utils/textSanitizer'
import { calcularTaxaMinima } from '../../utils/calcs'

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

const AVISO_GERAL_ESTIMATIVAS =
  'Todos os valores apresentados são estimativas baseadas no consumo histórico, irradiação média da região e tarifa vigente da distribuidora. Os valores podem variar conforme consumo real, condições climáticas e reajustes aplicados pela concessionária.'
const AVISO_GERAL_ECONOMIA = (
  <>
    <strong>Aviso:</strong> Esta proposta não constitui garantia de economia.
  </>
)
const AVISO_ESPECIFICACOES =
  (
    <>
      <strong>Aviso:</strong> Valores estimados. A geração real pode variar conforme clima, sombreamento, degradação
      natural dos módulos e condições reais de instalação.
    </>
  )
const AVISO_PATRIMONIO = (
  <>
    <strong>Aviso:</strong> As estimativas acima foram calculadas a partir do consumo histórico e das condições médias
    de geração. Embora representem uma projeção realista do potencial de economia, os valores finais podem variar
    conforme fatores externos como clima, consumo real e reajustes tarifários.
  </>
)

const PRAZO_LEASING_PADRAO_MESES = 60

const SEGMENTO_LABELS: Record<SegmentoCliente, string> = TIPO_BASICO_LABELS

const formatAnosDetalhado = (valor: number): string => {
  const fractionDigits = Number.isInteger(valor) ? 0 : 1
  const numero = formatNumberBRWithOptions(valor, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  const singular = Math.abs(valor - 1) < 1e-6
  return `${numero} ${singular ? 'ano' : 'anos'}`
}

const formatPrazoContratualMesesCurto = (meses?: number): string => {
  if (!Number.isFinite(meses) || (meses ?? 0) <= 0) {
    return formatPrazoContratualMesesCurto(PRAZO_LEASING_PADRAO_MESES)
  }

  const mesesInteiros = Math.max(1, Math.round(meses ?? 0))
  const numero = formatNumberBRWithOptions(mesesInteiros, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const singular = mesesInteiros === 1
  return `${numero} ${singular ? 'mês' : 'meses'}`
}

const formatPrazoContratual = (meses: number): string => {
  if (!Number.isFinite(meses) || meses <= 0) {
    return '—'
  }

  const mesesTexto = formatNumberBRWithOptions(meses, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return `${mesesTexto} meses de vigência contratual`
}

const toDisplayPercent = (value?: number, fractionDigits = 1) => {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return formatPercentBRWithDigits((value ?? 0) / 100, fractionDigits)
}

const sanitizeItemText = (value?: string | null): string | null => sanitizePrintableText(value)
const MODELO_MODULO_PADRAO = 'Jinko, Maxeon ou Similares'
const MODELO_INVERSOR_PADRAO = 'Huawei, Solis ou Similares'
const sanitizeTextField = (value?: string | null): string | null => sanitizePrintableText(value)

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

const formatTipoRede = (value?: PrintableProposalProps['tipoRede']) => {
  switch (value) {
    case 'monofasico':
      return 'Monofásico'
    case 'bifasico':
      return 'Bifásico'
    case 'trifasico':
      return 'Trifásico'
    default:
      return '—'
  }
}

const formatSegmentoCliente = (
  value?: SegmentoCliente | null,
  outro?: string | null,
): string => {
  if (!value) {
    return '—'
  }

  if (value === 'outros') {
    const descricao = outro?.trim()
    const sufixo = descricao ? ` (${descricao})` : ''
    return `Outros${sufixo}`
  }

  return SEGMENTO_LABELS[value] ?? '—'
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
    tipoInstalacaoLabel,
    tipoInstalacaoOutro,
    tipoInstalacaoCompleto,
    tipoSistema,
    tipoRede,
    segmentoCliente,
    tipoEdificacaoOutro,
    tipoEdificacaoCompleto,
    areaInstalacao,
    capex,
    buyoutResumo,
    anos,
    leasingROI,
    parcelasLeasing,
    distribuidoraTarifa,
    leasingDataInicioOperacao,
    leasingValorInstalacaoCliente,
    leasingValorDeMercadoEstimado,
    mostrarValorMercadoLeasing,
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
    ucGeradoraTitular,
    ucsBeneficiarias,
    tusdTipoClienteCompleto,
  } = props

  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : null
  const telefoneCliente = cliente.telefone?.trim() || null
  const emailCliente = cliente.email?.trim() || null
  const cepCliente = cliente.cep?.trim() || null
  const codigoOrcamento = budgetId?.trim() || null
  const nomeCliente = cliente.nome?.trim() || null
  const ucCliente = cliente.uc?.trim() || null
  const distribuidoraLabel = distribuidoraTarifa?.trim() || cliente.distribuidora?.trim() || null

  const distribuidoraNomeCurto = useMemo(() => {
    if (!distribuidoraLabel) {
      return null
    }
    const [primeiroNome] = distribuidoraLabel.split(/\s+/)
    return primeiroNome || null
  }, [distribuidoraLabel])

  const nomeDistribuidora = distribuidoraLabel || 'distribuidora local'

  const avisoMensalidadeCondicoes = useMemo(() => null, [])
  const avisoMensalidadeEvolucao = useMemo(() => null, [])

  const formatClienteEnderecoCompleto = (incluirCep = true) => {
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
    if (incluirCep && cep) {
      partes.push(`CEP ${cep}`)
    }
    return partes.filter(Boolean).join(' • ')
  }

  const ucGeradoraTitularNome = ucGeradoraTitular?.nomeCompleto?.trim() || null
  const ucGeradoraTitularCpf = ucGeradoraTitular?.cpf?.trim() || null
  const ucGeradoraTitularRg = ucGeradoraTitular?.rg?.trim() || null
  const ucGeradoraTitularEndereco = ucGeradoraTitular?.endereco?.trim() || null
  const ucGeradoraNumero = ucGeradora?.numero?.trim() || ucCliente || ''
  const ucGeradoraEnderecoBase = ucGeradoraTitularEndereco ?? ucGeradora?.endereco?.trim() ?? ''
  const ucGeradoraEndereco = ucGeradoraEnderecoBase || formatClienteEnderecoCompleto()
  const enderecoCompletoCliente = formatClienteEnderecoCompleto(false)
  const isPresentValue = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return value.trim().length > 0
    }
    if (typeof value === 'number') {
      return Number.isFinite(value)
    }
    if (typeof value === 'boolean') {
      return true
    }
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return Boolean(value)
  }

  const infoPessoalCliente = [
    { label: 'Nome/Razão social', value: nomeCliente?.trim() ?? '' },
    { label: 'CPF/CNPJ', value: documentoCliente?.trim() ?? '' },
    { label: 'E-mail', value: emailCliente?.trim() ?? '' },
    { label: 'Telefone', value: telefoneCliente?.trim() ?? '' },
    { label: 'Endereço', value: enderecoCompletoCliente?.trim() ?? '' },
    { label: 'CEP', value: cepCliente?.trim() ?? '' },
  ].filter((item) => isPresentValue(item.value))

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
  const ucGeradoraTitularDocumento = ucGeradoraTitularCpf
    ? `CPF: ${formatCpfCnpj(ucGeradoraTitularCpf)}`
    : null
  const ucGeradoraTitularRgLabel = ucGeradoraTitularRg ? `RG: ${ucGeradoraTitularRg}` : null
  const ucGeradoraTitularInfo = [ucGeradoraTitularDocumento, ucGeradoraTitularRgLabel]
    .filter(Boolean)
    .join(' — ')
  const ucGeradoraTitularLabel = [ucGeradoraTitularNome, ucGeradoraTitularInfo]
    .filter(Boolean)
    .join(' — ')
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
    const aplicaTaxaMinima =
      typeof vendaSnapshot?.parametros?.aplica_taxa_minima === 'boolean'
        ? vendaSnapshot.parametros.aplica_taxa_minima
        : true
    if (!aplicaTaxaMinima) {
      return 0
    }
    const valor = vendaSnapshot?.parametros?.taxa_minima_rs_mes
    if (Number.isFinite(valor) && (valor ?? 0) > 0) {
      return Math.max(0, valor ?? 0)
    }
    if (tipoRede && tarifaCheiaBase > 0) {
      return calcularTaxaMinima(tipoRede, tarifaCheiaBase)
    }
    return 0
  })()

  const custosFixosContaEnergia = useMemo(() => {
    const valor = vendaSnapshot?.parametros?.taxa_minima_rs_mes
    if (Number.isFinite(valor) && (valor ?? 0) > 0) {
      return Math.max(0, valor ?? 0)
    }
    return 0
  }, [vendaSnapshot?.parametros?.taxa_minima_rs_mes])

  const formatKwhValor = (valor: number, fractionDigits = 2): string =>
    `${formatNumberBRWithOptions(valor, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })} kWh`

  const resumoCampos: ClientInfoField[] = []

  if (isPresentValue(codigoOrcamento)) {
    resumoCampos.push({ label: 'Código do orçamento', value: codigoOrcamento })
  }

  if (infoPessoalCliente.length > 0) {
    resumoCampos.push({
      label: 'Informações do cliente',
      value: (
        <div className="print-client-lines">
          {infoPessoalCliente.map((item) => (
            <div key={item.label} className="print-client-line">
              <strong>{item.label}:</strong> {item.value}
            </div>
          ))}
        </div>
      ),
      wide: true,
    })
  }

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
  const tipoInstalacaoDescricao = (() => {
    if (tipoInstalacaoCompleto) {
      return tipoInstalacaoCompleto
    }
    const baseLabel = tipoInstalacaoLabel ?? (tipoInstalacao === 'solo' ? 'Solo' : 'Telhado')
    const outro = tipoInstalacaoOutro?.trim()
    return outro ? `${baseLabel} (${outro})` : baseLabel
  })()

  const resumoProposta = [
    {
      label: 'Modalidade',
      value: 'Leasing SolarInvest — investimento total pela SolarInvest',
    },
    {
      label: 'Validade da proposta',
      value: validadeResumoTexto,
    },
    {
      label: 'Início da geração',
      value: inicioOperacaoTexto
        ? `${inicioOperacaoTexto} · Em até 60 (sessenta) dias, contados a partir da entrega do kit solar`
        : 'Em até 60 (sessenta) dias, contados a partir da entrega do kit solar',
    },
    {
      label: 'Tipo de instalação',
      value: tipoInstalacaoDescricao,
    },
    {
      label: 'Distribuidora',
      value: distribuidoraLabel || '—',
    },
    {
      label: 'Responsabilidades SolarInvest',
      value: 'Operação, manutenção, monitoramento, limpeza e seguro durante todo o contrato',
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
  const modeloModulo =
    modeloModuloManual ?? modeloModuloSnapshot ?? modelosCatalogo.modeloModulo ?? MODELO_MODULO_PADRAO
  const modeloInversor =
    modeloInversorManual ?? modeloInversorSnapshot ?? modelosCatalogo.modeloInversor ?? MODELO_INVERSOR_PADRAO

  const valorMercadoUsina = useMemo(
    () =>
      Number.isFinite(leasingValorDeMercadoEstimado)
        ? Math.max(0, leasingValorDeMercadoEstimado ?? 0)
        : 0,
    [leasingValorDeMercadoEstimado],
  )
  const valorMercadoProposta = useMemo(
    () => (Number.isFinite(capex) ? Math.max(0, capex ?? 0) : 0),
    [capex],
  )
  const exibirValorMercadoNaProposta = Boolean(mostrarValorMercadoLeasing)

  const segmentoClienteDescricao =
    tipoEdificacaoCompleto ?? formatSegmentoCliente(segmentoCliente, tipoEdificacaoOutro)

  const especificacoesUsina = [
    ...(exibirValorMercadoNaProposta
      ? [
          {
            label: 'Valor de mercado',
            value: currency(valorMercadoProposta),
          } as const,
        ]
      : []),
    {
      label: 'Tipo de Sistema',
      value: formatTipoSistema(tipoSistema),
    },
    {
      label: 'Tipo de rede',
      value: formatTipoRede(tipoRede),
    },
    {
      label: 'Potência instalada (kWp)',
      value: formatKwp(potenciaInstaladaKwp),
    },
    {
      label: 'Inversores fotovoltaicos',
      value: modeloInversor ?? '—',
    },
    {
      label: 'Módulos fotovoltaicos',
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
      label: 'Tipo de Edificação',
      value: segmentoClienteDescricao,
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
      label: 'Investimento no sistema',
      value: '100% realizado pela SolarInvest',
    },
    {
      label: 'Investimento do cliente',
      value: currency(valorInstalacaoCliente),
    },
    {
      label: 'Tarifa cheia da distribuidora',
      value: tarifaCheiaBase > 0 ? tarifaCurrency(tarifaCheiaBase) : '—',
    },
    {
      label: 'Tarifa inicial SolarInvest',
      value: tarifaInicialProjetada > 0 ? tarifaCurrency(tarifaInicialProjetada) : '—',
    },
    {
      label: `Taxa mínima (${formatTipoRede(tipoRede)})`,
      value: currency(taxaMinimaMensal),
    },
    {
      label: 'Desconto contratado',
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
      const mensalidadeSolarInvest = energiaContratadaBase * tarifaComDesconto
      const mensalidadeDistribuidora = energiaContratadaBase * tarifaAno + custosFixosContaEnergia
      const encargosDistribuidora = tusdMedio + taxaMinimaMensal
      const despesaMensalEstimada = mensalidadeSolarInvest + encargosDistribuidora
      return {
        ano,
        tarifaCheiaAno: tarifaAno,
        tarifaComDesconto,
        mensalidadeSolarInvest,
        mensalidadeDistribuidora,
        encargosDistribuidora,
        despesaMensalEstimada,
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
    const mensalidadeDistribuidoraPosContrato = energiaContratadaBase * tarifaAnoPosContrato + custosFixosContaEnergia
    const encargosDistribuidoraPosContrato = Math.max(0, tusdPosContrato + taxaMinimaMensal)
    const despesaMensalPosContrato = encargosDistribuidoraPosContrato

    linhas.push({
      ano: anoPosContrato,
      tarifaCheiaAno: tarifaAnoPosContrato,
      tarifaComDesconto: tarifaAnoPosContrato,
      encargosDistribuidora: encargosDistribuidoraPosContrato,
      mensalidadeSolarInvest: 0,
      mensalidadeDistribuidora: mensalidadeDistribuidoraPosContrato,
      despesaMensalEstimada: despesaMensalPosContrato,
    })

    return linhas
  }, [
    custosFixosContaEnergia,
    descontoFracao,
    energiaContratadaBase,
    inflacaoEnergiaFracao,
    prazoContratualTotalAnos,
    taxaMinimaMensal,
    tusdMedioPorAno,
    tarifaCheiaBase,
  ])

  const prazoContratualMeses = prazoContratual > 0 ? prazoContratual : PRAZO_LEASING_PADRAO_MESES
  const prazoEconomiaMeses = prazoContratualMeses
  const prazoContratualAnos = useMemo(() => (prazoContratual > 0 ? prazoContratual / 12 : 0), [prazoContratual])

  const economiaMarcos = useMemo(() => {
    const alvos = anosAlvoEconomia(prazoEconomiaMeses)
    const anosDisponiveis = Array.isArray(anos) ? anos : []

    if (anosDisponiveis.length === 0) {
      return alvos
    }

    const anosValidos = new Set(anosDisponiveis)
    const filtrados = alvos.filter((ano) => anosValidos.has(ano))

    return filtrados.length > 0 ? filtrados : alvos
  }, [anos, prazoEconomiaMeses])

  const obterBeneficioPorAno = useCallback(
    (ano: number): number => {
      if (!Array.isArray(leasingROI) || leasingROI.length === 0) {
        return 0
      }

      const totalAnos = leasingROI.length

      if (!Number.isFinite(ano) || ano <= 0) {
        return 0
      }

      const indice = Math.min(totalAnos, Math.max(1, Math.ceil(ano))) - 1
      return leasingROI[indice] ?? 0
    },
    [leasingROI],
  )

  const calcularEconomiaTotalAteAno = useCallback(
    (ano: number): number => {
      if (!Number.isFinite(ano) || ano <= 0) {
        return 0
      }

      const beneficioBase = obterBeneficioPorAno(ano)
      const deveAdicionarUsina = valorMercadoUsina > 0 && prazoContratualAnos > 0 && ano >= prazoContratualAnos
      const beneficioTotal = deveAdicionarUsina ? beneficioBase + valorMercadoUsina : beneficioBase

      return Math.max(0, beneficioTotal)
    },
    [obterBeneficioPorAno, prazoContratualAnos, valorMercadoUsina],
  )

  const economiaProjetada = useMemo(() => {
    const serie = calcularEconomiaAcumuladaPorAnos(economiaMarcos, calcularEconomiaTotalAteAno)

    return serie.map((row, index) => {
      const acumuladoAnterior = index > 0 ? serie[index - 1].economiaAcumulada : 0
      return {
        ano: row.ano,
        acumulado: row.economiaAcumulada,
        economiaAnual: row.economiaAcumulada - acumuladoAnterior,
      }
    })
  }, [calcularEconomiaTotalAteAno, economiaMarcos])

  const economiaProjetadaGrafico = useMemo(() => {
    if (!Array.isArray(leasingROI) || leasingROI.length === 0) {
      return []
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

      const beneficioTotal = calcularEconomiaTotalAteAno(ano)
      let label = formatAnosDetalhado(ano)

      if (tipo === 'prazo') {
        label = `${label} (prazo do leasing)`
      } else if (tipo === 'posPrazo') {
        label = `${label} (após o prazo)`
      }

      acc.push({ ano, label, acumulado: Math.max(0, beneficioTotal) })
      return acc
    }, [])
  }, [calcularEconomiaTotalAteAno, leasingROI, prazoContratualAnos])

  const maxBeneficioGrafico = useMemo(
    () => economiaProjetadaGrafico.reduce((maior, item) => Math.max(maior, item.acumulado), 0),
    [economiaProjetadaGrafico],
  )

  const economiaPatrimonioResumo = useMemo(
    () =>
      [5, 6, 10, 15, 20, 30].map((ano) => ({
        ano,
        valor: calcularEconomiaTotalAteAno(ano),
      })),
    [calcularEconomiaTotalAteAno],
  )

  const prazoContratualMesesTexto = useMemo(
    () => formatPrazoContratualMesesCurto(prazoContratualMeses),
    [prazoContratualMeses],
  )
  const heroSummary =
    'A SolarInvest apresenta uma solução completa de energia solar em modelo de leasing, com investimento integral realizado pela SolarInvest e operação completa: instalação, seguro, manutenção, monitoramento e suporte técnico.'
  const beneficioAno30 = useMemo(() => calcularEconomiaTotalAteAno(30), [calcularEconomiaTotalAteAno])
  const economiaExplainerValor = Number.isFinite(beneficioAno30) && beneficioAno30 > 0
    ? formatMoneyBR(beneficioAno30)
    : '—'
  const economiaExplainer: React.ReactNode = (
    <>
      Em 30 anos de geração solar, sua economia pode alcançar <strong>{economiaExplainerValor}</strong> — um retorno
      sustentável, previsível e duradouro.
    </>
  )
  const informacoesImportantesObservacaoTexto = useMemo(() => {
    const texto = sanitizeTextField(informacoesImportantesObservacao)
    if (!texto || texto === INFORMACOES_IMPORTANTES_TEXTO_REMOVIDO) {
      return null
    }

    return texto
  }, [informacoesImportantesObservacao])
  const configuracaoUsinaObservacoesTexto = useMemo(() => {
    const texto = sanitizeTextField(configuracaoUsinaObservacoes)
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
                  <div className="print-hero__brand">
                    <img src="/proposal-header-logo.svg" alt="Logo SolarInvest" />
                    <span className="print-hero__brand-name">SolarInvest</span>
                  </div>
                  <div className="print-hero__title">
                    <div className="print-hero__headline">
                      <p className="print-hero__aspiration">
                        TRANSFORME UMA DESPESA MENSAL EM UM ATIVO REAL — SEM INVESTIR NADA PARA COMEÇAR
                      </p>
                      <h1>🌞 SUA PROPOSTA PERSONALIZADA DE ENERGIA SOLAR</h1>
                      <p className="print-hero__subheadline">SUA PROPOSTA PERSONALIZADA DE ENERGIA SOLAR</p>
                    </div>
                    <p className="print-hero__tagline">
                      SOLARINVEST — LEASING COMPLETO COM INVESTIMENTO 100% REALIZADO PELA SOLARINVEST
                    </p>
                  </div>
                </div>
              </div>
              <div className="print-hero__divider" aria-hidden="true" />
              <div className="print-hero__meta">
                <div className="print-hero__meta-item">
                  <small>Código do orçamento: </small>
                  <strong>{codigoOrcamento || '—'}</strong>
                </div>
              </div>
              <div className="print-hero__summary no-break-inside">
                <p>{heroSummary}</p>
                <p>{AVISO_GERAL_ESTIMATIVAS}</p>
                <p>{AVISO_GERAL_ECONOMIA}</p>
                <div className="print-hero__benefits">
                  <p className="print-hero__benefits-title">BENEFÍCIOS SOLARINVEST</p>
                  <ul>
                    <li>
                      <span className="print-hero__benefits-icon" aria-hidden="true">✅</span>
                      <span>Economia imediata desde o primeiro mês</span>
                    </li>
                    <li>
                      <span className="print-hero__benefits-icon" aria-hidden="true">✅</span>
                      <span>Investimento 100% realizado pela SolarInvest</span>
                    </li>
                    <li>
                      <span className="print-hero__benefits-icon" aria-hidden="true">✅</span>
                      <span>Manutenção, seguro e suporte técnico completos</span>
                    </li>
                    <li>
                      <span className="print-hero__benefits-icon" aria-hidden="true">✅</span>
                      <span>Transferência gratuita da usina após {prazoContratualMesesTexto}</span>
                    </li>
                    <li>
                      <span className="print-hero__benefits-icon" aria-hidden="true">✅</span>
                      <span>Economia crescente ao longo dos anos</span>
                    </li>
                    <li>
                      <span className="print-hero__benefits-icon" aria-hidden="true">✅</span>
                      <span>Valorização patrimonial com uma usina própria ao final</span>
                    </li>
                  </ul>
                </div>
                <div className="print-hero__progress" role="img" aria-label="Etapas até a propriedade da usina">
                  <div className="print-hero__progress-step">
                    <span className="print-hero__progress-icon">1</span>
                    <span className="print-hero__progress-label">Assinatura</span>
                  </div>
                  <span className="print-hero__progress-arrow" aria-hidden="true">➜</span>
                  <div className="print-hero__progress-step">
                    <span className="print-hero__progress-icon">2</span>
                    <span className="print-hero__progress-label">Instalação em até 60 dias</span>
                  </div>
                  <span className="print-hero__progress-arrow" aria-hidden="true">➜</span>
                  <div className="print-hero__progress-step">
                    <span className="print-hero__progress-icon">3</span>
                    <span className="print-hero__progress-label">Transferência da usina após 60 meses</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
    
          {resumoCampos.length > 0 ? (
            <section className="print-section keep-together avoid-break">
              <h2 className="section-title keep-with-next">Identificação do Cliente</h2>
              <ClientInfoGrid
                fields={resumoCampos}
                className="print-client-grid no-break-inside"
                fieldClassName="print-client-field"
                wideFieldClassName="print-client-field--wide"
              />
            </section>
          ) : null}

          <section className="print-section keep-together avoid-break">
            <h2 className="section-title keep-with-next">Dados da Instalação</h2>
            <div className="print-uc-details">
              <div className="print-uc-geradora">
                <h3 className="print-uc-heading">UC Geradora</h3>
                <p className="print-uc-text">
                  UC nº {ucGeradoraNumeroLabel} — {ucGeradoraEnderecoLabel}
                </p>
                <p className="print-uc-text">
                  Distribuidora: {distribuidoraLabel || '—'}
                </p>
                {ucGeradoraTitularLabel ? (
                  <p className="print-uc-text">Titular da UC: {ucGeradoraTitularLabel}</p>
                ) : null}
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
            <p className="section-subtitle keep-with-next">
              Tudo o que você precisa saber — de forma simples e transparente.
            </p>
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
            <p className="section-subtitle keep-with-next">Especificações da usina projetada</p>
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
            <p className="muted print-footnote print-footnote--spaced">{AVISO_ESPECIFICACOES}</p>
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
            {avisoMensalidadeCondicoes ? (
              <p className="muted print-footnote print-footnote--spaced">{avisoMensalidadeCondicoes}</p>
            ) : null}
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
              <h2 className="section-title keep-with-next">Economia Gerada com a Solução SolarInvest</h2>
              <p className="section-subtitle keep-with-next">Valores estimados por período contratual</p>
            <table className="no-break-inside leasing-economia-table">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '46%' }} />
                <col style={{ width: '36%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Tarifas (cheia / com desconto)</th>
                  <th className="leasing-table-positive leasing-table-positive-emphasis">
                    Faturas mensais (comparação)
                  </th>
                </tr>
              </thead>
            <tbody>
              {mensalidadesPorAno.map((linha, index) => {
                const isPosPrazo = linha.ano > prazoContratualTotalAnos
                const isUltimaLinha = index === mensalidadesPorAno.length - 1
                const isMensalidadeZero = linha.mensalidadeSolarInvest === 0

                const rowClassName = [
                  isPosPrazo ? 'leasing-row-post-contract' : undefined,
                  isPosPrazo && isUltimaLinha ? 'leasing-row-post-contract--gradient' : undefined,
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <tr key={`mensalidade-${linha.ano}`} className={rowClassName || undefined}>
                    <td>{`${linha.ano}º ano`}</td>
                    <td className="leasing-table-value leasing-table-tariff">
                      <span>
                        <strong>Cheia</strong> {tarifaCurrency(linha.tarifaCheiaAno)}
                      </span>
                      <span>
                        <strong>Com desconto</strong> {tarifaCurrency(linha.tarifaComDesconto)}
                      </span>
                    </td>
                    <td
                      className={[
                        'leasing-table-value',
                        'leasing-table-positive',
                        'leasing-table-positive-emphasis',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="leasing-table-distribuidora">
                        <span className="leasing-table-distribuidora__label">Distribuidora</span>
                        <span className="leasing-table-distribuidora__value">
                          {currency(linha.mensalidadeDistribuidora)}
                        </span>
                      </div>
                      <div className="leasing-table-solarinvest">
                        {isMensalidadeZero ? (
                          <span className="leasing-zero-highlight leasing-table-solarinvest__value">
                            {currency(linha.mensalidadeSolarInvest)}
                          </span>
                        ) : (
                          <span className="leasing-table-solarinvest__value">
                            {currency(linha.mensalidadeSolarInvest)}
                          </span>
                        )}
                        <span className="leasing-table-solarinvest__label">SolarInvest</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
            <div className="leasing-total-summary no-break-inside">
              <h3 className="print-subheading keep-with-next">Despesa Mensal Estimada (Energia + Encargos)</h3>
              {mensalidadesPorAno[0] ? (
                <div className="leasing-total-card">
                  <div className="leasing-total-card__header">
                    <span className="leasing-total-card__label">Referência: 1º ano</span>
                    <span className="leasing-total-card__value">
                      {currency(mensalidadesPorAno[0].despesaMensalEstimada)}
                    </span>
                  </div>
                  <div className="leasing-total-card__details">
                    <div>
                      <span className="leasing-total-card__detail-label">Mensalidade SolarInvest</span>
                      <strong>{currency(mensalidadesPorAno[0].mensalidadeSolarInvest)}</strong>
                    </div>
                    <div>
                      <span className="leasing-total-card__detail-label">
                        Encargos da Distribuidora (projeção)
                      </span>
                      <strong>{currency(mensalidadesPorAno[0].encargosDistribuidora)}</strong>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="muted no-break-inside leasing-encargos-note">
              <p className="leasing-encargos-note__title">
                <strong>Encargos da Distribuidora (Projeção)</strong>
              </p>
              <p>
                Os encargos da distribuidora não são compensados pela geração de energia solar e não estão incluídos na
                Mensalidade Solar, que considera apenas a energia compensada (consumo contratado × tarifa com
                desconto).
              </p>
              <p>
                Esses encargos incluem TUSD Fio B, taxa mínima de disponibilidade e demais encargos regulatórios. Como
                dependem de regras da concessionária, reajustes tarifários, tributos e do consumo real, não é possível
                defini-los com exatidão antecipadamente, sendo apresentados nesta proposta apenas como projeção.
              </p>
              <p>
                Embora sejam cobrados separadamente da mensalidade solar, os encargos são gerenciados pela Solarinvest e
                somados ao valor final, resultando em uma única cobrança mensal ao cliente.
              </p>
            </div>
            {avisoMensalidadeEvolucao ? <p>{avisoMensalidadeEvolucao}</p> : null}
          </section>

          <section
            id="economia-30-anos"
            className="print-section keep-together page-break-before break-after"
          >
            <h2 className="section-title keep-with-next">Análise Financeira da Economia Gerada</h2>
            {economiaProjetadaGrafico.length ? (
              <>
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
                <p className="leasing-chart-note leasing-chart-note--divider no-break-inside">{economiaExplainer}</p>
                <p className="muted print-footnote print-footnote--spaced print-footnote--divider">{AVISO_PATRIMONIO}</p>
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
            <div className="print-important__box no-break-inside">
              <p>
                <strong className="clause-title">1. Operação e Suporte</strong>
                <br />
                Monitoramento, manutenção preventiva e corretiva, limpeza e seguro contra danos elétricos, incêndio, vendaval,
                queda de raio e roubo.
              </p>

              <p>
                <strong className="clause-title">2. Qualidade dos Equipamentos</strong>
                <br />
                Equipamentos certificados pelo INMETRO e instalados conforme normas ANEEL, ABNT e da distribuidora.
              </p>

              <p>
                <strong className="clause-title">3. Disponibilidade de Equipamentos</strong>
                <br />
                Itens indisponíveis poderão ser substituídos por equivalentes ou superiores sem custo adicional.
              </p>

              <p>
                <strong className="clause-title">4. Valores e Simulações</strong>
                <br />
                As estimativas serão formalizadas no contrato após validação técnica.
              </p>

              <p>
                <strong className="clause-title">5. Natureza Estimativa da Proposta</strong>
                <br />
                A proposta pode ser ajustada conforme limitações estruturais, exigências técnicas e fatores externos que influenciem a geração.
              </p>

              <p>
                <strong className="clause-title">6. Instalação e Adequações Técnicas</strong>
                <br />
                Caso necessárias melhorias estruturais, padrão, cabeamento ou obras civis, os custos serão do contratante.
              </p>

              <p>
                <strong className="clause-title">6.1 Condições Técnicas de Geração</strong>
                <br />
                A geração depende de clima, sombreamento, poeira e degradação natural. Não há garantia de geração mensal fixa.
              </p>

              <p>
                <strong className="clause-title">7. Conformidade da Unidade Consumidora (UC)</strong>
                <br />
                A instalação depende da regularização da unidade consumidora e atendimento às normas da distribuidora.
              </p>

              <p>
                <strong className="clause-title">8. Regularização e Titularidade da UC</strong>
                <br />
                O processo junto à distribuidora inicia-se após a regularização da UC e, quando aplicável, atualização da titularidade.
              </p>

              <p>
                <strong className="clause-title">9. Prazo para Ativação do Rateio de Energia</strong>
                <br />
                Em projetos com rateio de energia entre duas ou mais unidades consumidoras, é importante considerar que as unidades beneficiárias
                não passam a receber os créditos de forma imediata. A solicitação de rateio é feita após a homologação do sistema, e a
                concessionária pode levar algum tempo para ativar os créditos em todas as UCs beneficiárias.
              </p>

              <p>
                <strong className="clause-title">10. Ajuste da Energia Contratada (Kc)</strong>
                <br />
                Caso a capacidade real da usina seja diferente da estimada, a energia contratada poderá ser ajustada, mantendo o desconto sobre o kWh.
              </p>

              <p>
                <strong className="clause-title">11. Compra Antecipada (Buyout)</strong>
                <br />
                Disponível a partir do 7º mês, considerando valor de mercado, tempo de uso e pagamentos já realizados.
              </p>

              <p>
                <strong className="clause-title">12. Transferência de Propriedade</strong>
                <br />
                Ao final do contrato, com todas as obrigações quitadas, essa usina será sua — e continuará gerando economia por décadas.
              </p>
            </div>
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
                Com esta proposta, você transforma uma despesa obrigatória em economia real e patrimônio próprio.
              </p>
              <p className="print-final-footer__cta">
                Em apenas 60 meses, essa usina será sua — e continuará gerando economia por décadas.
              </p>
              <p className="print-final-footer__cta">
                Para avançar, basta confirmar seu interesse.
              </p>
              <div className="print-final-footer__signature">
                <div className="signature-line" />
                <span>Assinatura do cliente</span>
                <p className="print-final-footer__signature-note">
                  A assinatura desta proposta representa apenas a intenção de contratar. Este documento não constitui contrato
                  nem gera obrigações firmes para nenhuma das partes.
                </p>
              </div>
            </footer>

            <div className="print-brand-footer no-break-inside">
              <strong>SolarInvest</strong>
              <span>Transformando sua economia mensal em patrimônio real</span>
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
