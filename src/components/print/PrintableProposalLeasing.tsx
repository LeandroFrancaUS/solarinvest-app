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
import { formatAxis, formatCpfCnpj } from '../../utils/formatters'
import {
  formatMoneyBR,
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
  fmt,
} from '../../lib/locale/br-number'
import { agrupar, type Linha } from '../../lib/pdf/grouping'
import type { PrintableOrcamentoItem, PrintableProposalProps } from '../../types/printableProposal'

const ECONOMIA_MARCOS = [5, 6, 10, 15, 20, 30]
const DEFAULT_CHART_COLORS = ['#1D4ED8', '#1E3A8A', '#2563EB', '#38BDF8', '#60A5FA', '#93C5FD']

const toDisplayPercent = (value?: number, fractionDigits = 1) => {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return formatPercentBRWithDigits((value ?? 0) / 100, fractionDigits)
}

const formatQuantity = (value?: number | null) => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return '—'
  }
  return formatNumberBRWithOptions(value ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

const formatPrazoMeses = (meses?: number | null) => {
  if (!Number.isFinite(meses) || (meses ?? 0) <= 0) {
    return '—'
  }
  return `${formatNumberBRWithOptions(meses ?? 0, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} meses`
}

const buildDescricao = (
  item: PrintableOrcamentoItem | undefined,
  linha: Linha,
): string => {
  const descricao = item?.descricao?.trim()
  if (descricao) {
    return descricao
  }
  const modelo = linha.modelo?.trim()
  const fabricante = linha.fabricante?.trim()
  const complementos = [modelo, fabricante].filter(Boolean).join(' · ')
  if (complementos) {
    return complementos
  }
  return linha.nome || '—'
}

type ComposicaoItem = { produto: string; descricao: string; quantidade: number | null }

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
    areaInstalacao,
    capex,
    buyoutResumo,
    anos,
    leasingROI,
    parcelasLeasing,
    distribuidoraTarifa,
    leasingDataInicioOperacao,
    leasingValorInstalacaoCliente,
    leasingPrazoContratualMeses,
    leasingValorMercadoProjetado,
    tabelaBuyout,
    orcamentoItens,
  } = props

  const documentoCliente = cliente.documento ? formatCpfCnpj(cliente.documento) : null
  const codigoOrcamento = budgetId?.trim() || null
  const distribuidoraLabel = distribuidoraTarifa?.trim() || cliente.distribuidora?.trim() || null

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
  const emissaoTexto = emissaoData.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const proposalCode = useMemo(() => {
    if (!codigoOrcamento) {
      return 'SLRINVST-000000'
    }
    const normalized = codigoOrcamento.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    const digits = normalized.replace(/\D/g, '')
    const sufixo = (digits || normalized).slice(-6).padStart(6, '0')
    return `SLRINVST-${sufixo}`
  }, [codigoOrcamento])

  const producaoAnual = Number.isFinite(geracaoMensalKwh) ? (geracaoMensalKwh ?? 0) * 12 : null
  const producaoAnualTexto = Number.isFinite(producaoAnual) && (producaoAnual ?? 0) > 0
    ? `${formatNumberBRWithOptions(producaoAnual ?? 0, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} kWh/ano`
    : '—'

  const economiaAnualBase =
    tarifaCheiaBase > 0 && energiaContratadaBase > 0 && descontoFracao > 0
      ? tarifaCheiaBase * energiaContratadaBase * descontoFracao * 12
      : 0
  const economiaAnualLabel = economiaAnualBase > 0 ? formatMoneyBR(economiaAnualBase) : '—'

  const mensalidadeReferencia = useMemo(() => {
    if (parcelasLeasing.length > 0) {
      const primeira = parcelasLeasing[0]
      if (Number.isFinite(primeira?.mensalidade) && (primeira?.mensalidade ?? 0) > 0) {
        return primeira?.mensalidade ?? 0
      }
    }
    if (energiaContratadaBase > 0 && tarifaCheiaBase > 0) {
      return energiaContratadaBase * tarifaCheiaBase * (1 - descontoFracao)
    }
    return 0
  }, [descontoFracao, energiaContratadaBase, parcelasLeasing, tarifaCheiaBase])

  const mensalidadeLabel = mensalidadeReferencia > 0 ? formatMoneyBR(mensalidadeReferencia) : '—'

  const compraAntecipadaValor = useMemo(() => {
    const valores = tabelaBuyout
      ?.map((row) => row.valorResidual)
      .filter((valor): valor is number => Number.isFinite(valor) && (valor ?? 0) > 0)
    if (valores && valores.length > 0) {
      return Math.min(...valores)
    }
    return valorMercadoProjetado > 0 ? valorMercadoProjetado : null
  }, [tabelaBuyout, valorMercadoProjetado])

  const compraAntecipadaLabel =
    compraAntecipadaValor != null ? formatMoneyBR(compraAntecipadaValor) : 'Sob consulta'

  const composicaoAgrupada = useMemo(() => {
    if (!orcamentoItens || orcamentoItens.length === 0) {
      return null
    }

    const linhas = orcamentoItens.map((item) => ({
      nome: item.produto,
      codigo: item.codigo,
      modelo: item.modelo,
      fabricante: item.fabricante,
      quantidade: item.quantidade ?? null,
      referencia: item,
    })) as Array<Linha & { referencia: PrintableOrcamentoItem }>

    const agrupado = agrupar(linhas)

    const mapear = (lista: Array<Linha & { referencia?: PrintableOrcamentoItem }>): ComposicaoItem[] =>
      lista.map((linha) => {
        const referencia = linha.referencia
        const produto = referencia?.produto?.trim() || linha.nome || '—'
        const quantidade = Number.isFinite(referencia?.quantidade)
          ? (referencia?.quantidade ?? null)
          : linha.quantidade ?? null
        return {
          produto,
          descricao: buildDescricao(referencia, linha),
          quantidade: quantidade ?? null,
        }
      })

    const hardware: ComposicaoItem[] = [
      ...mapear(agrupado.Hardware.Modulos as Array<Linha & { referencia?: PrintableOrcamentoItem }>),
      ...mapear(agrupado.Hardware.Inversores as Array<Linha & { referencia?: PrintableOrcamentoItem }>),
      ...mapear(
        agrupado.Hardware.KitsECabosEAterramentoEAcessorios as Array<
          Linha & { referencia?: PrintableOrcamentoItem }
        >,
      ),
    ]

    const servicos: ComposicaoItem[] = mapear(
      agrupado.Servicos.EngenhariaEInstalacaoEHomologacao as Array<
        Linha & { referencia?: PrintableOrcamentoItem }
      >,
    )

    const normalizar = (lista: ComposicaoItem[]) =>
      lista.filter((item) => (item.produto && item.produto !== '—') || item.descricao.trim())

    return {
      hardware: normalizar(hardware),
      servicos: normalizar(servicos),
    }
  }, [orcamentoItens])

  const beneficioAno30 = economiaProjetada.find((item) => item.ano === 30) ?? null
  const investimentoBase = capex > 0 ? capex : valorMercadoProjetado
  const roiFracao = beneficioAno30 && investimentoBase > 0 ? beneficioAno30.acumulado / investimentoBase : null
  const roiLabel =
    roiFracao && Number.isFinite(roiFracao) && roiFracao > 0
      ? formatPercentBRWithDigits(roiFracao, 1)
      : '—'

  const paybackAlvo =
    investimentoBase > 0
      ? economiaProjetada.find((item) => item.acumulado >= investimentoBase)
      : beneficioAno30
  const paybackLabel = paybackAlvo
    ? investimentoBase > 0
      ? `${formatNumberBRWithOptions(paybackAlvo.ano, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })} anos`
      : 'Imediato'
    : '—'

  const chartBarColor = DEFAULT_CHART_COLORS[2] ?? DEFAULT_CHART_COLORS[0]
  const economiaExplainer: React.ReactNode = beneficioAno30 ? (
    <>
      <strong>Economia acumulada em 30 anos:</strong> Em {beneficioAno30.ano} anos, o cliente poderá economizar
      aproximadamente <strong>{formatMoneyBR(beneficioAno30.acumulado)}</strong>, considerando reajustes médios de
      tarifa e a transferência definitiva da usina ao final da vigência.
    </>
  ) : (
    <>Economia projetada considerando reajustes anuais de energia, estabilidade contratual e a posse integral da usina.</>
  )

  const cidadeUf = [cliente.cidade?.trim(), cliente.uf?.trim()].filter(Boolean).join(' / ')
  const coverIntro =
    'Solução completa de geração distribuída com instalação, operação e manutenção realizadas pela SolarInvest. Você economiza desde o primeiro mês e assume a propriedade da usina ao final do contrato.'

  const informacoesImportantes = [
    `Desconto contratual aplicado: ${toDisplayPercent(descontoContratualPct)} sobre a tarifa da distribuidora.`,
    `Prazo de vigência estimado: ${formatPrazoMeses(prazoContratual)}.`,
    'Tarifas e projeções podem variar conforme reajustes autorizados pela ANEEL.',
    'Operação, manutenção, limpeza, monitoramento e seguro da usina ficam sob responsabilidade da SolarInvest durante o contrato.',
    'A transferência da usina para o cliente ocorre ao final da vigência sem custos adicionais.',
    'Tabela de compra antecipada disponível mediante solicitação.',
    'Equipamentos homologados e com certificação INMETRO.',
    'Valores sujeitos a vistoria técnica e formalização contratual.',
  ]

  const observacoesContrato = [
    'Mensalidades reajustadas conforme índice contratual de energia.',
    'Possibilidade de compra antecipada do ativo mediante negociação.',
    'Instalação, monitoramento remoto e suporte técnico inclusos.',
  ]

  const contratoResumo = [
    { label: 'Vigência do contrato', value: formatPrazoMeses(prazoContratual) },
    { label: 'Mensalidade inicial estimada', value: mensalidadeLabel },
    { label: 'Desconto sobre a tarifa', value: toDisplayPercent(descontoContratualPct) },
    { label: 'Compra antecipada da usina', value: compraAntecipadaLabel },
    { label: 'CAPEX SolarInvest', value: capex > 0 ? formatMoneyBR(capex) : '—' },
  ]

  return (
    <div ref={ref} className="leasing-print-layout">
      <section className="leasing-cover">
        <div className="leasing-cover__logo">
          <img src="/logo.svg" alt="SolarInvest" />
        </div>
        <div className="leasing-cover__identity">
          <span className="leasing-cover__code">{proposalCode}</span>
          <h1>Proposta de Leasing Solar</h1>
          <p className="leasing-cover__client">
            {cliente.nome || 'Cliente SolarInvest'}
            {documentoCliente ? ` · ${documentoCliente}` : ''}
          </p>
          {cliente.endereco?.trim() ? (
            <p className="leasing-cover__location">{cliente.endereco.trim()}</p>
          ) : null}
          <p className="leasing-cover__meta">
            {cidadeUf || 'Localidade não informada'} · Emitida em {emissaoTexto}
          </p>
        </div>
        <p className="leasing-cover__intro">{coverIntro}</p>
      </section>

      <section className="leasing-section leasing-section--technical">
        <h2>Detalhamento técnico</h2>
        <dl className="leasing-detail-grid">
          <div className="leasing-detail">
            <dt>Potência instalada</dt>
            <dd>{fmt.kwp(potenciaInstaladaKwp)}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Geração estimada</dt>
            <dd>{fmt.kwhMes(geracaoMensalKwh)}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Produção anual</dt>
            <dd>{producaoAnualTexto}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Energia contratada</dt>
            <dd>{fmt.kwhMes(energiaContratadaKwh)}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Potência dos módulos</dt>
            <dd>{fmt.wp(potenciaModulo)}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Quantidade de módulos</dt>
            <dd>{formatQuantity(numeroModulos)}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Área útil considerada</dt>
            <dd>{fmt.m2(areaInstalacao)}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Tipo de instalação</dt>
            <dd>{tipoInstalacao === 'SOLO' ? 'Solo' : 'Telhado'}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Distribuidora</dt>
            <dd>{distribuidoraLabel || '—'}</dd>
          </div>
          <div className="leasing-detail">
            <dt>Início estimado</dt>
            <dd>{inicioOperacaoTexto || 'Após vistoria técnica'}</dd>
          </div>
        </dl>
      </section>

      <section className="leasing-section leasing-section--composition">
        <h2>Composição do sistema</h2>
        {composicaoAgrupada ? (
          <div className="leasing-composition">
            <div className="leasing-composition__group">
              <h3>Hardware</h3>
              {composicaoAgrupada.hardware.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Descrição</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {composicaoAgrupada.hardware.map((item, index) => (
                      <tr key={`hardware-${item.produto}-${index}`}>
                        <td>{item.produto}</td>
                        <td>{item.descricao}</td>
                        <td className="leasing-table-value">{formatQuantity(item.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="leasing-muted">Itens de hardware serão definidos após a visita técnica.</p>
              )}
            </div>
            <div className="leasing-composition__group">
              <h3>Serviços</h3>
              {composicaoAgrupada.servicos.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Descrição</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {composicaoAgrupada.servicos.map((item, index) => (
                      <tr key={`servico-${item.produto}-${index}`}>
                        <td>{item.produto}</td>
                        <td>{item.descricao}</td>
                        <td className="leasing-table-value">{formatQuantity(item.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="leasing-muted">Serviços detalhados após validação técnica.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="leasing-muted">Itens serão detalhados após a validação técnica do projeto.</p>
        )}
      </section>

      <section className="leasing-section leasing-section--contract">
        <h2>Condições do contrato</h2>
        <dl className="leasing-contract-grid">
          {contratoResumo.map((item) => (
            <div className="leasing-contract-item" key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="leasing-contract-extra">
          <span>Investimento direto do cliente</span>
          <strong>{valorInstalacaoCliente > 0 ? formatMoneyBR(valorInstalacaoCliente) : 'Isento'}</strong>
        </div>
        <ul className="leasing-contract-notes">
          {observacoesContrato.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="leasing-section leasing-section--benefits">
        <h2>Benefícios e retorno</h2>
        <div className="leasing-kpi-grid">
          <div className="leasing-kpi">
            <span>ROI acumulado (30 anos)</span>
            <strong>{roiLabel}</strong>
          </div>
          <div className="leasing-kpi">
            <span>Payback estimado</span>
            <strong>{paybackLabel}</strong>
          </div>
          <div className="leasing-kpi">
            <span>Economia anual estimada</span>
            <strong>{economiaAnualLabel}</strong>
          </div>
        </div>
        <div className="leasing-benefits-chart">
          <ResponsiveContainer width="50%" height={240}>
            <BarChart layout="vertical" data={economiaChartData} margin={{ top: 5, right: 6, bottom: 7, left: 6 }}>
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
                formatter={(value: number) => formatMoneyBR(Number(value))}
                labelFormatter={(value) => `${value}º ano`}
                contentStyle={{ borderRadius: 12, borderColor: '#94a3b8', padding: 12 }}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" strokeWidth={1} />
              <Bar
                dataKey="beneficio"
                fill={chartBarColor}
                barSize={14}
                radius={[0, 8, 8, 0]}
                isAnimationActive={false}
                name="Economia acumulada"
              >
                <LabelList
                  dataKey="beneficio"
                  position="right"
                  formatter={(value: number) => formatMoneyBR(Number(value))}
                  fill={chartBarColor}
                  style={{ fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="leasing-benefits-highlights">
          {ECONOMIA_MARCOS.map((ano, index) => {
            const row = economiaProjetada.find((item) => item.ano === ano)
            const color = DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
            return (
              <li key={`economia-${ano}`}>
                <span className="leasing-benefits-highlights__year">{`${ano}º ano`}</span>
                <div className="leasing-benefits-highlights__values">
                  <span className="leasing-benefits-highlights__value" style={{ color }}>
                    Economia acumulada: {row ? formatMoneyBR(row.acumulado) : '—'}
                  </span>
                  <span className="leasing-benefits-highlights__value">
                    Economia no ano: {row ? formatMoneyBR(row.economiaAnual) : '—'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="leasing-chart-note">{economiaExplainer}</p>
      </section>

      <section className="leasing-section leasing-section--info">
        <h2>Informações importantes</h2>
        <ul className="leasing-info-list">
          {informacoesImportantes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <footer className="leasing-footer">
        <div className="leasing-footer__brand">
          <img src="/logo.svg" alt="SolarInvest" />
          <div>
            <strong>SolarInvest Energia Solar</strong>
            <span>CNPJ: 60.434.015/0001-90</span>
          </div>
        </div>
        <div className="leasing-footer__contact">
          <span>Av. Nossa Senhora do Carmo, 1200 - Belo Horizonte/MG</span>
          <span>www.solarinvest.com.br</span>
        </div>
        <p className="leasing-footer__tagline">Energia inteligente, sustentável e sem investimento inicial.</p>
      </footer>
    </div>
  )
}

export const PrintableProposalLeasing = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  PrintableProposalLeasingInner,
)

export default PrintableProposalLeasing
