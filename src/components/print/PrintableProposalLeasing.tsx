import React, { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import './styles/proposal-leasing.css'
import { currency, formatAxis, formatCpfCnpj, tarifaCurrency } from '../../utils/formatters'
import {
  formatMoneyBR,
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
} from '../../lib/locale/br-number'
import type { PrintableProposalProps } from '../../types/printableProposal'
import { ClientInfoGrid, type ClientInfoField } from './common/ClientInfoGrid'
import { agrupar, type Linha } from '../../lib/pdf/grouping'
import { usePrintCanvasFallback } from './common/usePrintCanvasFallback'

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

const ECONOMIA_MARCOS = [5, 6, 10, 15, 20, 30]
const DEFAULT_CHART_COLORS = ['#2563EB', '#0f172a'] as const

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
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
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
    leasingValorMercadoProjetado,
    leasingInflacaoEnergiaAa,
    orcamentoItens,
    informacoesImportantesObservacao,
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

  const primaryChartColor = DEFAULT_CHART_COLORS[0] ?? '#2563EB'
  const secondaryChartColor = DEFAULT_CHART_COLORS[1] ?? '#0f172a'

  usePrintCanvasFallback('#economia-30-anos')

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
  const valorMercadoProjetado = Number.isFinite(leasingValorMercadoProjetado)
    ? Math.max(0, leasingValorMercadoProjetado ?? 0)
    : Math.max(0, buyoutResumo?.vm0 ?? 0)
  const inicioOperacaoTexto = leasingDataInicioOperacao?.trim() || null

  const investimentoSolarinvestFormatado =
    Number.isFinite(leasingValorDeMercadoEstimado) && (leasingValorDeMercadoEstimado ?? 0) > 0
      ? formatMoneyBR(leasingValorDeMercadoEstimado ?? 0)
      : '—'

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

  const resumoProposta = [
    {
      label: 'Modalidade de contratação',
      value: 'Leasing SolarInvest',
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

  const { modeloModulo, modeloInversor } = useMemo(() => {
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

  const condicoesFinanceiras = [
    {
      label: 'Investimento estimado da SolarInvest (R$)',
      value: valorMercadoProjetado > 0 ? currency(valorMercadoProjetado) : '—',
    },
    {
      label: 'Valor da instalação para o cliente (R$)',
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
      value: prazoContratual > 0 ? `${prazoContratual} meses` : '—',
    },
  ]

  const mensalidadesPorAno = useMemo(() => {
    const anosConsiderados = [1, 2, 3, 4, 5]
    return anosConsiderados.map((ano) => {
      const fator = Math.pow(1 + Math.max(-0.99, inflacaoEnergiaFracao), Math.max(0, ano - 1))
      const tarifaAno = tarifaCheiaBase * fator
      const tarifaComDesconto = tarifaAno * (1 - descontoFracao)
      const mensalidade = energiaContratadaBase * tarifaComDesconto
      const contaDistribuidora = energiaContratadaBase * tarifaAno
      return {
        ano,
        tarifaCheiaAno: tarifaAno,
        tarifaComDesconto,
        contaDistribuidora,
        mensalidade,
      }
    })
  }, [descontoFracao, energiaContratadaBase, inflacaoEnergiaFracao, tarifaCheiaBase])

  const economiaProjetada = useMemo(() => {
    return ECONOMIA_MARCOS.map((ano) => {
      if (!anos.includes(ano)) {
        return null
      }
      const acumulado = leasingROI[ano - 1] ?? 0
      const anterior = ano > 1 ? leasingROI[ano - 2] ?? 0 : 0
      return {
        ano,
        acumulado,
        economiaAnual: acumulado - anterior,
      }
    }).filter((row): row is { ano: number; acumulado: number; economiaAnual: number } => row !== null)
  }, [anos, leasingROI])

  const economiaChartData = useMemo(
    () =>
      economiaProjetada.map((item) => ({
        ano: item.ano,
        beneficio: item.acumulado,
      })),
    [economiaProjetada],
  )

  const economiaChartDomain = useMemo(() => {
    if (economiaChartData.length === 0) {
      return { min: -1, max: 1 }
    }

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    economiaChartData.forEach((row) => {
      const valor = row.beneficio
      if (Number.isFinite(valor)) {
        min = Math.min(min, valor)
        max = Math.max(max, valor)
      }
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
  }, [economiaChartData])

  const emissaoData = new Date()
  const validadeData = new Date(emissaoData.getTime())
  validadeData.setDate(validadeData.getDate() + 15)
  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const emissaoTexto = formatDate(emissaoData)
  const validadeTexto = formatDate(validadeData)
  const heroSummary =
    'Apresentamos sua proposta personalizada de energia solar com leasing da SolarInvest. Nesta modalidade, você gera sua própria energia com economia desde o 1º mês, sem precisar investir nada. Ao final do contrato, a usina é transferida gratuitamente para você, tornando-se um patrimônio durável, valorizando seu imóvel.'
  const beneficioAno30 = economiaProjetada.find((item) => item.ano === 30) ?? null
  const economiaExplainer: React.ReactNode = beneficioAno30 ? (
    <>
      <strong>Economia acumulada em 30 anos:</strong> Em {beneficioAno30.ano} anos, a SolarInvest projeta um
      benefício total de <strong>{currency(beneficioAno30.acumulado)}</strong>. Essa trajetória considera os reajustes
      anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.
    </>
  ) : (
    <>Economia que cresce ano após ano. Essa trajetória considera os reajustes anuais de energia, a previsibilidade contratual e a posse integral da usina ao final do acordo.</>
  )
  const informacoesImportantesObservacaoTexto = useMemo(() => {
    if (typeof informacoesImportantesObservacao !== 'string') {
      return null
    }

    const texto = informacoesImportantesObservacao.trim()
    return texto ? texto : null
  }, [informacoesImportantesObservacao])

  return (
    <div ref={ref} className="print-layout leasing-print-layout">
      <header className="print-hero">
        <div className="print-hero__header">
          <div className="print-hero__identity">
            <div className="print-logo">
              <img src="/logo.svg" alt="SolarInvest" />
            </div>
            <div className="print-hero__title">
              <span className="print-hero__eyebrow">SolarInvest</span>
              <h1>Proposta de Leasing Solar</h1>
              <p className="print-hero__tagline">Energia inteligente, sustentável e sem investimento inicial.</p>
            </div>
          </div>
        </div>
        <div className="print-hero__meta">
          <div className="print-hero__meta-item">
            <small>Código do orçamento: </small>
            <strong>{codigoOrcamento || '—'}</strong>
          </div>
          <div className="print-hero__meta-item">
            <small>Data de emissão: </small>
            <strong>{emissaoTexto}</strong>
          </div>
        </div>
        <div className="print-hero__summary no-break-inside">
          <p>{heroSummary}</p>
        </div>
      </header>

      <section className="print-section keep-together">
        <h2 className="section-title keep-with-next">Identificação do Cliente</h2>
        <ClientInfoGrid
          fields={resumoCampos}
          className="print-client-grid no-break-inside"
          fieldClassName="print-client-field"
          wideFieldClassName="print-client-field--wide"
        />
      </section>

      <section id="resumo-proposta" className="print-section keep-together page-break-before">
        <h2 className="section-title keep-with-next">Resumo da Proposta</h2>
        <p className="section-subtitle keep-with-next">Visão geral dos parâmetros comerciais e técnicos</p>
        <table className="no-break-inside">
          <thead>
            <tr>
              <th>Parâmetro</th>
              <th>Valor</th>
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

      <section className="print-section keep-together">
        <h2 className="section-title keep-with-next">Especificações da Usina Solar</h2>
        <p className="section-subtitle keep-with-next">Configuração técnica do sistema proposto</p>
        <table className="no-break-inside">
          <thead>
            <tr>
              <th>Item</th>
              <th>Valor</th>
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
        className="print-section keep-together page-break-before"
      >
        <h2 className="section-title keep-with-next">Condições Financeiras do Leasing</h2>
        <p className="section-subtitle keep-with-next">Valores projetados e vigência contratual</p>
        <table className="no-break-inside">
          <thead>
            <tr>
              <th>Item</th>
              <th>Valor</th>
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

      <section className="print-section keep-together">
        <h2 className="section-title keep-with-next">Evolução das Mensalidades e Economia</h2>
        <p className="section-subtitle keep-with-next">Comparativo anual entre tarifa convencional e SolarInvest</p>
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
      </section>

      <section
        id="economia-30-anos"
        className="print-section print-chart-section keep-together page-break-before"
      >
        <h2 className="section-title keep-with-next">Economia Acumulada ao Longo de 30 Anos</h2>
        <div className="section-grid print-chart-layout no-break-inside">
          <div className="print-chart leasing-chart no-break-inside">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                layout="vertical"
                data={economiaChartData}
                margin={{ top: 5, right: 6, bottom: 7, left: 6 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#0f172a"
                  tickFormatter={formatAxis}
                  tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#0f172a', strokeWidth: 1 }}
                  tickLine={false}
                  domain={[economiaChartDomain.min, economiaChartDomain.max]}
                >
                  <Label
                    value="Benefício acumulado (R$)"
                    position="insideBottom"
                    offset={-32}
                    style={{ fill: '#0f172a', fontSize: 13, fontWeight: 700 }}
                  />
                </XAxis>
                <YAxis
                  type="category"
                  dataKey="ano"
                  stroke="#0f172a"
                  tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#0f172a', strokeWidth: 1 }}
                  tickLine={false}
                  width={120}
                  tickFormatter={(valor) => `${valor}º ano`}
                />
                <Tooltip
                  formatter={(value: number) => currency(Number(value))}
                  labelFormatter={(value) => `${value}º ano`}
                  contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', padding: 12 }}
                  wrapperStyle={{ zIndex: 1000 }}
                />
                <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" strokeWidth={1} />
                <Bar
                  dataKey="beneficio"
                  fill={primaryChartColor}
                  barSize={14}
                  radius={[0, 8, 8, 0]}
                  isAnimationActive={false}
                  name="Economia acumulada"
                >
                  <LabelList
                    dataKey="beneficio"
                    position="right"
                    formatter={(value: number) => currency(Number(value))}
                    fill={primaryChartColor}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="print-chart-highlights no-break-inside">
            {ECONOMIA_MARCOS.map((ano) => {
              const row = economiaProjetada.find((item) => item.ano === ano)
              return (
                <li key={`economia-${ano}`}>
                  <span className="print-chart-highlights__year">{`${ano}º ano`}</span>
                  <div className="print-chart-highlights__values">
                    <span className="print-chart-highlights__value" style={{ color: primaryChartColor }}>
                      Economia acumulada: {row ? currency(row.acumulado) : '—'}
                    </span>
                    <span
                      className="print-chart-highlights__value"
                      style={{ color: secondaryChartColor }}
                    >
                      Economia no ano: {row ? currency(row.economiaAnual) : '—'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="leasing-chart-note no-break-inside">{economiaExplainer}</p>
      </section>

      <section
        id="infos-importantes"
        className="print-section print-important keep-together page-break-before"
      >
        <h2 className="section-title keep-with-next">Informações Importantes</h2>
        <p className="section-subtitle keep-with-next">
          <strong>Responsabilidades, garantias e condições gerais</strong>
        </p>
        <ul className="no-break-inside">
          <li>
            Durante toda a vigência do contrato, a SolarInvest é responsável pela{' '}
            <strong>operação, manutenção, suporte técnico, limpeza e seguro integral</strong> da usina.
          </li>
          <li>
            As tarifas de energia apresentadas são{' '}
            <strong>projeções baseadas nas condições atuais de mercado</strong> e podem variar conforme{' '}
            <strong>reajustes autorizados pela ANEEL</strong>, aplicação de <strong>bandeiras tarifárias</strong> ou{' '}
            <strong>mudanças na matriz energética</strong>.
          </li>
          <li>
            Todos os equipamentos fornecidos possuem <strong>certificação INMETRO</strong> e atendem às{' '}
            <strong>normas técnicas vigentes</strong>.
          </li>
          <li>
            A <strong>tabela de compra antecipada</strong> da usina está disponível mediante solicitação ao consultor{' '}
            SolarInvest.
          </li>
          <li>
            Os <strong>valores, taxas, tarifas e mensalidades</strong> exibidos representam{' '}
            <strong>simulações preliminares</strong>, calculadas com base em estimativas de consumo, tarifas vigentes e{' '}
            parâmetros técnicos médios.
          </li>
          <li>
            Essas <strong>simulações não constituem valores contratuais finais</strong> e poderão sofrer ajustes após a{' '}
            <strong>análise técnica</strong>, <strong>vistoria</strong>, <strong>alterações tarifárias</strong> ou{' '}
            <strong>atualizações comerciais da SolarInvest</strong>.
          </li>
          <li>
            A <strong>formalização definitiva</strong> dos valores e condições ocorrerá{' '}
            <strong>somente no momento da assinatura do contrato</strong>.
          </li>
        </ul>
        {informacoesImportantesObservacaoTexto ? (
          <p className="print-important__observation no-break-inside">{informacoesImportantesObservacaoTexto}</p>
        ) : null}
      </section>

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
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
