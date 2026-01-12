import React, { useMemo } from 'react'

import { currency, formatCpfCnpj } from '../../../utils/formatters'
import { ClientInfoGrid, type ClientInfoField } from '../common/ClientInfoGrid'
import { classifyBudgetItem } from '../../../utils/moduleDetection'
import {
  formatMoneyBRWithDigits,
  formatNumberBRWithOptions,
  formatPercentBR,
  formatPercentBRWithDigits,
} from '../../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../../types/printableProposal'
import PrintableProposalImages from '../PrintableProposalImages'
import { PMT, toMonthly } from '../../../lib/finance/roi'
import {
  formatCondicaoLabel,
  formatPagamentoLabel,
  formatPagamentoResumo,
} from '../../../constants/pagamento'
import { sanitizePrintableText } from '../../../utils/textSanitizer'

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
const DEFAULT_CHART_COLORS = ['linear-gradient(90deg, #4CAF50, #2E7D32)'] as const
const normalizeNewlines = (value: string): string => value.replace(/\r\n?/g, '\n')
const isSoloTipoInstalacao = (value?: string | null) => value?.toLowerCase() === 'solo'
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
    orcamentoModo,
    orcamentoAutoCustoFinal,
    valorTotalProposta: valorTotalPropostaProp,
    custoImplantacaoReferencia,
    imagensInstalacao,
    configuracaoUsinaObservacoes,
    ucGeradora,
    ucsBeneficiarias,
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
  const formatParcelas = (value?: number, parcelaValor?: number | null) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    const parcelasLabel = `${formatNumberBRWithOptions(value ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} parcelas`
    if (Number.isFinite(parcelaValor) && (parcelaValor ?? 0) > 0) {
      return `${parcelasLabel} de ${currency(parcelaValor ?? 0)}`
    }
    return parcelasLabel
  }
  const formatBoletos = (value?: number, boletoValor?: number | null) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    const boletosLabel = `${formatNumberBRWithOptions(value ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} boletos`
    if (Number.isFinite(boletoValor) && (boletoValor ?? 0) > 0) {
      return `${boletosLabel} de ${currency(boletoValor ?? 0)}`
    }
    return boletosLabel
  }
  const formatDebitosAutomaticos = (value?: number) => {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return '—'
    }
    return `${formatNumberBRWithOptions(value ?? 0, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} débitos automáticos`
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
  const normalizeDisplayText = (value: string | null | undefined): string | null => {
    const sanitized = sanitizePrintableText(value)
    if (!sanitized || sanitized === '—') {
      return null
    }
    return sanitized
  }
  const MODELO_MODULO_PADRAO = 'Jinko, Maxeon ou Similares'
  const MODELO_INVERSOR_PADRAO = 'Huawei, Solis ou Similares'
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
  const sanitizeTextField = (value?: string | null) => sanitizePrintableText(value)
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
  const configuracaoUsinaObservacoesTexto = sanitizeTextField(configuracaoUsinaObservacoes)
  const configuracaoUsinaObservacoesParagrafos = useMemo(() => {
    if (!configuracaoUsinaObservacoesTexto) {
      return []
    }

    return configuracaoUsinaObservacoesTexto
      .split(/\r?\n\r?\n+/)
      .map((paragrafo) => paragrafo.trim())
      .filter(Boolean)
  }, [configuracaoUsinaObservacoesTexto])
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
  const modoOrcamentoPrintable = orcamentoModo ?? null
  const isOrcamentoAutomatico = modoOrcamentoPrintable === 'auto'
  const custoFinalAutoNumero = pickPositive(orcamentoAutoCustoFinal)
  const usarCustoFinalAuto = modoOrcamentoPrintable === 'auto' && custoFinalAutoNumero != null
  const pickNumeric = (...values: (number | null | undefined)[]): number | null => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Number(value)
      }
    }
    return null
  }
  const parsedPdfResumo = parsedPdfVenda ?? null
  const potenciaModuloSeguro = Number(
    pickPositive(potenciaModuloProp, snapshotConfig?.potencia_modulo_wp, parsedPdfResumo?.potencia_da_placa_wp) ?? 0,
  ) || 0
  const kitPotenciaInstaladaBase = pickPositive(
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
  const printableBudgetTotal = useMemo(() => {
    let total = 0
    let added = false

    printableBudgetItems.forEach((item) => {
      const valorTotal = Number.isFinite(item.valorTotal)
        ? Number(item.valorTotal)
        : Number.isFinite(item.valorUnitario) && Number.isFinite(item.quantidade)
        ? Number(item.valorUnitario) * Number(item.quantidade)
        : null

      if (valorTotal != null && Math.abs(valorTotal) > 0) {
        total += valorTotal
        added = true
      }
    })

    return added ? total : null
  }, [printableBudgetItems])
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
  ) ?? MODELO_INVERSOR_PADRAO
  const moduleModelo = pickFirstText(
    snapshotConfig?.modelo_modulo,
    vendaFormResumo?.modelo_modulo,
    parsedPdfResumo?.modelo_modulo,
    moduleDescricaoCatalogo,
  ) ?? MODELO_MODULO_PADRAO

  const moduleQuantidadeManual = useMemo(() => {
    if (!isOrcamentoAutomatico) {
      return null
    }

    if (!hasNonZero(kitPotenciaInstaladaBase)) {
      return null
    }

    if (!hasNonZero(potenciaModuloSeguro)) {
      return null
    }

    return Math.ceil(((kitPotenciaInstaladaBase ?? 0) * 1000) / (potenciaModuloSeguro ?? 1))
  }, [isOrcamentoAutomatico, kitPotenciaInstaladaBase, potenciaModuloSeguro])

  const moduleQuantidade = pickPositive(kitQuantidadeModulos, moduleQuantidadeCatalogo, moduleQuantidadeManual)

  const kitPotenciaInstaladaCalculada = useMemo(() => {
    if (!hasNonZero(moduleQuantidade)) {
      return null
    }

    if (!hasNonZero(potenciaModuloSeguro)) {
      return null
    }

    return (Math.round((moduleQuantidade ?? 0) * (potenciaModuloSeguro ?? 0) * 100) / 100) / 1000
  }, [moduleQuantidade, potenciaModuloSeguro])

  const kitPotenciaInstalada = pickPositive(kitPotenciaInstaladaBase, kitPotenciaInstaladaCalculada)

  const inverterQuantidadeEstimativa = useMemo(() => {
    if (!isOrcamentoAutomatico) {
      return null
    }

    if (hasNonZero(inverterQuantidadeCatalogo)) {
      return null
    }

    return hasNonZero(kitPotenciaInstalada) ? 1 : null
  }, [inverterQuantidadeCatalogo, isOrcamentoAutomatico, kitPotenciaInstalada])

  const inverterQuantidade = pickPositive(inverterQuantidadeCatalogo, inverterQuantidadeEstimativa)

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
    potenciaModuloSeguro,
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
    tarifaCheia,
    vendaFormResumo?.tarifa_cheia_r_kwh,
    parsedPdfResumo?.tarifa_cheia_r_kwh,
    snapshotParametros?.tarifa_r_kwh,
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
    !isOrcamentoAutomatico && moduleQuantidadeNumero != null
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
    (snapshotPagamento?.forma_pagamento as
      | 'AVISTA'
      | 'PARCELADO'
      | 'BOLETO'
      | 'DEBITO_AUTOMATICO'
      | 'FINANCIAMENTO'
      | undefined) ??
    vendaFormResumo?.condicao ??
    null
  const condicaoLabel = formatCondicaoLabel(condicaoFonte)
  const isCondicaoAvista = condicaoFonte === 'AVISTA'
  const isCondicaoParcelado = condicaoFonte === 'PARCELADO'
  const isCondicaoBoleto = condicaoFonte === 'BOLETO'
  const isCondicaoDebitoAutomatico = condicaoFonte === 'DEBITO_AUTOMATICO'
  const isCondicaoFinanciamento = condicaoFonte === 'FINANCIAMENTO'
  const modoPagamentoTipo = vendaFormResumo?.modo_pagamento ?? 'PIX'
  const formaPagamentoLabel = formatPagamentoLabel(condicaoFonte, modoPagamentoTipo)
  const pagamentoResumo = formatPagamentoResumo(condicaoFonte, modoPagamentoTipo)
  const condicaoHighlightsLabel =
    pagamentoResumo.highlights.length > 0 ? pagamentoResumo.highlights.join(' • ') : null
  const condicaoSummaryLabel =
    pagamentoResumo.summary && pagamentoResumo.summary.trim().length > 0
      ? pagamentoResumo.summary
      : null
  const condicaoModalidadeLabel =
    formaPagamentoLabel !== condicaoLabel ? condicaoLabel : null
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
      const bucket = isSoloTipoInstalacao(tipoAtual) ? composicaoUfv.solo : composicaoUfv.telhado
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
    ? usarCustoFinalAuto
      ? custoFinalAutoNumero
      : valorTotalPropostaNumero ??
        (hasNonZero(capexTotalCalculado)
          ? Number(capexTotalCalculado)
          : hasNonZero(capex)
          ? Number(capex)
          : null)
    : valorTotalPropostaNumero ??
      (hasNonZero(capexTotalCalculado)
        ? Number(capexTotalCalculado)
        : hasNonZero(capex)
        ? Number(capex)
        : null)
  const valorTotalPropostaLabel =
    valorTotalPropostaPrincipalNumero != null ? currency(valorTotalPropostaPrincipalNumero) : '—'
  const baseParcelamentoValor = (() => {
    if (hasNonZero(vendaFormResumo?.capex_total)) {
      return Number(vendaFormResumo?.capex_total)
    }
    if (hasNonZero(valorTotalPropostaPrincipalNumero)) {
      return Number(valorTotalPropostaPrincipalNumero)
    }
    if (hasNonZero(capexTotalCalculado)) {
      return Number(capexTotalCalculado)
    }
    if (hasNonZero(capex)) {
      return Number(capex)
    }
    return null
  })()
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
    : hasNonZero(printableBudgetTotal)
    ? Number(printableBudgetTotal)
    : null
  const kitFotovoltaicoLabel =
    kitFotovoltaicoValorNumero != null ? currency(kitFotovoltaicoValorNumero) : '—'
  const kitFotovoltaicoAnnotation =
    'Módulos fotovoltaicos Tier 1 (BloombergNEF), tecnologia N-Type bifacial, de fabricantes globais como Gokin Solar, OSDA Solar e Solar N Plus, garantindo alta performance, confiabilidade e longa vida útil.'
  const margemOperacionalNumero = (() => {
    if (composicaoUfv) {
      const tipoResumo = composicaoUfv.tipoAtual ?? tipoInstalacao
      if (isSoloTipoInstalacao(tipoResumo)) {
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
      if (isSoloTipoInstalacao(tipoResumo)) {
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
      const fallbackValor = pickPositive(
        usarCustoFinalAuto ? custoFinalAutoNumero : null,
        valorTotalPropostaPrincipalNumero,
        printableBudgetTotal,
      )
      return fallbackValor
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
  const aplicaTaxaMinima =
    typeof snapshotParametros?.aplica_taxa_minima === 'boolean'
      ? snapshotParametros.aplica_taxa_minima
      : vendaFormResumo?.aplica_taxa_minima ?? true
  const taxaMinimaNumero = Number.isFinite(snapshotParametros?.taxa_minima_rs_mes)
    ? snapshotParametros?.taxa_minima_rs_mes ?? 0
    : Number.isFinite(vendaFormResumo?.taxa_minima_mensal)
    ? vendaFormResumo?.taxa_minima_mensal ?? 0
    : 0
  const taxaMinimaResumo = aplicaTaxaMinima
    ? currency(taxaMinimaNumero)
    : `${currency(0)} • Cliente isento de taxa mínima conforme contrato.`
  const horizonteAnaliseResumo = formatMeses(snapshotParametros?.horizonte_meses ?? vendaFormResumo?.horizonte_meses)
  const numeroParcelas = Number.isFinite(vendaFormResumo?.n_parcelas)
    ? Math.max(0, Math.round(vendaFormResumo?.n_parcelas ?? 0))
    : null
  const jurosMensalParcelado = Number.isFinite(vendaFormResumo?.juros_cartao_am_pct)
    ? (vendaFormResumo?.juros_cartao_am_pct ?? 0) / 100
    : Number.isFinite(vendaFormResumo?.juros_cartao_aa_pct)
    ? toMonthly(vendaFormResumo?.juros_cartao_aa_pct)
    : null
  const taxaMdrParcelado = Number.isFinite(vendaFormResumo?.taxa_mdr_credito_parcelado_pct)
    ? (vendaFormResumo?.taxa_mdr_credito_parcelado_pct ?? 0) / 100
    : 0
  const parcelaValorNumero =
    numeroParcelas && numeroParcelas > 0 && hasNonZero(baseParcelamentoValor)
      ? PMT(jurosMensalParcelado ?? 0, numeroParcelas, baseParcelamentoValor) * (1 + taxaMdrParcelado)
      : null
  const parcelasResumo = formatParcelas(numeroParcelas ?? undefined, parcelaValorNumero)
  const numeroBoletos = Number.isFinite(vendaFormResumo?.n_boletos)
    ? Math.max(0, Math.round(vendaFormResumo?.n_boletos ?? 0))
    : null
  const boletoValorNumero =
    numeroBoletos && numeroBoletos > 0 && hasNonZero(baseParcelamentoValor)
      ? baseParcelamentoValor / numeroBoletos
      : null
  const boletosResumo = formatBoletos(numeroBoletos ?? undefined, boletoValorNumero)
  const debitosResumo = formatDebitosAutomaticos(vendaFormResumo?.n_debitos)
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
  const validadeConfigPadraoDias = Number.isFinite(vendasConfigSnapshot?.validade_proposta_dias)
    ? Math.max(0, Number(vendasConfigSnapshot?.validade_proposta_dias ?? 0))
    : null
  const validadeVendaPadraoDias = 3
  const validadePropostaDiasPadrao = isVendaDireta
    ? validadeVendaPadraoDias
    : validadeConfigPadraoDias
  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  if ((validadePropostaDiasPadrao ?? 0) > 0) {
    validadeData.setDate(validadeData.getDate() + (validadePropostaDiasPadrao ?? 0))
  }
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const validadePadraoDescricao = (() => {
    if (validadePropostaDiasPadrao == null || validadePropostaDiasPadrao <= 0) {
      return validadeTexto
    }
    const plural = validadePropostaDiasPadrao === 1 ? 'dia' : 'dias'
    return `${validadeTexto} (${validadePropostaDiasPadrao} ${plural} corridos)`
  })()
  const validadePropostaLabel =
    sanitizeTextField(snapshotPagamento?.validade_proposta_txt) ??
    sanitizeTextField(vendaFormResumo?.validade_proposta) ??
    validadePadraoDescricao
  const prazoExecucaoLabel =
    sanitizeTextField(snapshotPagamento?.prazo_execucao_txt) ??
    sanitizeTextField(vendaFormResumo?.prazo_execucao) ??
    'Até 30 dias úteis após a assinatura do contrato e entrega integral do material'
  const condicoesAdicionaisLabel =
    sanitizeTextField(snapshotPagamento?.condicoes_adicionais_txt) ??
    sanitizeTextField(vendaFormResumo?.condicoes_adicionais) ??
    '—'
  const condicoesPagamentoRows: TableRow[] = []
  const mostrarDetalhesModalidade = !isCondicaoAvista
  pushRowIfMeaningful(condicoesPagamentoRows, 'Forma de pagamento', formaPagamentoLabel)
  if (mostrarDetalhesModalidade) {
    pushRowIfMeaningful(condicoesPagamentoRows, 'Modalidade comercial', condicaoModalidadeLabel)
    pushRowIfMeaningful(condicoesPagamentoRows, 'Resumo da modalidade', condicaoSummaryLabel)
    pushRowIfMeaningful(
      condicoesPagamentoRows,
      'Destaques da modalidade',
      condicaoHighlightsLabel,
    )
  }
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
  if (isCondicaoParcelado) {
    pushRowIfMeaningful(condicoesParceladoRows, 'Número de parcelas', parcelasResumo)
    pushRowIfMeaningful(condicoesParceladoRows, 'Juros do cartão (% a.m.)', jurosCartaoAmResumo)
    pushRowIfMeaningful(condicoesParceladoRows, 'Juros do cartão (% a.a.)', jurosCartaoAaResumo)
  }
  const condicoesBoletoRows: TableRow[] = []
  if (isCondicaoBoleto) {
    pushRowIfMeaningful(condicoesBoletoRows, 'Número de boletos', boletosResumo)
  }
  const condicoesDebitoAutomaticoRows: TableRow[] = []
  if (!isVendaDireta && isCondicaoDebitoAutomatico) {
    pushRowIfMeaningful(
      condicoesDebitoAutomaticoRows,
      'Duração do débito automático',
      debitosResumo,
    )
  }
  const condicoesFinanciamentoRows: TableRow[] = []
  if (!isVendaDireta && isCondicaoFinanciamento) {
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Entrada', entradaResumo)
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Número de parcelas', parcelasFinResumo)
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Juros do financiamento (% a.m.)', jurosFinAmResumo)
    pushRowIfMeaningful(condicoesFinanciamentoRows, 'Juros do financiamento (% a.a.)', jurosFinAaResumo)
  }
  const bancosFinanciamento = [
    { nome: 'Banco BV', logo: '/bank-bv.svg' },
    { nome: 'Santander', logo: '/bank-santander.svg' },
    { nome: 'BTG', logo: '/bank-btg.svg' },
  ]
  const parametrosEconomiaRows: TableRow[] = []
  pushRowIfMeaningful(parametrosEconomiaRows, 'Inflação de energia estimada (a.a.)', inflacaoResumo)
  pushRowIfMeaningful(
    parametrosEconomiaRows,
    'Encargos fixos obrigatórios',
    taxaMinimaResumo,
  )
  if (!isVendaDireta) {
    pushRowIfMeaningful(parametrosEconomiaRows, 'Horizonte de análise', horizonteAnaliseResumo)
  }
  const mostrarCondicoesPagamento = condicoesPagamentoRows.length > 0
  const mostrarCondicoesParcelado = condicoesParceladoRows.length > 0
  const mostrarCondicoesBoleto = condicoesBoletoRows.length > 0
  const mostrarCondicoesDebitoAutomatico = condicoesDebitoAutomaticoRows.length > 0
  const mostrarCondicoesFinanciamento = condicoesFinanciamentoRows.length > 0
  const mostrarBancosFinanciamento = !isVendaDireta && isCondicaoFinanciamento
  const mostrarParametrosEconomia = parametrosEconomiaRows.length > 0
  const temAlgumaCondicao =
    mostrarCondicoesPagamento ||
    mostrarCondicoesParcelado ||
    mostrarCondicoesBoleto ||
    mostrarCondicoesDebitoAutomatico ||
    mostrarCondicoesFinanciamento ||
    mostrarParametrosEconomia
  const totalCondicoesLinhas =
    condicoesPagamentoRows.length +
    condicoesParceladoRows.length +
    condicoesBoletoRows.length +
    condicoesDebitoAutomaticoRows.length +
    condicoesFinanciamentoRows.length
  const mostrarTabelaCondicoes = totalCondicoesLinhas > 0
  const heroTitle = isVendaDireta
    ? 'Proposta de Aquisição de Sistema de Energia Solar com a SolarInvest'
    : 'Proposta de Leasing Solar'
  const heroTagline = isVendaDireta
    ? 'Energia inteligente, patrimônio garantido'
    : 'Energia inteligente, sem desembolso'
  const heroSummaryDescription = isVendaDireta
    ? 'Apresentamos sua proposta personalizada de aquisição da usina fotovoltaica SolarInvest. Nesta modalidade de venda, você investe no sistema, torna-se proprietário desde o primeiro dia e captura 100% da economia gerada, aumentando a previsibilidade de custos e o valor do seu imóvel.'
    : 'Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest. Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para você, tornando-se um patrimônio durável, valorizando seu imóvel.'
  const economiaIntro = isVendaDireta
    ? 'Retorno que cresce ano após ano.'
    : 'Economia que cresce ano após ano.'
  const economiaContext = isVendaDireta
    ? 'O investimento considera os reajustes anuais de energia, a vida útil projetada dos equipamentos e a propriedade integral do ativo desde o primeiro dia.'
    : 'Essa trajetória considera os reajustes anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.'
  const economiaFootnote = isVendaDireta
    ? 'Como proprietário do sistema, toda a economia permanece com o cliente ao longo da vida útil do projeto.'
    : 'Após o final do contrato a usina passa a render 100% de economia frente à concessionária para o cliente.'
  const economiaPrimaryLabel = isVendaDireta ? 'Aquisição SolarInvest' : 'Leasing SolarInvest'
  const economiaFinanciamentoLabel = 'Financiamento SolarInvest'
  const economiaTabelaDados = useMemo(() => {
    const anosDisponiveis = new Set(anos)

    return BENEFICIO_CHART_ANOS.filter((ano) => anosDisponiveis.has(ano)).map((ano) => ({
      ano,
      Leasing: leasingROI[ano - 1] ?? 0,
      Financiamento: financiamentoROI[ano - 1] ?? 0,
    }))
  }, [anos, financiamentoROI, leasingROI])
  const economiaTemDados = economiaTabelaDados.length > 0
  const beneficioAno30Printable = useMemo(
    () => economiaTabelaDados.find((row) => row.ano === 30) ?? null,
    [economiaTabelaDados],
  )
  const chartPalette = DEFAULT_CHART_COLORS
  const chartPaletteStyles = {
    '--print-chart-color-primary': chartPalette[0],
  } as React.CSSProperties
  const economiaProjetadaGrafico = useMemo(
    () =>
      economiaTabelaDados.map((row) => ({
        ano: row.ano,
        label: `${row.ano}\u00ba ano`,
        valor: row.Leasing,
      })),
    [economiaTabelaDados],
  )
  const maxBeneficioGrafico = useMemo(
    () => economiaProjetadaGrafico.reduce((maior, linha) => Math.max(maior, linha.valor ?? 0), 0),
    [economiaProjetadaGrafico],
  )
  return (
    <div ref={ref} className="print-root">
      <div className="print-layout">
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
                      <h1>{heroTitle}</h1>
                    </div>
                    <p className="print-hero__tagline">{heroTagline}</p>
                  </div>
                </div>
              </div>
              <div className="print-hero__summary no-break-inside">
                <h2 className="keep-with-next">Sumário executivo</h2>
                <p>{heroSummaryDescription}</p>
              </div>
            </div>
          </section>
    
          {isVendaDireta ? (
            <section className="print-section keep-together avoid-break print-values-section">
              <h2 className="keep-with-next">Valores da proposta</h2>
              <div className="print-values-grid">
                <div className="print-value-card print-value-card--highlight">
                  <span className="print-value-card__label">
                    Valor final da proposta:{' '}
                    <strong>{valorTotalPropostaLabel}</strong>
                  </span>
                </div>
              </div>
              <p className="print-value-note">
                O valor total da proposta representa o preço final de compra da usina, incluindo equipamentos,
                instalação, documentação, garantia e suporte técnico.
              </p>
            </section>
          ) : null}
    
          <section className="print-section keep-together avoid-break">
            <h2 className="keep-with-next">Identificação do cliente</h2>
            <ClientInfoGrid
              fields={clienteCampos}
              className="print-client-grid no-break-inside"
              fieldClassName="print-client-field"
              wideFieldClassName="print-client-field--wide"
            />
          </section>

          <section className="print-section keep-together avoid-break">
            <h2 className="keep-with-next">Dados da instalação</h2>
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

          {mostrarDetalhamento ? (
            <section className="print-section keep-together avoid-break">
              <h2 className="keep-with-next">Detalhamento do Projeto</h2>
              {detalhamentoCampos.length > 0 ? (
                <table className="print-table no-break-inside">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Valor/Descrição</th>
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
              ) : null}
            </section>
          ) : null}
          {!isVendaDireta ? (
            <section id="resumo-proposta" className="print-section keep-together page-break-before break-after">
              <h2 className="keep-with-next">Resumo de Custos e Investimento</h2>
              <table className="print-table no-break-inside">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor/Descrição</th>
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
                    addRow('capex-base', 'CAPEX base', snapshotComposicao.capex_base)
                    if (pdfConfig.exibirComissao) {
                      addRow('comissao', 'Comissão líquida', snapshotComposicao.comissao_liquida_valor)
                    }
                    if (pdfConfig.exibirMargem) {
                      addRow('margem', 'Margem Operacional', snapshotComposicao.margem_operacional_valor)
                    }
                    if (pdfConfig.exibirImpostos) {
                      addRow('imposto-retido', 'Imposto retido', snapshotComposicao.imposto_retido_valor)
                      addRow('impostos-regime', 'Impostos do regime', snapshotComposicao.impostos_regime_valor)
                      addRow('impostos-totais', 'Impostos totais', snapshotComposicao.impostos_totais_valor)
                    }
                    addRow('capex-total', 'CAPEX considerado (sem kit)', snapshotComposicao.capex_total)
    
                    const descontosSnapshot = Number.isFinite(snapshotComposicao.descontos)
                      ? Number(snapshotComposicao.descontos)
                      : 0
                    if (descontosSnapshot > 0) {
                      addRow('descontos', 'Descontos comerciais', -descontosSnapshot)
                    }
    
                    resumoPropostaBreakdown = pdfConfig.exibirImpostos && pdfConfig.mostrarQuebraImpostos
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
                      <tr key={row.key} className={row.emphasize ? 'print-table__row--total' : undefined}>
                        <td>{row.label}</td>
                        <td>{currency(row.valor)}</td>
                      </tr>
                    ))
                  }
    
                  const composicaoAtual = composicaoUfv ?? null
                  if (!composicaoAtual) {
                    return [
                      <tr key="total-capex">
                        <td>Investimento Total do Projeto</td>
                        <td>—</td>
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
    
                  if (!isSoloTipoInstalacao(tipoResumo)) {
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
                    pushDireto('tela', 'TELA', soloValores?.tela)
                    pushDireto('mao-obra-tela', 'M. OBRA - TELA', soloValores?.maoObraTela)
                    pushDireto('portao-tela', 'PORTÃO - TELA', soloValores?.portaoTela)
                    pushDireto('casa-inversor', 'CASA INVERSOR', soloValores?.casaInversor)
                    pushDireto('trafo', 'TRAFO', soloValores?.trafo)
                    pushDireto('brita', 'BRITA', soloValores?.brita)
                    pushDireto('terraplanagem', 'TERRAPLANAGEM', soloValores?.terraplanagem)
                  }
    
                  const resumoCalculo = isSoloTipoInstalacao(tipoResumo)
                    ? composicaoAtual.calculoSolo
                    : composicaoAtual.calculoTelhado
                  const descontosConfiguracao = Number.isFinite(composicaoAtual.configuracao?.descontos)
                    ? Number(composicaoAtual.configuracao?.descontos)
                    : 0
    
                  if (resumoCalculo) {
                    addRow('capex-base', 'CAPEX base', resumoCalculo.capex_base)
                    if (pdfConfig.exibirComissao) {
                      addRow('comissao', 'Comissão líquida', resumoCalculo.comissao_liquida_valor)
                    }
                    if (pdfConfig.exibirMargem) {
                      addRow('margem', 'Margem Operacional', resumoCalculo.margem_operacional_valor)
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
    
                    resumoPropostaBreakdown = pdfConfig.exibirImpostos && pdfConfig.mostrarQuebraImpostos
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
                      <tr key={row.key} className={row.emphasize ? 'print-table__row--total' : undefined}>
                        <td>{row.label}</td>
                        <td>{currency(row.valor)}</td>
                      </tr>
                    ))
                  }
    
                  if (descontosConfiguracao > 0) {
                    addRow('descontos', 'Descontos comerciais', -descontosConfiguracao)
                  }
    
                  resumoPropostaBreakdown = []
    
                  return rows.length
                    ? rows.map((row) => (
                        <tr key={row.key} className={row.emphasize ? 'print-table__row--total' : undefined}>
                          <td>{row.label}</td>
                          <td>{currency(row.valor)}</td>
                        </tr>
                      ))
                    : [
                        <tr key="total-capex">
                          <td>Investimento Total do Projeto</td>
                          <td>—</td>
                        </tr>,
                      ]
                })()}
              </tbody>
            </table>
              {pdfConfig.exibirImpostos && pdfConfig.mostrarQuebraImpostos && resumoPropostaBreakdown.length ? (
                <table className="print-table no-break-inside">
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
                      <td>{formatPercentBRWithDigits((item.aliquota ?? 0) / 100, 2)}</td>
                      <td>{currency(item.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              ) : null}
            </section>
          ) : null}
    
          {isVendaDireta ? (
            <section className="print-section no-break-inside">
              <h2 className="keep-with-next">Condições Comerciais e de Pagamento</h2>
              {snapshotPagamento || vendaFormResumo ? (
                temAlgumaCondicao ? (
                  <>
                    {mostrarParametrosEconomia ? (
                      <>
                        <h3 className="print-subheading keep-with-next">Parâmetros de economia</h3>
                        <table className="print-table print-table--parametros-economia no-break-inside">
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
                                <td>{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : null}
                    {mostrarTabelaCondicoes ? (
                      <>
                        <h3 className="print-subheading keep-with-next">Detalhe da proposta</h3>
                        <table className="print-table print-table--detalhe-proposta no-break-inside">
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
                                    className={`print-table__label-text${row.labelAnnotation ? ' print-table__label-text--annotated' : ''}`}
                                  >
                                    {row.emphasize ? <strong>{row.label}</strong> : row.label}
                                    {row.labelAnnotation ? (
                                      <span className="print-table__label-annotation">{row.labelAnnotation}</span>
                                    ) : null}
                                  </span>
                                  {row.description ? (
                                    <em className="print-table__description">{row.description}</em>
                                  ) : null}
                                </td>
                                <td className={row.emphasize ? 'print-table__cell--emphasis' : undefined}>
                                  {row.emphasize ? <strong>{row.value}</strong> : row.value}
                                </td>
                              </tr>
                            ))}
                            {condicoesParceladoRows.map((row) => (
                              <tr key={`condicao-parcelado-${row.label}`}>
                                <td>{row.label}</td>
                                <td>{row.value}</td>
                              </tr>
                            ))}
                            {condicoesBoletoRows.map((row) => (
                              <tr key={`condicao-boleto-${row.label}`}>
                                <td>{row.label}</td>
                                <td>{row.value}</td>
                              </tr>
                            ))}
                            {condicoesDebitoAutomaticoRows.map((row) => (
                              <tr key={`condicao-debito-automatico-${row.label}`}>
                                <td>{row.label}</td>
                                <td>{row.value}</td>
                              </tr>
                            ))}
                            {condicoesFinanciamentoRows.map((row) => (
                              <tr key={`condicao-financiamento-${row.label}`}>
                                <td>{row.label}</td>
                                <td>{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : null}
                    {mostrarBancosFinanciamento ? (
                      <div className="print-financing-banks no-break-inside">
                        <h3 className="print-subheading keep-with-next">Bancos parceiros para financiamento</h3>
                        <div className="print-financing-banks__logos">
                          {bancosFinanciamento.map((banco) => (
                            <div key={banco.nome} className="print-financing-banks__logo">
                              <img src={banco.logo} alt={`Logo ${banco.nome}`} />
                              <span>{banco.nome}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="muted no-break-inside">
                    Preencha as condições de pagamento na aba Vendas para exibir os detalhes nesta proposta.
                  </p>
                )
              ) : (
                <p className="muted no-break-inside">
                  Preencha as condições de pagamento na aba Vendas para exibir os detalhes nesta proposta.
                </p>
              )}
            </section>
          ) : null}
    
          {isVendaDireta ? (
            <section
              id="condicoes-financeiras"
              className="print-section keep-together page-break-before break-after"
            >
              <h2 className="keep-with-next">{isVendaDireta ? 'Retorno Financeiro' : 'Retorno projetado'}</h2>
              {snapshotResultados || retornoVenda ? (
                <div className="print-kpi-grid no-break-inside">
                  <div className="print-kpi no-break-inside">
                    <span>Payback estimado: </span>
                    <strong>{paybackLabelResumo}</strong>
                  </div>
                  <div className="print-kpi no-break-inside">
                    <span>ROI acumulado ({roiHorizonteResumo}): </span>
                    <strong>{roiLabelResumo}</strong>
                  </div>
                  {typeof retornoVenda?.vpl === 'number' ? (
                    <div className="print-kpi no-break-inside">
                      <span>VPL</span>
                      <strong>{vplResumo}</strong>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="muted no-break-inside">
                  Informe os parâmetros financeiros na aba Vendas para calcular o retorno projetado.
                </p>
              )}
            </section>
          ) : null}
    
          <section
            id="economia-30-anos"
            className="print-section keep-together page-break-before break-after"
            data-chart-palette={chartPalette.join(',')}
            style={chartPaletteStyles}
          >
            <h2 className="keep-with-next">{isVendaDireta ? 'Retorno projetado (30 anos)' : 'Economia projetada (30 anos)'}</h2>
            {economiaTemDados ? (
              <>
                <p className="no-break-inside">
                  <strong>{economiaIntro}</strong>
                  {isVendaDireta ? ' A SolarInvest projeta os seguintes marcos de benefício acumulado.' : ' A tabela abaixo apresenta os principais marcos de benefício acumulado projetados pela SolarInvest.'}{' '}
                  {economiaContext}
                </p>
                {!isVendaDireta ? (
                  <table className="print-table no-break-inside">
                    <thead>
                      <tr>
                        <th>Ano</th>
                        <th>{`Benefício acumulado (${economiaPrimaryLabel})`}</th>
                        {mostrarFinanciamento ? (
                          <th>{`Benefício acumulado (${economiaFinanciamentoLabel})`}</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {economiaTabelaDados.map((row) => (
                        <tr key={`economia-ano-${row.ano}`}>
                          <td>{`${row.ano}º ano`}</td>
                          <td>{currency(row.Leasing)}</td>
                          {mostrarFinanciamento ? <td>{currency(row.Financiamento)}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {economiaProjetadaGrafico.length > 0 ? (
                  <div
                    className="print-horizontal-chart no-break-inside"
                    role="img"
                    aria-label="Economia acumulada projetada em 30 anos"
                  >
                    <div className="print-horizontal-chart__header-row">
                      <span className="print-horizontal-chart__axis-y-label">Tempo (anos)</span>
                      <span className="print-horizontal-chart__axis-x-label">Economia acumulada (R$)</span>
                      <span aria-hidden="true" />
                    </div>
                    <div className="print-horizontal-chart__rows">
                      {economiaProjetadaGrafico.map((linha) => {
                        const percentual = maxBeneficioGrafico > 0 ? (linha.valor / maxBeneficioGrafico) * 100 : 0

                        return (
                          <div className="print-horizontal-chart__row" key={`grafico-retorno-${linha.ano}`}>
                            <div className="print-horizontal-chart__y-value">{linha.label}</div>
                            <div className="print-horizontal-chart__bar-group" aria-hidden="true">
                              <div className="print-horizontal-chart__bar-track">
                                <div
                                  className="print-horizontal-chart__bar"
                                  style={{ width: `${percentual}%`, background: 'var(--print-chart-color-primary)' }}
                                />
                              </div>
                            </div>
                            <div className="print-horizontal-chart__values">
                              <div className="print-horizontal-chart__value">
                                <strong>{currency(linha.valor)}</strong>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                {beneficioAno30Printable ? (
                  <p className="chart-explainer no-break-inside">
                    Em <strong>30 anos</strong>, a SolarInvest projeta um benefício acumulado de
                    <strong>{` ${currency(beneficioAno30Printable.Leasing)}`}</strong>
                    {mostrarFinanciamento ? (
                      <>
                        {' '}
                        {isVendaDireta ? 'na venda direta e de' : 'no leasing e de'}
                        <strong>{` ${currency(beneficioAno30Printable.Financiamento)}`}</strong>{' '}
                        {isVendaDireta
                          ? 'com financiamento como alternativa de pagamento.'
                          : 'com financiamento.'}
                      </>
                    ) : (
                      <> comparado à concessionária.</>
                    )}{' '}
                    {economiaContext}
                  </p>
                ) : null}
                {!isVendaDireta ? (
                  <p className="print-chart-footnote no-break-inside">{economiaFootnote}</p>
                ) : null}
              </>
            ) : (
              <p className="muted no-break-inside">
                Não há dados suficientes para calcular a economia projetada desta proposta.
              </p>
            )}
          </section>

          <PrintableProposalImages images={imagensInstalacao} />

          {configuracaoUsinaObservacoesParagrafos.length > 0 ? (
            <section
              id="observacoes-configuracao"
              className="print-section keep-together avoid-break"
            >
              <h2 className="section-title keep-with-next">Observações sobre a configuração</h2>
              <div className="print-observacoes no-break-inside">
                {configuracaoUsinaObservacoesParagrafos.map((paragrafo, index) => {
                  const linhas = normalizeNewlines(paragrafo).split('\n')

                  return (
                    <p
                      key={`observacao-configuracao-${index}`}
                      className="print-observacoes__paragraph"
                    >
                      {linhas.map((linha, linhaIndex) => (
                        <React.Fragment key={linhaIndex}>
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
            <h2 className="keep-with-next">Informações importantes</h2>
            <ul className="no-break-inside">
              {isVendaDireta ? (
                <>
                  <li>
                    1. Objeto da Proposta<br />
                    Esta proposta refere-se exclusivamente à venda do sistema fotovoltaico.
                  </li>
                  <li>
                    2. Equipamentos<br />
                    Todos os equipamentos possuem certificação INMETRO (ou equivalente) e seguem normas técnicas vigentes.
                    Modelos específicos estão sujeitos à disponibilidade; em caso de falta de estoque, poderão ser substituídos
                    por equivalentes ou superiores, sem prejuízo de desempenho.
                  </li>
                  <li>
                    3. Valores e Projeções<br />
                    Valores, condições e prazos apresentados são estimativas preliminares e poderão ser ajustados na contratação.
                    As projeções consideram produção estimada, tarifa vigente, inflação energética informada e aplicação da taxa
                    mínima (CID). O desempenho real pode variar conforme clima, sombreamento, condições de instalação,
                    degradação natural dos módulos e alterações tarifárias.
                  </li>
                  <li>
                    4. Pagamento e Fluxo Financeiro<br />
                    Parcelamentos via cartão, financiamento ou intermediários podem alterar o fluxo de caixa e o ROI estimado.
                  </li>
                  <li>
                    5. Prazo e Instalação<br />
                    O cronograma depende de vistoria técnica, disponibilidade de materiais, condições climáticas e eventuais
                    exigências da distribuidora. O prazo de instalação inicia após confirmação do pedido e entrega integral dos
                    materiais.
                  </li>
                  <li>
                    6. Custos Logísticos<br />
                    Para instalações localizadas a uma distância superior a 50 km da sede operacional da SolarInvest, em Anápolis/GO,
                    será aplicado custo logístico adicional no valor de R$ 3,00 (três reais) por quilômetro rodado, considerando ida e
                    volta, calculado com base na distância rodoviária aferida via Google Maps.
                  </li>
                  <li>
                    7. Garantias e Serviços<br />
                    Equipamentos seguem garantias dos fabricantes. Oferecemos 1 ano de garantia de instalação. Manutenção
                    preventiva/corretiva e seguros são opcionais, quando aplicáveis.
                  </li>
                  <li>
                    8. Itens Não Inclusos<br />
                    Serviços ou adequações externas ao escopo do sistema não estão incluídos, tais como reforços estruturais,
                    ajustes elétricos internos, troca de padrão ou exigências de órgãos públicos, além de segurança ou
                    armazenamento de materiais no local. Outros itens não mencionados, quando não relacionados diretamente à
                    instalação do sistema, também não fazem parte desta proposta.
                  </li>
                  <li>
                    9. Responsabilidades Técnicas<br />
                    Incluem dimensionamento do sistema, elaboração do projeto, fornecimento de materiais, acompanhamento junto à
                    distribuidora (quando aplicável), instalação e comissionamento. O dimensionamento poderá ser ajustado após
                    vistoria, conforme orientação da cobertura, estrutura e sombreamento real.
                  </li>
                </>
              ) : (
                <>
                  <li>Desconto contratual aplicado: {descontoResumo} sobre a tarifa da distribuidora.</li>
                  <li>Prazo de vigência: conforme especificado na proposta (ex.: 60 meses).</li>
                  <li>Tarifas por kWh são projeções, podendo variar conforme reajustes autorizados pela ANEEL.</li>
                  <li>
                    Durante o contrato, a SolarInvest é responsável por manutenção, suporte técnico, limpeza e seguro sinistro da usina.
                  </li>
                  <li>
                    Transferência da usina ao cliente ao final do contrato sem custo adicional, desde que obrigações contratuais estejam
                    cumpridas.
                  </li>
                  <li>Tabela de compra antecipada disponível mediante solicitação.</li>
                  <li>Equipamentos utilizados possuem certificação INMETRO.</li>
                  <li>
                    Os valores apresentados nesta proposta são estimativas preliminares e poderão sofrer ajustes no contrato definitivo.
                  </li>
                </>
              )}
            </ul>
            {pdfConfig.observacaoPadrao ? (
              <p className="print-important__observation no-break-inside">{pdfConfig.observacaoPadrao}</p>
            ) : null}
          </section>
    
          <section className="print-section print-cta no-break-inside avoid-break">
            <div className="print-cta__box no-break-inside">
              <h2 className="keep-with-next">Vamos avançar?</h2>
              <p>
                Agende uma visita técnica gratuita com nossa equipe para confirmar a viabilidade e formalizar a proposta definitiva.
              </p>
            </div>
          </section>

          <section className="print-section print-section--footer no-break-inside avoid-break">
            <footer className="print-final-footer no-break-inside">
              <div className="print-final-footer__dates">
                <p>
                  <strong>Data de emissão da proposta:</strong> {emissaoTexto}
                </p>
                <p>
                  <strong>Validade da proposta:</strong> {validadePropostaLabel}
                </p>
              </div>
              <div className="print-final-footer__signature">
                <div className="signature-line" />
                <span>Assinatura do cliente</span>
                <p className="print-final-footer__signature-note">
                  Ao assinar esta proposta, o cliente apenas manifesta sua intenção de contratar com a SolarInvest. Este
                  documento não constitui contrato nem gera obrigações firmes para nenhuma das partes.
                </p>
              </div>
            </footer>

            <div className="print-brand-footer no-break-inside">
              <strong>S O L A R I N V E S T</strong>
              <span>Transformando sua economia mensal em patrimônio real</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export const PrintableProposalVendaInner = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalInner,
)

export default PrintableProposalVendaInner
