import React, { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Label, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import './styles/proposal-venda.css'
import { currency, formatCpfCnpj, formatAxis } from '../../utils/formatters'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'
import { usePrintCanvasFallback } from './common/usePrintCanvasFallback'
import { classifyBudgetItem } from '../../utils/moduleDetection'
import { formatMoneyBRWithDigits, formatNumberBRWithOptions, formatPercentBR, formatPercentBRWithDigits } from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { CHART_THEME } from '../../helpers/ChartTheme'

const DEFAULT_CHART_COLORS: Record<'Leasing' | 'Financiamento', string> = {
  Leasing: '#2563EB',
  Financiamento: '#10B981',
}

const chartTheme = CHART_THEME.light

const normalizeObservationKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const OBSERVACAO_PADRAO_REMOVIDA_CHAVE = normalizeObservationKey(
  'Valores estimativos; confirmação no contrato definitivo.',
)

const BENEFICIO_CHART_ANOS = [5, 6, 10, 15, 20, 30]
function PrintableProposalInner(
  props: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    cliente,
    budgetId,
    anos,
    leasingROI,
    financiamentoFluxo,
    financiamentoROI,
    mostrarFinanciamento,
    buyoutResumo,
    capex,
    tipoProposta,
    geracaoMensalKwh,
    potenciaModulo: potenciaModuloProp,
    numeroModulos,
    potenciaInstaladaKwp,
    descontoContratualPct,
    distribuidoraTarifa,
    energiaContratadaKwh,
    tarifaCheia,
    vendaResumo: vendaResumoProp,
    tipoInstalacao,
    parsedPdfVenda,
    orcamentoItens,
    composicaoUfv,
    vendaSnapshot,
    vendasConfigSnapshot,
    valorTotalProposta: valorTotalPropostaProp,
    custoImplantacaoReferencia,
  } = props
  const isVendaDireta = tipoProposta === 'VENDA_DIRETA'
  const vendaResumo = isVendaDireta && vendaResumoProp ? vendaResumoProp : null
  const vendaFormResumo = vendaResumo?.form
  const retornoVenda = vendaResumo?.retorno ?? null
  const snapshotConfig = vendaSnapshot?.configuracao ?? null
  const snapshotResultados = vendaSnapshot?.resultados ?? null
  const snapshotParametros = vendaSnapshot?.parametros ?? null
  const snapshotPagamento = vendaSnapshot?.pagamento ?? null
  const snapshotComposicao = vendaSnapshot?.composicao ?? null
  const formatPercentFromPct = (value?: number, fractionDigits = 2) => {
    if (!Number.isFinite(value)) {
      return '—'
    }
    return formatPercentBRWithDigits((value ?? 0) / 100, fractionDigits)
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
  const formatMeses = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(value ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} meses`
  }
  const formatParcelas = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(value ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} parcelas`
  }
  const isMeaningfulText = (value: string | null | undefined): boolean => {
    if (typeof value !== 'string') {
      return false
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return false
    }
    return trimmed !== '—'
  }
  const normalizeDisplayText = (value: string | null | undefined): string | null =>
    isMeaningfulText(value) ? value?.trim() ?? null : null
  type TableRow = {
    label: string
    value: string
    emphasize?: boolean
    description?: string
    labelAnnotation?: string
  }
  const pushRowIfMeaningful = (
    rows: TableRow[],
    label: string,
    value: string | null | undefined,
    options?: { emphasize?: boolean; description?: string; labelAnnotation?: string },
  ) => {
    const normalized = normalizeDisplayText(value)
    if (normalized) {
      rows.push({ label, value: normalized, ...(options ?? {}) })
    }
  }
  const sanitizeTextField = (value?: string | null) => {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  const observacaoPadraoOriginal = normalizeDisplayText(
    vendasConfigSnapshot?.observacao_padrao_proposta ?? null,
  )
  const observacaoPadrao =
    observacaoPadraoOriginal &&
    normalizeObservationKey(observacaoPadraoOriginal) === OBSERVACAO_PADRAO_REMOVIDA_CHAVE
      ? null
      : observacaoPadraoOriginal
  const pdfConfig = {
    exibirMargem: vendasConfigSnapshot?.exibir_margem ?? false,
    exibirComissao: vendasConfigSnapshot?.exibir_comissao ?? false,
    exibirImpostos: vendasConfigSnapshot?.exibir_impostos ?? false,
    exibirPrecosUnitarios: vendasConfigSnapshot?.exibir_precos_unitarios ?? false,
    mostrarQuebraImpostos: vendasConfigSnapshot?.mostrar_quebra_impostos_no_pdf_cliente ?? false,
    observacaoPadrao,
  }
  const hasNonZero = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > 0
  const valorTotalPropostaNumero = hasNonZero(valorTotalPropostaProp)
    ? Number(valorTotalPropostaProp)
    : null
  let resumoPropostaBreakdown: Array<{ nome: string; aliquota: number; valor: number }> = []
  const pickPositive = (...values: (number | null | undefined)[]): number | null => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value
      }
    }
    return null
  }
  const pickNumeric = (...values: (number | null | undefined)[]): number | null => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Number(value)
      }
    }
    return null
  }
  const parsedPdfResumo = parsedPdfVenda ?? null
  const kitPotenciaInstalada = pickPositive(
    snapshotConfig?.potencia_sistema_kwp,
    vendaFormResumo?.potencia_instalada_kwp,
    parsedPdfResumo?.potencia_instalada_kwp,
    potenciaInstaladaKwp,
  )
  const kitGeracao = pickPositive(
    snapshotConfig?.geracao_estimada_kwh_mes,
    vendaFormResumo?.geracao_estimada_kwh_mes,
    parsedPdfResumo?.geracao_estimada_kwh_mes,
    geracaoMensalKwh,
  )
  const kitConsumo = pickPositive(
    snapshotResultados?.energia_contratada_kwh_mes,
    snapshotParametros?.consumo_kwh_mes,
    vendaFormResumo?.consumo_kwh_mes,
    parsedPdfResumo?.consumo_kwh_mes,
    energiaContratadaKwh,
  )
  const kitQuantidadeModulos = pickPositive(
    snapshotConfig?.n_modulos,
    vendaFormResumo?.quantidade_modulos,
    parsedPdfResumo?.quantidade_modulos,
    numeroModulos,
  )

  const printableBudgetItems = useMemo(() => orcamentoItens ?? [], [orcamentoItens])
  const inverterItems = useMemo(
    () =>
      printableBudgetItems.filter((item) =>
        classifyBudgetItem({
          product: item.produto,
          description: item.descricao,
          quantity: item.quantidade ?? null,
          extra: `${item.modelo ?? ''} ${item.fabricante ?? ''}`,
        }) === 'inverter',
      ),
    [printableBudgetItems],
  )
  const moduleItems = useMemo(
    () =>
      printableBudgetItems.filter((item) =>
        classifyBudgetItem({
          product: item.produto,
          description: item.descricao,
          quantity: item.quantidade ?? null,
          extra: `${item.modelo ?? ''} ${item.fabricante ?? ''}`,
        }) === 'module',
      ),
    [printableBudgetItems],
  )

  const sumItemQuantity = (items: typeof printableBudgetItems): number | null => {
    let total = 0
    let hasAny = false
    items.forEach((item) => {
      if (Number.isFinite(item.quantidade) && (item.quantidade ?? 0) > 0) {
        total += Number(item.quantidade)
        hasAny = true
      }
    })
    if (!hasAny) {
      return null
    }
    return total
  }

  const pickFirstText = (...values: (string | null | undefined)[]): string | null => {
    for (const value of values) {
      if (typeof value !== 'string') {
        continue
      }
      const trimmed = value.trim()
      if (trimmed) {
        return trimmed
      }
    }
    return null
  }

  const firstItemText = (
    items: typeof printableBudgetItems,
    extractor: (item: (typeof printableBudgetItems)[number]) => string | null | undefined,
  ): string | null => {
    for (const item of items) {
      const value = extractor(item)
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed) {
          return trimmed
        }
      }
    }
    return null
  }

  const moduleQuantidadeCatalogo = sumItemQuantity(moduleItems)
  const inverterQuantidadeCatalogo = sumItemQuantity(inverterItems)

  const inverterNome = firstItemText(inverterItems, (item) => item.produto || item.descricao)
  const inverterDescricaoCatalogo = firstItemText(
    inverterItems,
    (item) => item.descricao || item.modelo || item.fabricante || item.produto || null,
  )
  const moduleDescricaoCatalogo = firstItemText(
    moduleItems,
    (item) => item.descricao || item.modelo || item.fabricante || item.produto || null,
  )

  const inverterModelo = pickFirstText(
    snapshotConfig?.modelo_inversor,
    vendaFormResumo?.modelo_inversor,
    parsedPdfResumo?.modelo_inversor,
    inverterDescricaoCatalogo,
  )
  const moduleModelo = pickFirstText(
    snapshotConfig?.modelo_modulo,
    vendaFormResumo?.modelo_modulo,
    parsedPdfResumo?.modelo_modulo,
    moduleDescricaoCatalogo,
  )

  const inverterQuantidade = pickPositive(inverterQuantidadeCatalogo)
  const moduleQuantidade = pickPositive(kitQuantidadeModulos, moduleQuantidadeCatalogo)

  const formatEquipmentQuantidade = (valor: number | null, unidade: string) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return null
    }
    return `${formatNumberBRWithOptions(Math.round(valor ?? 0), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} ${unidade}`
  }

  const formatEquipmentDetail = ({
    nome,
    modelo,
    quantidade,
  }: {
    nome: string | null
    modelo: string | null
    quantidade: string | null
  }): string => {
    const partes: string[] = []
    if (isMeaningfulText(nome)) {
      partes.push(`Nome: ${nome?.trim()}`)
    }
    if (isMeaningfulText(modelo)) {
      partes.push(`Modelo: ${modelo?.trim()}`)
    }
    if (isMeaningfulText(quantidade)) {
      partes.push(`Quantidade: ${quantidade?.trim()}`)
    }
    if (partes.length === 0) {
      return '—'
    }
    return partes.join(' • ')
  }

  const formatKwpDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(valor ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`
  }

  const potenciaModuloDetalhe = pickPositive(
    snapshotConfig?.potencia_modulo_wp,
    parsedPdfResumo?.potencia_da_placa_wp,
    potenciaModuloProp,
  )
  const formatModuloDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(valor ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} Wp`
  }

  const formatTarifaDetalhe = (valor: number | null) => {
    if (!Number.isFinite(valor) || (valor ?? 0) <= 0) {
      return '—'
    }
    return formatMoneyBRWithDigits(valor ?? 0, 3)
  }

  const tarifaProjeto = pickPositive(
    snapshotParametros?.tarifa_r_kwh,
    vendaFormResumo?.tarifa_cheia_r_kwh,
    parsedPdfResumo?.tarifa_cheia_r_kwh,
    tarifaCheia,
  )

  const autonomiaSnapshotPct =
    typeof snapshotResultados?.autonomia_frac === 'number' && snapshotResultados.autonomia_frac > 0
      ? snapshotResultados.autonomia_frac * 100
      : null
  const autonomiaPct =
    autonomiaSnapshotPct ??
    (kitGeracao && kitConsumo && kitGeracao > 0 && kitConsumo > 0 ? (kitGeracao / kitConsumo) * 100 : null)
  const autonomiaLabel =
    Number.isFinite(autonomiaPct) && (autonomiaPct ?? 0) > 0
      ? formatPercentBRWithDigits((autonomiaPct ?? 0) / 100, 1)
      : '—'

  const inverterNomeLabel = normalizeDisplayText(inverterNome)
  const inverterModeloLabel = normalizeDisplayText(inverterModelo)
  const inverterQuantidadeLabel = formatEquipmentQuantidade(inverterQuantidade, 'inversores')

  const moduleModeloLabel = normalizeDisplayText(moduleModelo)
  const moduleQuantidadeNumero =
    Number.isFinite(moduleQuantidade) && (moduleQuantidade ?? 0) > 0
      ? Math.round(moduleQuantidade ?? 0)
      : null
  const moduleQuantidadeLabel =
    moduleQuantidadeNumero != null
      ? formatNumberBRWithOptions(moduleQuantidadeNumero, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : null
  const moduleDetalhe = (() => {
    if (moduleModeloLabel && moduleQuantidadeLabel) {
      return `${moduleQuantidadeLabel} - ${moduleModeloLabel}`
    }
    if (moduleModeloLabel) {
      return moduleModeloLabel
    }
    return null
  })()

  const energiaSolicitadaLabel = formatKwhMes(kitConsumo ?? undefined)
  const producaoMediaMensalBase = formatKwhMes(kitGeracao ?? undefined)
  const producaoMediaMensalLabel =
    producaoMediaMensalBase !== '—' ? `até ${producaoMediaMensalBase}` : producaoMediaMensalBase
  const detalhamentoCampos = [
    { label: 'Potência do sistema', value: formatKwpDetalhe(kitPotenciaInstalada ?? null) },
    { label: 'Energia solicitada (kWh/mês)', value: energiaSolicitadaLabel },
    { label: 'Capacidade de produção média mensal', value: producaoMediaMensalLabel },
    {
      label: 'Inversores',
      value: formatEquipmentDetail({
        nome: inverterNomeLabel,
        modelo: inverterModeloLabel,
        quantidade: inverterQuantidadeLabel,
      }),
    },
    {
      label: 'Módulos',
      value: moduleDetalhe ?? '—',
    },
    { label: 'Potência dos módulos', value: formatModuloDetalhe(potenciaModuloDetalhe ?? null) },
    { label: 'Tarifa atual (distribuidora)', value: formatTarifaDetalhe(tarifaProjeto ?? null) },
    { label: 'Autonomia (%)', value: autonomiaLabel },
  ].filter((campo) => isMeaningfulText(campo.value))
  const duracaoContratualValida =
    typeof buyoutResumo.duracao === 'number' && Number.isFinite(buyoutResumo.duracao)
  const mostrarDetalhamento = detalhamentoCampos.length > 0
  const distribuidoraTarifaLabel =
    distribuidoraTarifa?.trim() || snapshotParametros?.distribuidora?.trim() || ''
  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : ''
  const codigoOrcamento = budgetId?.trim() || ''
  const emailCliente = cliente.email?.trim() || ''
  const telefoneCliente = cliente.telefone?.trim() || ''
  const ucCliente = cliente.uc?.trim() || ''
  const cidadeCliente = cliente.cidade?.trim() || ''
  const ufCliente = cliente.uf?.trim() || ''
  const enderecoCliente = cliente.endereco?.trim() || ''
  const cidadeUfLabel = cidadeCliente || ufCliente ? `${cidadeCliente || '—'} / ${ufCliente || '—'}` : '—'
  const enderecoLabel = enderecoCliente ? enderecoCliente : cidadeUfLabel
  const clienteCampos: ClientInfoField[] = [
    { label: 'Código do orçamento', value: codigoOrcamento || '—' },
    { label: 'Cliente', value: cliente.nome || '—' },
    { label: 'Documento', value: documentoCliente || '—' },
    { label: 'UC', value: ucCliente || '—' },
    { label: 'Distribuidora', value: distribuidoraTarifaLabel || '—' },
    { label: 'E-mail', value: emailCliente || '—' },
    { label: 'Telefone', value: telefoneCliente || '—' },
    { label: 'Cidade / UF', value: cidadeUfLabel },
    { label: 'Endereço', value: enderecoLabel, wide: true },
  ]
  const descontoResumo =
    !isVendaDireta && Number.isFinite(descontoContratualPct)
      ? formatPercentBR((descontoContratualPct ?? 0) / 100)
      : '—'
  const condicaoFonte =
    (snapshotPagamento?.forma_pagamento as 'AVISTA' | 'PARCELADO' | 'FINANCIAMENTO' | undefined) ??
    vendaFormResumo?.condicao ??
    null
  const condicaoLabel = (() => {
    switch (condicaoFonte) {
      case 'AVISTA':
        return 'À vista'
      case 'PARCELADO':
        return 'Parcelado'
      case 'FINANCIAMENTO':
        return 'Financiamento'
      default:
        return '—'
    }
  })()
  const isCondicaoAvista = condicaoFonte === 'AVISTA'
  const isCondicaoParcelado = condicaoFonte === 'PARCELADO'
  const isCondicaoFinanciamento = condicaoFonte === 'FINANCIAMENTO'
  const modoPagamentoTipo = vendaFormResumo?.modo_pagamento ?? 'PIX'
  const modoPagamentoLabel =
    isCondicaoAvista
      ? modoPagamentoTipo === 'PIX'
        ? 'Pix'
        : modoPagamentoTipo === 'DEBITO'
        ? 'Cartão de débito'
        : 'Cartão de crédito'
      : null
  const formaPagamentoLabel = (() => {
    if (isCondicaoAvista && modoPagamentoLabel) {
      return `${condicaoLabel} • ${modoPagamentoLabel}`
    }
    return condicaoLabel
  })()
  const capexTotalCalculado = (() => {
    let total = 0
    let hasValor = false
    const adicionarValor = (valor: number | null | undefined) => {
      if (hasNonZero(valor)) {
        total += Number(valor)
        hasValor = true
      }
    }
    const valorTotalOrcamento = pickNumeric(
      vendaSnapshot?.orcamento?.valor_total_orcamento,
      composicaoUfv?.valorOrcamento,
    )
    adicionarValor(valorTotalOrcamento)

    if (composicaoUfv) {
      const tipoAtual = composicaoUfv.tipoAtual ?? tipoInstalacao
      const bucket = tipoAtual === 'SOLO' ? composicaoUfv.solo : composicaoUfv.telhado
      Object.values(bucket).forEach((valor) => adicionarValor(valor as number))
    } else if (snapshotComposicao) {
      Object.values(snapshotComposicao).forEach((valor) => adicionarValor(valor as number))
    }

    if (hasValor) {
      return total
    }

    if (hasNonZero(capex)) {
      return Number(capex)
    }

    return null
  })()
  const investimentoCapexLabel = hasNonZero(capexTotalCalculado)
    ? currency(capexTotalCalculado ?? 0)
    : hasNonZero(capex)
    ? currency(capex)
    : '—'
  const valorTotalPropostaPrincipalNumero = isVendaDireta
    ? valorTotalPropostaNumero
    : valorTotalPropostaNumero ??
      (hasNonZero(capexTotalCalculado)
        ? Number(capexTotalCalculado)
        : hasNonZero(capex)
        ? Number(capex)
        : null)
  const valorTotalPropostaLabel =
    valorTotalPropostaPrincipalNumero != null ? currency(valorTotalPropostaPrincipalNumero) : '—'
  const kitValorOrcamentoSnapshot = Number.isFinite(vendaSnapshot?.orcamento?.valor_total_orcamento)
    ? Number(vendaSnapshot?.orcamento?.valor_total_orcamento)
    : null
  const kitValorOrcamentoResumo = Number.isFinite(composicaoUfv?.valorOrcamento)
    ? Number(composicaoUfv?.valorOrcamento)
    : null
  const kitFotovoltaicoValorNumero = hasNonZero(kitValorOrcamentoResumo)
    ? Number(kitValorOrcamentoResumo)
    : hasNonZero(kitValorOrcamentoSnapshot)
    ? Number(kitValorOrcamentoSnapshot)
    : null
  const kitFotovoltaicoLabel =
    kitFotovoltaicoValorNumero != null ? currency(kitFotovoltaicoValorNumero) : '—'
  const kitFotovoltaicoAnnotation =
    '(composto por módulos solares, inversor, estrutura de fixação, cabos, conectores e demais componentes necessários para a instalação completa do sistema)'
  const margemOperacionalNumero = (() => {
    if (composicaoUfv) {
      const tipoResumo = composicaoUfv.tipoAtual ?? tipoInstalacao
      if (tipoResumo === 'SOLO') {
        if (hasNonZero(composicaoUfv.solo.lucroBruto)) {
          return Number(composicaoUfv.solo.lucroBruto)
        }
        if (hasNonZero(composicaoUfv.calculoSolo?.margem_operacional_valor)) {
          return Number(composicaoUfv.calculoSolo?.margem_operacional_valor)
        }
      } else {
        if (hasNonZero(composicaoUfv.telhado.lucroBruto)) {
          return Number(composicaoUfv.telhado.lucroBruto)
        }
        if (hasNonZero(composicaoUfv.calculoTelhado?.margem_operacional_valor)) {
          return Number(composicaoUfv.calculoTelhado?.margem_operacional_valor)
        }
      }
    }

    if (hasNonZero(snapshotComposicao?.margem_operacional_valor)) {
      return Number(snapshotComposicao?.margem_operacional_valor)
    }

    return null
  })()
  const custoTecnicoImplantacaoNumero = (() => {
    const sumValores = (bucket: Record<string, unknown>, keys: string[]): number | null => {
      let total = 0
      let added = false
      keys.forEach((key) => {
        const valor = bucket[key]
        if (typeof valor === 'number' && Number.isFinite(valor) && Math.abs(valor) > 0) {
          total += Number(valor)
          added = true
        }
      })
      return added ? total : null
    }

    if (composicaoUfv) {
      const tipoResumo = composicaoUfv.tipoAtual ?? tipoInstalacao
      const baseKeys = ['projeto', 'instalacao', 'materialCa', 'crea', 'art', 'placa']
      if (tipoResumo === 'SOLO') {
        const bucket = composicaoUfv.solo as Record<string, unknown>
        const total = sumValores(bucket, [
          ...baseKeys,
          'estruturaSolo',
          'tela',
          'portaoTela',
          'maoObraTela',
          'casaInversor',
          'brita',
          'terraplanagem',
          'trafo',
          'rede',
          'outros',
        ])
        if (total != null) {
          return total
        }
      } else {
        const bucket = composicaoUfv.telhado as Record<string, unknown>
        const total = sumValores(bucket, baseKeys)
        if (total != null) {
          return total
        }
      }
    }

    if (hasNonZero(custoImplantacaoReferencia)) {
      return Number(custoImplantacaoReferencia)
    }

    if (hasNonZero(snapshotComposicao?.capex_total)) {
      return Number(snapshotComposicao?.capex_total)
    }

    return null
  })()
  const valorIntegradoSistemaNumero = (() => {
    const valores = [
      custoTecnicoImplantacaoNumero,
      margemOperacionalNumero,
    ].filter((valor): valor is number => typeof valor === 'number' && Number.isFinite(valor))
    if (valores.length === 0) {
      return null
    }
    return valores.reduce((total, valor) => total + valor, 0)
  })()
  const valorIntegradoSistemaLabel =
    valorIntegradoSistemaNumero != null ? currency(valorIntegradoSistemaNumero) : '—'
  const valorIntegradoSistemaDescricao =
    '(engloba custos de engenharia, aquisição e logística dos equipamentos, instalação e implementação completa, impostos, seguros, suporte técnico, manutenção inicial e margem operacional)'
  const inflacaoResumo = formatPercentFromPct(
    snapshotParametros?.inflacao_energia_aa ?? vendaFormResumo?.inflacao_energia_aa_pct,
  )
  const taxaMinimaResumo = Number.isFinite(snapshotParametros?.taxa_minima_rs_mes)
    ? currency(snapshotParametros?.taxa_minima_rs_mes ?? 0)
    : Number.isFinite(vendaFormResumo?.taxa_minima_mensal)
    ? currency(vendaFormResumo?.taxa_minima_mensal ?? 0)
    : '—'
  const iluminacaoPublicaResumo = Number.isFinite(vendaFormResumo?.taxa_minima_r_mes)
    ? currency(vendaFormResumo?.taxa_minima_r_mes ?? 0)
    : '—'
  const horizonteAnaliseResumo = formatMeses(snapshotParametros?.horizonte_meses ?? vendaFormResumo?.horizonte_meses)
  const parcelasResumo = formatParcelas(vendaFormResumo?.n_parcelas)
  const jurosCartaoAmResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_am_pct)
  const jurosCartaoAaResumo = formatPercentFromPct(vendaFormResumo?.juros_cartao_aa_pct)
  const mdrPixValor = pickNumeric(snapshotPagamento?.mdr_pix, vendaFormResumo?.taxa_mdr_pix_pct)
  const mdrDebitoValor = pickNumeric(snapshotPagamento?.mdr_debito, vendaFormResumo?.taxa_mdr_debito_pct)
  const mdrCreditoVistaValor = pickNumeric(snapshotPagamento?.mdr_credito_avista, vendaFormResumo?.taxa_mdr_credito_vista_pct)
  const mdrCreditoParceladoValor = pickNumeric(vendaFormResumo?.taxa_mdr_credito_parcelado_pct)
  const mdrPixLabel = hasNonZero(mdrPixValor) ? formatPercentFromPct(mdrPixValor) : null
  const mdrDebitoLabel = hasNonZero(mdrDebitoValor) ? formatPercentFromPct(mdrDebitoValor) : null
  const mdrCreditoVistaLabel = hasNonZero(mdrCreditoVistaValor)
    ? formatPercentFromPct(mdrCreditoVistaValor)
    : null
  const mdrCreditoParceladoLabel = hasNonZero(mdrCreditoParceladoValor)
    ? formatPercentFromPct(mdrCreditoParceladoValor)
    : null
  const encargosFinanceirosLabel = (() => {
    const partes: string[] = []
    if (isCondicaoAvista) {
      if (mdrPixLabel) {
        partes.push(`Pix: ${mdrPixLabel}`)
      }
      if (mdrDebitoLabel) {
        partes.push(`Débito: ${mdrDebitoLabel}`)
      }
      if (mdrCreditoVistaLabel) {
        partes.push(`Crédito à vista: ${mdrCreditoVistaLabel}`)
      }
    } else if (isCondicaoParcelado) {
      if (mdrCreditoParceladoLabel) {
        partes.push(`Crédito parcelado: ${mdrCreditoParceladoLabel}`)
      }
    }
    if (partes.length === 0) {
      return null
    }
    return partes.join(' | ')
  })()
  const entradaResumo = Number.isFinite(vendaFormResumo?.entrada_financiamento)
    ? currency(vendaFormResumo?.entrada_financiamento ?? 0)
    : '—'
  const parcelasFinResumo = formatParcelas(vendaFormResumo?.n_parcelas_fin)
  const jurosFinAmResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_am_pct)
  const jurosFinAaResumo = formatPercentFromPct(vendaFormResumo?.juros_fin_aa_pct)
  const paybackValor = snapshotResultados?.payback_meses ?? retornoVenda?.payback ?? null
  const paybackLabelResumo =
    Number.isFinite(paybackValor) && (paybackValor ?? 0) > 0
      ? `${Math.round(paybackValor ?? 0)} meses`
      : 'Não atingido em 30 anos'
  const roiValor = snapshotResultados?.roi_acumulado_30a ?? retornoVenda?.roi ?? null
  const roiLabelResumo = Number.isFinite(roiValor)
    ? new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(roiValor ?? 0)
    : '—'
  const vplResumo = typeof retornoVenda?.vpl === 'number' ? currency(retornoVenda.vpl) : '—'
  const roiHorizonteResumo = isVendaDireta
    ? '30 anos'
    : Number.isFinite(vendaFormResumo?.horizonte_meses) && (vendaFormResumo?.horizonte_meses ?? 0) > 0
    ? `${Math.round(vendaFormResumo?.horizonte_meses ?? 0)} meses`
    : 'horizonte analisado'
  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  validadeData.setDate(validadeData.getDate() + 3)
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const validadePropostaLabel =
    sanitizeTextField(snapshotPagamento?.validade_proposta_txt) ??
    sanitizeTextField(vendaFormResumo?.validade_proposta) ??
    `${validadeTexto} (3 dias corridos)`
  const prazoExecucaoLabel =
    sanitizeTextField(snapshotPagamento?.prazo_execucao_txt) ??
    sanitizeTextField(vendaFormResumo?.prazo_execucao) ??
    'Até 30 dias úteis após a assinatura do contrato e entrega integral do material'
  const condicoesAdicionaisLabel =
    sanitizeTextField(snapshotPagamento?.condicoes_adicionais_txt) ??
    sanitizeTextField(vendaFormResumo?.condicoes_adicionais) ??
    '—'
  const condicoesPagamentoRows: TableRow[] = []
  pushRowIfMeaningful(condicoesPagamentoRows, 'Forma de pagamento', formaPagamentoLabel)
  if (!isVendaDireta) {
    pushRowIfMeaningful(condicoesPagamentoRows, 'Investimento total (CAPEX)', investimentoCapexLabel)
  }
  pushRowIfMeaningful(condicoesPagamentoRows, 'Validade da proposta', validadePropostaLabel)
  pushRowIfMeaningful(condicoesPagamentoRows, 'Prazo de execução', prazoExecucaoLabel)
  pushRowIfMeaningful(condicoesPagamentoRows, 'Encargos financeiros (MDR)', encargosFinanceirosLabel ?? undefined)
  pushRowIfMeaningful(condicoesPagamentoRows, 'Condições adicionais', condicoesAdicionaisLabel)
  pushRowIfMeaningful(condicoesPagamentoRows, 'Kit fotovoltaico', kitFotovoltaicoLabel, {
    labelAnnotation: kitFotovoltaicoAnnotation,
  })
  pushRowIfMeaningful(
    condicoesPagamentoRows,
    'Valor Integrado do Sistema',
    valorIntegradoSistemaLabel,
    { description: valorIntegradoSistemaDescricao },
  )
  pushRowIfMeaningful(condicoesPagamentoRows, 'Valor final', valorTotalPropostaLabel, { emphasize: true })
  const condicoesParceladoRows: TableRow[] = []
  if (!isVendaDireta && isCondicaoParcelado) {
    pushRowIfMeaningful(condicoesParceladoRows, 'Número de parcelas', parcelasResumo)
    pushRowIfMeaningful(condicoesParceladoRows, 'Juros do cartão (% a.m.)', jurosCartaoAmResumo)
    pushRowIfMeaningful(condicoesParceladoRows, 'Juros do cartão (% a.a.)', jurosCartaoAaResumo)
  }
  const condicoesFinanciamentoRows: TableRow[] = []
  if (!isVendaDireta && isCondicaoFinanciamento) {
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Entrada', entradaResumo)
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Número de parcelas', parcelasFinResumo)
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Juros do financiamento (% a.m.)', jurosFinAmResumo)
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Juros do financiamento (% a.a.)', jurosFinAaResumo)
  }
  const parametrosEconomiaRows: TableRow[] = []
  pushRowIfMeaningful(parametrosEconomiaRows, 'Inflação de energia estimada (a.a.)', inflacaoResumo)
  pushRowIfMeaningful(
    parametrosEconomiaRows,
    'Custos Fixos da Conta de Energia (CID, TUSD, encargos setoriais e subsídio, tributos e outros)',
    taxaMinimaResumo,
  )
  pushRowIfMeaningful(parametrosEconomiaRows, 'Iluminação pública', iluminacaoPublicaResumo)
  if (!isVendaDireta) {
    pushRowIfMeaningful(parametrosEconomiaRows, 'Horizonte de análise', horizonteAnaliseResumo)
  }
  const mostrarCondicoesPagamento = condicoesPagamentoRows.length > 0
  const mostrarCondicoesParcelado = condicoesParceladoRows.length > 0
  const mostrarCondicoesFinanciamento = condicoesFinanciamentoRows.length > 0
  const mostrarParametrosEconomia = parametrosEconomiaRows.length > 0
  const temAlgumaCondicao =
    mostrarCondicoesPagamento || mostrarCondicoesParcelado || mostrarCondicoesFinanciamento || mostrarParametrosEconomia
  const totalCondicoesLinhas =
    condicoesPagamentoRows.length + condicoesParceladoRows.length + condicoesFinanciamentoRows.length
  const mostrarTabelaCondicoes = totalCondicoesLinhas > 0
  const heroTitle = isVendaDireta ? 'Proposta de Venda Solar' : 'Proposta de Leasing Solar'
  const heroTagline = isVendaDireta
    ? 'Energia inteligente, patrimônio garantido'
    : 'Energia inteligente, sem desembolso'
  const heroSummaryDescription = isVendaDireta
    ? 'Apresentamos sua proposta personalizada de aquisição da usina fotovoltaica SolarInvest. Nesta modalidade de venda, você investe no sistema, torna-se proprietário desde o primeiro dia e captura 100% da economia gerada, aumentando a previsibilidade de custos e o valor do seu imóvel.'
    : 'Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest. Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para você, tornando-se um patrimônio durável, valorizando seu imóvel.'
  const chartEconomiaIntro = isVendaDireta
    ? 'Retorno que cresce ano após ano.'
    : 'Economia que cresce ano após ano.'
  const chartExplainerContext = isVendaDireta
    ? 'O investimento considera os reajustes anuais de energia, a vida útil projetada dos equipamentos e a propriedade integral do ativo desde o primeiro dia.'
    : 'Essa trajetória considera os reajustes anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.'
  const chartFootnoteText = isVendaDireta
    ? 'Como proprietário do sistema, toda a economia permanece com o cliente ao longo da vida útil do projeto.'
    : 'Após o final do contrato a usina passa a render 100% de economia frente à concessionária para o cliente.'
  const chartPrimaryLabel = isVendaDireta ? 'Venda' : 'Leasing SolarInvest'

  const chartDataPrintable = useMemo(() => {
    const anosDisponiveis = new Set(anos)

    return BENEFICIO_CHART_ANOS.filter((ano) => anosDisponiveis.has(ano)).map((ano) => ({
      ano,
      Leasing: leasingROI[ano - 1] ?? 0,
      Financiamento: financiamentoROI[ano - 1] ?? 0,
    }))
  }, [anos, financiamentoROI, leasingROI])
  const beneficioMarcos = useMemo(
    () =>
      BENEFICIO_CHART_ANOS.map((ano) => {
        const dadosAno = chartDataPrintable.find((row) => row.ano === ano)
        if (!dadosAno) {
          return null
        }
        return {
          ano,
          Leasing: dadosAno.Leasing,
          Financiamento: dadosAno.Financiamento,
        }
      }).filter((row): row is { ano: number; Leasing: number; Financiamento: number } => row !== null),
    [chartDataPrintable],
  )
  const chartPrintableDomain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    chartDataPrintable.forEach((row) => {
      const valores = [row.Leasing]
      if (mostrarFinanciamento) {
        valores.push(row.Financiamento)
      }

      valores.forEach((valor) => {
        if (Number.isFinite(valor)) {
          min = Math.min(min, valor)
          max = Math.max(max, valor)
        }
      })
    })

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: -1, max: 1 }
    }

    min = Math.min(min, 0)
    max = Math.max(max, 0)

    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.25, 1)
      return { min: min - padding, max: max + padding }
    }

    const range = max - min
    const padding = range * 0.12

    return {
      min: min - padding,
      max: max + padding,
    }
  }, [chartDataPrintable, mostrarFinanciamento])

  const beneficioAno30Printable = useMemo(
    () => chartDataPrintable.find((row) => row.ano === 30) ?? null,
    [chartDataPrintable],
  )
  usePrintCanvasFallback('#economia-30-anos')
  return (
    <div ref={ref} className="print-layout print-layout--venda">
      <section className="venda-print__page venda-print__page--cover">
        <header className="venda-print__header">
          <div className="venda-print__brand">
            <img src="/logo.svg" alt="SolarInvest" className="venda-print__logo" />
            <div className="venda-print__heading">
              <span className="venda-print__eyebrow">SolarInvest</span>
              <h1>{heroTitle}</h1>
              <p className="venda-print__tagline">{heroTagline}</p>
            </div>
          </div>
        </header>

        <div className="venda-print__section venda-print__section--summary">
          <h2>Sumário executivo</h2>
          <p>{heroSummaryDescription}</p>
        </div>

        {isVendaDireta ? (
          <div className="venda-print__highlight">
            <span className="venda-print__highlight-label">Valor final da proposta</span>
            <strong>{valorTotalPropostaLabel}</strong>
            <p className="venda-print__highlight-note">
              O valor total da proposta representa o preço final de compra da usina, incluindo equipamentos, instalação,
              documentação, garantia e suporte técnico.
            </p>
          </div>
        ) : null}

        <div className="venda-print__section">
          <h2>Dados do cliente</h2>
          <ClientInfoGrid
            fields={clienteCampos}
            className="venda-print__info-grid"
            fieldClassName="venda-print__info-item"
            wideFieldClassName="venda-print__info-item--wide"
          />
        </div>
      </section>

      <section className="venda-print__page">
        {mostrarDetalhamento ? (
          <div className="venda-print__section">
            <h2>Resumo técnico do projeto</h2>
            <table className="venda-print__table venda-print__table--striped">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor / descrição</th>
                </tr>
              </thead>
              <tbody>
                {detalhamentoCampos.map((campo) => (
                  <tr key={campo.label}>
                    <td>{campo.label}</td>
                    <td>{campo.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isVendaDireta ? (
          <div id="resumo-proposta" className="venda-print__section">
            <h2>Resumo de custos e investimento</h2>
            <table className="venda-print__table venda-print__table--striped">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor / descrição</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  type Row = { key: string; label: string; valor: number; emphasize?: boolean }
                  const rows: Row[] = []
                  const addRow = (key: string, label: string, valor: number | null | undefined, emphasize = false) => {
                    if (!Number.isFinite(valor)) {
                      return
                    }
                    const numero = Number(valor)
                    if (Math.abs(numero) <= 0.0001) {
                      return
                    }
                    rows.push({ key, label, valor: numero, emphasize })
                  }
                  const addTotalRow = (key: string, label: string, valor: number | null | undefined) => {
                    if (!Number.isFinite(valor)) {
                      return
                    }
                    const numero = Number(valor)
                    if (Math.abs(numero) <= 0.0001) {
                      return
                    }
                    rows.push({ key, label, valor: numero, emphasize: true })
                  }

                  if (snapshotComposicao) {
                    const kitValor = Number.isFinite(snapshotComposicao.kit_fotovoltaico_total)
                      ? Number(snapshotComposicao.kit_fotovoltaico_total)
                      : kitFotovoltaicoValorNumero ?? 0

                    if (kitValor > 0) {
                      addRow('kit', 'Kit Fotovoltaico', kitValor)
                    }

                    const custosDiretos = snapshotComposicao.custos_diretos ?? []
                    for (const item of custosDiretos) {
                      addRow(`direto-${item.nome}`, item.nome ?? 'Item', item.valor)
                    }

                    const custoImplantacao = Number.isFinite(snapshotComposicao.custo_implantacao)
                      ? Number(snapshotComposicao.custo_implantacao)
                      : Number.isFinite(custoImplantacaoReferencia)
                      ? Number(custoImplantacaoReferencia)
                      : null
                    addRow('implantacao', 'Custo de implantação', custoImplantacao ?? undefined)

                    if (pdfConfig.exibirComissao) {
                      addRow('comissao', 'Comissão líquida', snapshotComposicao.comissao_liquida_valor)
                    }
                    if (pdfConfig.exibirMargem) {
                      addRow('margem', 'Margem operacional', snapshotComposicao.margem_operacional_valor)
                    }
                    if (pdfConfig.exibirImpostos) {
                      addRow('imposto-retido', 'Imposto retido', snapshotComposicao.imposto_retido_valor)
                      addRow('impostos-regime', 'Impostos do regime', snapshotComposicao.impostos_regime_valor)
                      addRow('impostos-totais', 'Impostos totais', snapshotComposicao.impostos_totais_valor)
                    }

                    addRow('capex-total', 'CAPEX considerado (sem kit)', snapshotComposicao.capex_total)

                    resumoPropostaBreakdown =
                      pdfConfig.exibirImpostos && pdfConfig.mostrarQuebraImpostos
                        ? (snapshotComposicao.regime_breakdown ?? []).map((item) => ({ ...item }))
                        : []

                    const vendaTotal = Number.isFinite(snapshotComposicao.venda_total)
                      ? Number(snapshotComposicao.venda_total)
                      : null
                    const vendaLiquida = Number.isFinite(snapshotComposicao.venda_liquida)
                      ? Number(snapshotComposicao.venda_liquida)
                      : null
                    const totalBruto = vendaTotal != null ? kitValor + vendaTotal : null
                    const totalLiquido = vendaLiquida != null ? kitValor + vendaLiquida : null

                    if (totalBruto != null && totalBruto > 0) {
                      addTotalRow('total-bruto', 'Total do contrato (bruto)', totalBruto)
                    }
                    if (
                      totalLiquido != null &&
                      totalLiquido > 0 &&
                      (totalBruto == null || Math.abs(totalLiquido - totalBruto) > 0.01)
                    ) {
                      addTotalRow('total-liquido', 'Total do contrato (líquido)', totalLiquido)
                    }

                    return rows.map((row) => (
                      <tr key={row.key} className={row.emphasize ? 'venda-print__row--total' : undefined}>
                        <td>{row.label}</td>
                        <td className="venda-print__cell--numeric">{currency(row.valor)}</td>
                      </tr>
                    ))
                  }

                  const composicaoAtual = composicaoUfv ?? null
                  if (!composicaoAtual) {
                    return [
                      <tr key="total-capex">
                        <td>Investimento total do projeto</td>
                        <td className="venda-print__cell--numeric">—</td>
                      </tr>,
                    ]
                  }

                  const tipoResumo = composicaoAtual.tipoAtual ?? tipoInstalacao
                  const kitValor = (() => {
                    if (kitFotovoltaicoValorNumero != null) {
                      return kitFotovoltaicoValorNumero
                    }
                    if (Number.isFinite(kitValorOrcamentoResumo) && (kitValorOrcamentoResumo ?? 0) > 0) {
                      return Number(kitValorOrcamentoResumo)
                    }
                    if (Number.isFinite(kitValorOrcamentoSnapshot) && (kitValorOrcamentoSnapshot ?? 0) > 0) {
                      return Number(kitValorOrcamentoSnapshot)
                    }
                    return 0
                  })()
                  if (kitValor > 0) {
                    addRow('kit', 'Kit Fotovoltaico', kitValor)
                  }

                  const pushDireto = (key: string, label: string, valor: number | null | undefined) => {
                    if (Number.isFinite(valor) && (valor ?? 0) > 0) {
                      addRow(`direto-${key}`, label, Number(valor))
                    }
                  }

                  if (tipoResumo === 'TELHADO') {
                    const telhadoValores = composicaoAtual.telhado
                    pushDireto('projeto', 'Projeto', telhadoValores?.projeto)
                    pushDireto('instalacao', 'Instalação', telhadoValores?.instalacao)
                    pushDireto('material-ca', 'Material CA', telhadoValores?.materialCa)
                    pushDireto('art', 'ART', (telhadoValores as { art?: number })?.art ?? null)
                    pushDireto('crea', 'CREA', telhadoValores?.crea)
                    pushDireto('placa', 'Placa', telhadoValores?.placa)
                  } else {
                    const soloValores = composicaoAtual.solo
                    pushDireto('projeto', 'Projeto', soloValores?.projeto)
                    pushDireto('instalacao', 'Instalação', soloValores?.instalacao)
                    pushDireto('material-ca', 'Material CA', soloValores?.materialCa)
                    pushDireto('art', 'ART', (soloValores as { art?: number })?.art ?? null)
                    pushDireto('crea', 'CREA', soloValores?.crea)
                    pushDireto('placa', 'Placa', soloValores?.placa)
                    pushDireto('tela', 'Tela', soloValores?.tela)
                    pushDireto('mao-obra-tela', 'Mão de obra - tela', soloValores?.maoObraTela)
                    pushDireto('portao-tela', 'Portão - tela', soloValores?.portaoTela)
                    pushDireto('casa-inversor', 'Casa do inversor', soloValores?.casaInversor)
                    pushDireto('trafo', 'Transformador', soloValores?.trafo)
                    pushDireto('brita', 'Brita', soloValores?.brita)
                    pushDireto('terraplanagem', 'Terraplanagem', soloValores?.terraplanagem)
                  }

                  const resumoCalculo =
                    tipoResumo === 'TELHADO' ? composicaoAtual.calculoTelhado : composicaoAtual.calculoSolo
                  const descontosConfiguracao = Number.isFinite(composicaoAtual.configuracao?.descontos)
                    ? Number(composicaoAtual.configuracao?.descontos)
                    : 0

                  if (resumoCalculo) {
                    addRow('capex-base', 'CAPEX base', resumoCalculo.capex_base)
                    if (pdfConfig.exibirComissao) {
                      addRow('comissao', 'Comissão líquida', resumoCalculo.comissao_liquida_valor)
                    }
                    if (pdfConfig.exibirMargem) {
                      addRow('margem', 'Margem operacional', resumoCalculo.margem_operacional_valor)
                    }
                    if (pdfConfig.exibirImpostos) {
                      addRow('imposto-retido', 'Imposto retido', resumoCalculo.imposto_retido_valor)
                      addRow('impostos-regime', 'Impostos do regime', resumoCalculo.impostos_regime_valor)
                      addRow('impostos-totais', 'Impostos totais', resumoCalculo.impostos_totais_valor)
                    }
                    addRow('capex-total', 'CAPEX considerado (sem kit)', resumoCalculo.capex_total)

                    const vendaTotal = Number.isFinite(resumoCalculo.venda_total)
                      ? Number(resumoCalculo.venda_total)
                      : null
                    const vendaLiquida = Number.isFinite(resumoCalculo.venda_liquida)
                      ? Number(resumoCalculo.venda_liquida)
                      : vendaTotal != null
                      ? vendaTotal - descontosConfiguracao
                      : null
                    if (descontosConfiguracao > 0) {
                      addRow('descontos', 'Descontos comerciais', -descontosConfiguracao)
                    }

                    resumoPropostaBreakdown =
                      pdfConfig.exibirImpostos && pdfConfig.mostrarQuebraImpostos
                        ? (resumoCalculo.regime_breakdown ?? []).map((item) => ({ ...item }))
                        : []

                    const totalBruto = vendaTotal != null ? kitValor + vendaTotal : null
                    if (totalBruto != null && totalBruto > 0) {
                      addTotalRow('total-bruto', 'Total do contrato (bruto)', totalBruto)
                    }

                    const totalLiquido = vendaLiquida != null ? kitValor + vendaLiquida : null
                    if (
                      totalLiquido != null &&
                      totalLiquido > 0 &&
                      (totalBruto == null || Math.abs(totalLiquido - totalBruto) > 0.01)
                    ) {
                      addTotalRow('total-liquido', 'Total do contrato (líquido)', totalLiquido)
                    }

                    return rows.map((row) => (
                      <tr key={row.key} className={row.emphasize ? 'venda-print__row--total' : undefined}>
                        <td>{row.label}</td>
                        <td className="venda-print__cell--numeric">{currency(row.valor)}</td>
                      </tr>
                    ))
                  }

                  if (descontosConfiguracao > 0) {
                    addRow('descontos', 'Descontos comerciais', -descontosConfiguracao)
                  }

                  resumoPropostaBreakdown = []

                  return rows.length
                    ? rows.map((row) => (
                        <tr key={row.key} className={row.emphasize ? 'venda-print__row--total' : undefined}>
                          <td>{row.label}</td>
                          <td className="venda-print__cell--numeric">{currency(row.valor)}</td>
                        </tr>
                      ))
                    : [
                        <tr key="total-capex">
                          <td>Investimento total do projeto</td>
                          <td className="venda-print__cell--numeric">—</td>
                        </tr>,
                      ]
                })()}
              </tbody>
            </table>
            {pdfConfig.exibirImpostos && pdfConfig.mostrarQuebraImpostos && resumoPropostaBreakdown.length ? (
              <table className="venda-print__table venda-print__table--striped venda-print__table--compact">
                <thead>
                  <tr>
                    <th>Imposto</th>
                    <th>Alíquota</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoPropostaBreakdown.map((item) => (
                    <tr key={`breakdown-${item.nome}`}>
                      <td>{item.nome}</td>
                      <td className="venda-print__cell--numeric">
                        {formatPercentBRWithDigits((item.aliquota ?? 0) / 100, 2)}
                      </td>
                      <td className="venda-print__cell--numeric">{currency(item.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : null}
      </section>

      {isVendaDireta ? (
        <section className="venda-print__page">
          <div id="condicoes-comerciais" className="venda-print__section">
            <h2>Condições comerciais e de pagamento</h2>
            {snapshotPagamento || vendaFormResumo ? (
              temAlgumaCondicao ? (
                <>
                  {mostrarParametrosEconomia ? (
                    <div className="venda-print__subsection">
                      <h3>Parâmetros de economia</h3>
                      <table className="venda-print__table venda-print__table--striped">
                        <thead>
                          <tr>
                            <th>Parâmetro</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parametrosEconomiaRows.map((row) => (
                            <tr key={`parametro-economia-${row.label}`}>
                              <td>{row.label}</td>
                              <td className="venda-print__cell--numeric">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {mostrarTabelaCondicoes ? (
                    <div className="venda-print__subsection">
                      <h3>Detalhes da proposta</h3>
                      <table className="venda-print__table venda-print__table--striped">
                        <thead>
                          <tr>
                            <th>Parâmetro</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {condicoesPagamentoRows.map((row) => (
                            <tr key={`condicao-geral-${row.label}`}>
                              <td className={row.emphasize ? 'print-table__cell--emphasis' : undefined}>
                                <span
                                  className={`print-table__label-text${
                                    row.labelAnnotation ? ' print-table__label-text--annotated' : ''
                                  }`}
                                >
                                  {row.emphasize ? <strong>{row.label}</strong> : row.label}
                                  {row.labelAnnotation ? (
                                    <span className="print-table__label-annotation">{row.labelAnnotation}</span>
                                  ) : null}
                                </span>
                                {row.description ? (
                                  <span className="print-table__description">{row.description}</span>
                                ) : null}
                              </td>
                              <td className={`venda-print__cell--numeric${row.emphasize ? ' venda-print__cell--total' : ''}`}>
                                {row.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="venda-print__muted">
                  Preencha as condições de pagamento na aba Vendas para exibir os detalhes nesta proposta.
                </p>
              )
            ) : (
              <p className="venda-print__muted">
                Preencha as condições de pagamento na aba Vendas para exibir os detalhes nesta proposta.
              </p>
            )}
          </div>

          <div id="condicoes-financeiras" className="venda-print__section">
            <h2>Retorno financeiro (venda)</h2>
            {snapshotResultados || retornoVenda ? (
              <div className="venda-print__kpi-grid">
                <div className="venda-print__kpi">
                  <span>Payback estimado</span>
                  <strong>{paybackLabelResumo}</strong>
                </div>
                <div className="venda-print__kpi">
                  <span>ROI acumulado ({roiHorizonteResumo})</span>
                  <strong>{roiLabelResumo}</strong>
                </div>
                {typeof retornoVenda?.vpl === 'number' ? (
                  <div className="venda-print__kpi">
                    <span>VPL</span>
                    <strong>{vplResumo}</strong>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="venda-print__muted">
                Informe os parâmetros financeiros na aba Vendas para calcular o retorno projetado.
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section className="venda-print__page venda-print__page--closing">
        <div id="economia-30-anos" className="venda-print__section venda-print__section--chart">
          <h2>{isVendaDireta ? 'Retorno projetado (30 anos)' : 'Economia projetada (30 anos)'}</h2>
          <div className="venda-print__chart-container no-break-inside">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={chartDataPrintable} margin={{ top: 5, right: 6, bottom: 7, left: 6 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  stroke={chartTheme.grid}
                  tickFormatter={formatAxis}
                  tick={{ fill: chartTheme.tick, fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: chartTheme.grid, strokeWidth: 1 }}
                  tickLine={false}
                  domain={[chartPrintableDomain.min, chartPrintableDomain.max]}
                >
                  <Label
                    value="Benefício acumulado (R$)"
                    position="insideBottom"
                    offset={-20}
                    style={{ fill: chartTheme.legend, fontSize: 12, fontWeight: 600 }}
                  />
                </XAxis>
                <YAxis
                  type="category"
                  dataKey="ano"
                  stroke={chartTheme.grid}
                  tick={{ fill: chartTheme.tick, fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: chartTheme.grid, strokeWidth: 1 }}
                  tickLine={false}
                  width={120}
                  tickFormatter={(valor) => `${valor}º ano`}
                />
                <Tooltip
                  formatter={(value: number) => currency(Number(value))}
                  labelFormatter={(value) => `${value}º ano`}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: chartTheme.tooltipBg,
                    color: chartTheme.tooltipText,
                    padding: 12,
                  }}
                  itemStyle={{ color: chartTheme.tooltipText }}
                  labelStyle={{ color: chartTheme.tooltipText }}
                  wrapperStyle={{ zIndex: 1000 }}
                />
                {mostrarFinanciamento ? (
                  <Legend
                    verticalAlign="top"
                    align="left"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: 12, color: chartTheme.legend }}
                    payload={[
                      {
                        id: 'Financiamento',
                        value: 'Financiamento SolarInvest',
                        type: 'circle',
                        color: DEFAULT_CHART_COLORS.Financiamento,
                      },
                    ]}
                  />
                ) : null}
                <ReferenceLine x={0} stroke={chartTheme.grid} strokeDasharray="4 4" strokeWidth={1} />
                <Bar
                  dataKey="Leasing"
                  fill={DEFAULT_CHART_COLORS.Leasing}
                  barSize={14}
                  radius={[0, 8, 8, 0]}
                  isAnimationActive={false}
                  name={chartPrimaryLabel}
                >
                  <LabelList
                    dataKey="Leasing"
                    position="right"
                    formatter={(value: number) => currency(Number(value))}
                    fill={DEFAULT_CHART_COLORS.Leasing}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
                {mostrarFinanciamento ? (
                  <Bar
                    dataKey="Financiamento"
                    fill={DEFAULT_CHART_COLORS.Financiamento}
                    barSize={14}
                    radius={[0, 8, 8, 0]}
                    isAnimationActive={false}
                    name="Financiamento SolarInvest"
                  >
                    <LabelList
                      dataKey="Financiamento"
                      position="right"
                      formatter={(value: number) => currency(Number(value))}
                      fill={DEFAULT_CHART_COLORS.Financiamento}
                      style={{ fontSize: 12, fontWeight: 600 }}
                    />
                  </Bar>
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!isVendaDireta && beneficioMarcos.length ? (
            <ul className="print-chart-highlights no-break-inside">
              {beneficioMarcos.map((marco) => (
                <li key={`beneficio-marco-resumo-${marco.ano}`}>
                  <span className="print-chart-highlights__year">{marco.ano}º ano</span>
                  <div className="print-chart-highlights__values">
                    <span className="print-chart-highlights__value" style={{ color: DEFAULT_CHART_COLORS.Leasing }}>
                      {chartPrimaryLabel}: {currency(marco.Leasing)}
                    </span>
                    {mostrarFinanciamento ? (
                      <span className="print-chart-highlights__value" style={{ color: DEFAULT_CHART_COLORS.Financiamento }}>
                        Financiamento: {currency(marco.Financiamento)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {!isVendaDireta && beneficioAno30Printable ? (
            <p className="chart-explainer no-break-inside">
              <strong>{chartEconomiaIntro}</strong>{' '}
              Em <strong>30 anos</strong>, a SolarInvest projeta um benefício acumulado de
              <strong style={{ color: DEFAULT_CHART_COLORS.Leasing }}> {currency(beneficioAno30Printable.Leasing)}</strong>
              {mostrarFinanciamento ? (
                <>
                  {' '}
                  {isVendaDireta ? 'na venda direta e de' : 'no leasing e de'}
                  <strong style={{ color: DEFAULT_CHART_COLORS.Financiamento }}>
                    {' '}
                    {currency(beneficioAno30Printable.Financiamento)}
                  </strong>{' '}
                  {isVendaDireta ? 'com financiamento como alternativa de pagamento.' : 'com financiamento.'}
                </>
              ) : (
                <> comparado à concessionária.</>
              )}{' '}
              {chartExplainerContext}
            </p>
          ) : null}
          {!isVendaDireta ? <p className="print-chart-footnote no-break-inside">{chartFootnoteText}</p> : null}
        </div>

        <div id="infos-importantes" className="venda-print__section venda-print__section--important">
          <h2>Informações importantes</h2>
          <ul className="venda-print__list no-break-inside">
            {isVendaDireta ? (
              <>
                <li>Esta proposta refere-se à venda do sistema fotovoltaico (não inclui serviços de leasing).</li>
                <li>Todos os equipamentos utilizados possuem certificação INMETRO (ou equivalente) e seguem as normas técnicas aplicáveis.</li>
                <li>Os valores, condições de pagamento e prazos apresentados são estimativas preliminares e podem ser ajustados na contratação definitiva.</li>
                <li>A projeção de economia considera: produção estimada, tarifa de energia inicial e inflação de energia informadas, e a taxa mínima aplicável em sistemas on-grid.</li>
                <li>As parcelas/encargos de cartão e/ou financiamento impactam o fluxo de caixa e o ROI projetado.</li>
                <li>O cronograma de entrega e instalação está sujeito a vistoria técnica e disponibilidade de estoque.</li>
                <li>Garantias dos fabricantes seguem seus termos. Manutenção preventiva/corretiva e seguros podem ser contratados à parte (se aplicável).</li>
                <li>
                  Não é de responsabilidade da SolarInvest Solutions cálculo e reforço/modificações de estrutura; reforço/modificações na rede elétrica; mudança/adaptação de transformador; armazenamento/seguro de material; segurança local; autorização ambiental; autorização de autoridades/autarquias municipais/estaduais além da distribuidora de energia; e ajuste de tensão com troca de padrão junto à distribuidora. O prazo de entrega da instalação será de acordo com contrato assinado e condicionado às intempéries climáticas, podendo ser de aproximadamente 30 dias úteis após a entrega integral do material.
                </li>
                <li>
                  É de responsabilidade da SolarInvest Solutions: dimensionamento do sistema; elaboração do projeto; relação dos equipamentos e materiais necessários; acompanhamento junto à distribuidora; instalação do sistema; supervisão e gerenciamento da obra. Será realizada visita técnica antes da assinatura do contrato e o dimensionamento poderá ser ajustado conforme a posição da cobertura, pois as estimativas consideram a instalação dos módulos orientados para o norte, inclinados a 17° e livres de sombreamento.
                </li>
              </>
            ) : (
              <>
                <li>Desconto contratual aplicado: {descontoResumo} sobre a tarifa da distribuidora.</li>
                <li>Prazo de vigência: conforme especificado na proposta (ex.: 60 meses).</li>
                <li>Tarifas por kWh são projeções, podendo variar conforme reajustes autorizados pela ANEEL.</li>
                <li>Durante o contrato, a SolarInvest é responsável por manutenção, suporte técnico, limpeza e seguro sinistro da usina.</li>
                <li>Transferência da usina ao cliente ao final do contrato sem custo adicional, desde que obrigações contratuais estejam cumpridas.</li>
                <li>Tabela de compra antecipada disponível mediante solicitação.</li>
                <li>Equipamentos utilizados possuem certificação INMETRO.</li>
                <li>Os valores apresentados nesta proposta são estimativas preliminares e poderão sofrer ajustes no contrato definitivo.</li>
              </>
            )}
          </ul>
          {pdfConfig.observacaoPadrao ? (
            <p className="print-important__observation no-break-inside">{pdfConfig.observacaoPadrao}</p>
          ) : null}
        </div>

        <div className="venda-print__section venda-print__cta no-break-inside">
          <h2>Vamos avançar?</h2>
          <p>
            Agende uma visita técnica gratuita com nossa equipe para confirmar a viabilidade e formalizar a proposta definitiva.
          </p>
        </div>

        <footer className="print-final-footer no-break-inside">
          <div className="print-final-footer__dates">
            <p>
              <strong>Data de emissão da proposta:</strong> {emissaoTexto}
            </p>
            <p>
              <strong>Validade da proposta:</strong> {validadeTexto} (15 dias corridos)
            </p>
          </div>
          <div className="print-final-footer__signature">
            <div className="signature-line" />
            <span>Assinatura do cliente</span>
          </div>
        </footer>

        <div className="print-brand-footer no-break-inside">
          <strong>SOLARINVEST</strong>
          <span>CNPJ: 60.434.015/0001-90</span>
          <span>Anápolis-GO</span>
          <span>Solarinvest.info</span>
        </div>
      </section>
    </div>
  )
}


export const PrintableProposalVenda = React.forwardRef<HTMLDivElement, PrintableProposalProps>(PrintableProposalInner)

export default PrintableProposalVenda

