import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid } from 'recharts'

import {
  selectCreditoMensal,
  selectInflacaoMensal,
  selectBuyoutLinhas,
  selectKcAjustado,
  selectMensalidades,
  selectTarifaDescontada,
  selectMensalidadesPorAno,
  SimulationState,
  BuyoutLinha,
} from './selectors'
import { EntradaModo, tarifaDescontada as tarifaDescontadaCalc, tarifaProjetadaCheia } from './utils/calcs'
import { getIrradiacaoPorEstado, hasEstadoMinimo, IRRADIACAO_FALLBACK } from './utils/irradiacao'
import { getMesReajusteFromANEEL } from './utils/reajusteAneel'
import { getTarifaCheia } from './utils/tarifaAneel'
import { getDistribuidorasFallback, loadDistribuidorasAneel } from './utils/distribuidorasAneel'

const currency = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$\u00a00,00'

const tarifaCurrency = (v: number) =>
  Number.isFinite(v)
    ? v.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
    : 'R$\u00a00,000'

const formatAxis = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`
  return currency(v)
}

const DISTRIBUIDORAS_FALLBACK = getDistribuidorasFallback()
const UF_LABELS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
}

type TabKey = 'leasing' | 'cliente' | 'vendas'

type SeguroModo = 'A' | 'B'

type EntradaModoLabel = 'Crédito mensal' | 'Reduz piso contratado'

type ClienteDados = {
  nome: string
  documento: string
  email: string
  telefone: string
  distribuidora: string
  uc: string
  endereco: string
  cidade: string
  uf: string
}

type BuyoutRow = {
  mes: number
  tarifa: number
  prestacaoEfetiva: number
  prestacaoAcum: number
  cashback: number
  valorResidual: number | null
}

type BuyoutResumo = {
  vm0: number
  cashbackPct: number
  depreciacaoPct: number
  inadimplenciaPct: number
  tributosPct: number
  infEnergia: number
  ipca: number
  custosFixos: number
  opex: number
  seguro: number
  duracao: number
}

type PrintableProps = {
  cliente: ClienteDados
  anos: number[]
  leasingROI: number[]
  financiamentoFluxo: number[]
  financiamentoROI: number[]
  mostrarFinanciamento: boolean
  tabelaBuyout: BuyoutRow[]
  buyoutResumo: BuyoutResumo
  capex: number
  geracaoMensalKwh: number
  potenciaPlaca: number
  numeroPlacas: number
  potenciaInstaladaKwp: number
  descontoContratualPct: number
  parcelasLeasing: MensalidadeRow[]
}

type MensalidadeRow = {
  mes: number
  tarifaCheia: number
  tarifaDescontada: number
  mensalidadeCheia: number
  mensalidade: number
  totalAcumulado: number
}

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint ? <small>{hint}</small> : null}
  </div>
)

const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProps>(function PrintableProposal(
  {
    cliente,
    anos,
    leasingROI,
    financiamentoFluxo,
    financiamentoROI,
    mostrarFinanciamento,
    tabelaBuyout,
    buyoutResumo,
    capex,
    geracaoMensalKwh,
    potenciaPlaca,
    numeroPlacas,
    potenciaInstaladaKwp,
    descontoContratualPct,
    parcelasLeasing,
  },
  ref,
) {
  const duracaoContrato = Math.max(0, Math.floor(buyoutResumo.duracao || 0))
  const mesAceiteFinal = duracaoContrato + 1
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
    Number.isFinite(value) ? value.toLocaleString('pt-BR', options) : '—'
  const valorMercadoValido = typeof buyoutResumo.vm0 === 'number' && Number.isFinite(buyoutResumo.vm0)
  const valorMercadoTexto = valorMercadoValido ? currency(buyoutResumo.vm0) : '—'
  const duracaoContratualValida =
    typeof buyoutResumo.duracao === 'number' && Number.isFinite(buyoutResumo.duracao)
  const duracaoContratualTexto = duracaoContratualValida ? `${buyoutResumo.duracao} meses` : '—'
  const chartDataPrintable = useMemo(
    () =>
      anos.map((ano) => ({
        ano,
        Leasing: leasingROI[ano - 1] ?? 0,
        Financiamento: financiamentoROI[ano - 1] ?? 0,
      })),
    [anos, financiamentoROI, leasingROI],
  )
  const beneficioAno30Printable = useMemo(
    () => chartDataPrintable.find((row) => row.ano === 30) ?? null,
    [chartDataPrintable],
  )
  return (
    <div ref={ref} className="print-layout">
      <header className="print-header">
        <div className="print-logo">
          <img src="/logo.svg" alt="SolarInvest" />
        </div>
        <div className="print-client">
          <h1>SolarInvest - Proposta de Leasing</h1>
          <p><strong>Cliente:</strong> {cliente.nome || '—'}</p>
          <p><strong>Documento:</strong> {cliente.documento || '—'}</p>
          <p>
            <strong>E-mail:</strong> {cliente.email || '—'} • <strong>Telefone:</strong> {cliente.telefone || '—'}
          </p>
          <p>
            <strong>UC:</strong> {cliente.uc || '—'} • <strong>Distribuidora:</strong> {cliente.distribuidora || '—'}
          </p>
          <p>
            <strong>Endereço:</strong> {cliente.endereco || '—'} — {cliente.cidade || '—'} / {cliente.uf || '—'}
          </p>
        </div>
      </header>

      <section className="print-section">
        <h2>Resumo técnico e financeiro</h2>
        <div className="print-summary">
          <p>
            <strong>Investimento estimado:</strong> {currency(capex)}
          </p>
          <p>
            <strong>Geração estimada (kWh/mês):</strong> {formatNumber(geracaoMensalKwh)}
          </p>
          <p>
            <strong>Potência da placa (Wp):</strong> {formatNumber(potenciaPlaca, { maximumFractionDigits: 0 })}
          </p>
          <p>
            <strong>Nº de placas:</strong> {formatNumber(numeroPlacas, { maximumFractionDigits: 0 })}
          </p>
          <p>
            <strong>Potência instalada (kWp):</strong>{' '}
            {formatNumber(potenciaInstaladaKwp, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`print-grid ${mostrarFinanciamento ? 'two' : 'one'}`}>
          <div>
            <h3>Mensalidade projetada</h3>
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Tarifa projetada (R$/kWh)</th>
                  <th>Tarifa c/ desconto (R$/kWh)</th>
                  <th>Mensalidade cheia</th>
                  <th>Mensalidade com leasing</th>
                </tr>
              </thead>
              <tbody>
                {parcelasLeasing.length > 0 ? (
                  parcelasLeasing.map((row) => (
                    <tr key={`leasing-${row.mes}`}>
                      <td>{row.mes}</td>
                      <td>{tarifaCurrency(row.tarifaCheia)}</td>
                      <td>{tarifaCurrency(row.tarifaDescontada)}</td>
                      <td>{currency(row.mensalidadeCheia)}</td>
                      <td>{currency(row.mensalidade)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="muted">
                      Defina um prazo contratual para gerar a projeção das parcelas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {mostrarFinanciamento ? (
            <div>
              <h3>Financiamento</h3>
              <table>
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th>Fluxo anual</th>
                    <th>Beneficio acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {anos.map((ano) => (
                    <tr key={`fin-${ano}`}>
                      <td>{ano}</td>
                      <td>{currency(financiamentoFluxo[ano - 1] ?? 0)}</td>
                      <td>{currency(financiamentoROI[ano - 1] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="print-section">
        <h2>Compra antecipada</h2>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Valor de compra</th>
            </tr>
          </thead>
          <tbody>
            {tabelaBuyout
              .filter((row) => row.mes >= 7 && row.mes <= duracaoContrato)
              .map((row) => (
                <tr key={row.mes}>
                  <td>{row.mes}</td>
                  <td>{row.valorResidual === null ? '—' : currency(row.valorResidual)}</td>
                </tr>
              ))}
            <tr key={mesAceiteFinal}>
              <td>{`${mesAceiteFinal} (Aceite final)`}</td>
              <td>{currency(0)}</td>
            </tr>
          </tbody>
        </table>
        <div className="print-notes">
          <p><strong>Informações adicionais:</strong></p>
          <ul>
            <li>Valor de mercado: {valorMercadoTexto}</li>
            <li>
              Desconto contratual: {formatNumber(descontoContratualPct, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}%
            </li>
            <li>Duração contratual: {duracaoContratualTexto}</li>
          </ul>
        </div>
        <div className="print-chart-section">
          <div className="chart print-chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartDataPrintable}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="ano" stroke="#9CA3AF" label={{ value: 'Anos', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF' }} />
                <YAxis stroke="#9CA3AF" tickFormatter={formatAxis} />
                <Tooltip formatter={(value: number) => currency(Number(value))} contentStyle={{ background: '#0b1220', border: '1px solid #1f2b40' }} />
                <Legend verticalAlign="bottom" align="right" wrapperStyle={{ paddingTop: 16 }} />
                <ReferenceLine y={0} stroke="#475569" />
                <Line type="monotone" dataKey="Leasing" stroke={chartColors.Leasing} strokeWidth={2} dot />
                {mostrarFinanciamento ? (
                  <Line type="monotone" dataKey="Financiamento" stroke={chartColors.Financiamento} strokeWidth={2} dot />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {beneficioAno30Printable ? (
            <p className="chart-explainer">
              Beneficio acumulado em 30 anos:
              <strong style={{ color: chartColors.Leasing }}> {currency(beneficioAno30Printable.Leasing)}</strong>
              {mostrarFinanciamento ? (
                <>
                  {' • '}Financiamento:{' '}
                  <strong style={{ color: chartColors.Financiamento }}>{currency(beneficioAno30Printable.Financiamento)}</strong>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <p className="print-footer">
          Após o final do contrato. o cliente passa a capturar 100% da economia frente à concessionária
        </p>
      </section>
    </div>
  )
})

const anosAnalise = 30
const DIAS_MES_PADRAO = 30
const painelOpcoes = [450, 500, 550, 600, 610, 650, 700]
const chartColors: Record<'Leasing' | 'Financiamento', string> = {
  Leasing: '#FF8C00',
  Financiamento: '#60A5FA',
}

const printStyles = `
  *{box-sizing:border-box;font-family:'Inter','Roboto',sans-serif;}
  body{margin:0;padding:36px 44px;background:#ffffff;color:#0f172a;}
  h1,h2,h3{color:#0f172a;}
  .print-layout{display:block;max-width:1040px;margin:0 auto;}
  .print-header{display:flex;gap:24px;align-items:center;margin-bottom:24px;}
  .print-header img{height:72px;}
  .print-client p{margin:4px 0;font-size:13px;}
  .print-section{margin-bottom:28px;}
  .print-section h2{margin:0 0 12px;border-bottom:1px solid #cbd5f5;padding-bottom:4px;}
  table{width:100%;border-collapse:collapse;}
  th,td{border:1px solid #d0d7e8;padding:8px 12px;font-size:12px;text-align:left;}
  .print-summary p{font-size:12px;margin:2px 0;line-height:1.2;}
  .print-grid{display:grid;gap:16px;}
  .print-grid.two{grid-template-columns:repeat(2,minmax(0,1fr));}
  .print-grid.one{grid-template-columns:repeat(1,minmax(0,1fr));}
  ul{margin:8px 0 0;padding-left:18px;}
  li{font-size:12px;margin-bottom:4px;}
  .print-chart{position:relative;padding:16px;border:1px solid #cbd5f5;border-radius:12px;background:#f8fafc;}
  .print-chart .recharts-responsive-container{width:100%;height:100%;}
  .print-chart svg{overflow:visible;}
  .print-chart .recharts-cartesian-axis-line,.print-chart .recharts-cartesian-axis-tick-line{stroke:#cbd5f5;}
  .print-chart .recharts-cartesian-axis-tick text{fill:#475569;font-size:12px;}
  .print-chart .recharts-legend-item text{fill:#1e293b;font-weight:600;font-size:12px;}
  .print-chart .recharts-cartesian-grid line{stroke:#e2e8f0;}
  .print-chart .recharts-tooltip-wrapper{display:none!important;}
  .print-chart-section h2{margin-bottom:16px;}
  .chart-explainer{margin-top:12px;font-size:12px;color:#334155;}
  .chart-explainer strong{font-size:13px;}
`;


export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('leasing')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const mesReferenciaRef = useRef(new Date().getMonth() + 1)
  const [ufTarifa, setUfTarifa] = useState('GO')
  const [distribuidoraTarifa, setDistribuidoraTarifa] = useState('Equatorial Goiás')
  const [ufsDisponiveis, setUfsDisponiveis] = useState<string[]>(DISTRIBUIDORAS_FALLBACK.ufs)
  const [distribuidorasPorUf, setDistribuidorasPorUf] = useState<Record<string, string[]>>(
    DISTRIBUIDORAS_FALLBACK.distribuidorasPorUf,
  )
  const [mesReajuste, setMesReajuste] = useState(6)

  const [kcKwhMes, setKcKwhMes] = useState(0)
  const [tarifaCheia, setTarifaCheia] = useState(0.964)
  const [desconto, setDesconto] = useState(20)
  const [taxaMinima, setTaxaMinima] = useState(95)
  const [encargosFixosExtras, setEncargosFixosExtras] = useState(0)
  const [leasingPrazo, setLeasingPrazo] = useState<5 | 7 | 10>(5)
  const [potenciaPlaca, setPotenciaPlaca] = useState(550)
  const [numeroPlacasManual, setNumeroPlacasManual] = useState<number | ''>('')

  const [cliente, setCliente] = useState<ClienteDados>({
    nome: '',
    documento: '',
    email: '',
    telefone: '',
    distribuidora: '',
    uc: '',
    endereco: '',
    cidade: '',
    uf: '',
  })

  const distribuidorasDisponiveis = useMemo(() => {
    if (!ufTarifa) return [] as string[]
    return distribuidorasPorUf[ufTarifa] ?? []
  }, [distribuidorasPorUf, ufTarifa])

  const clienteUf = cliente.uf
  const clienteDistribuidora = cliente.distribuidora

  const [precoPorKwp, setPrecoPorKwp] = useState(2470)
  const [irradiacao, setIrradiacao] = useState(IRRADIACAO_FALLBACK)
  const [eficiencia, setEficiencia] = useState(0.8)
  const [diasMes, setDiasMes] = useState(DIAS_MES_PADRAO)
  const [inflacaoAa, setInflacaoAa] = useState(8)

  const [jurosFinAa, setJurosFinAa] = useState(15)
  const [prazoFinMeses, setPrazoFinMeses] = useState(120)
  const [entradaFinPct, setEntradaFinPct] = useState(20)
  const [mostrarFinanciamento, setMostrarFinanciamento] = useState(false)
  const [mostrarGrafico, setMostrarGrafico] = useState(true)

  const [prazoMeses, setPrazoMeses] = useState(60)
  const [bandeiraEncargo, setBandeiraEncargo] = useState(0)
  const [cipEncargo, setCipEncargo] = useState(0)
  const [entradaRs, setEntradaRs] = useState(0)
  const [entradaModo, setEntradaModo] = useState<EntradaModoLabel>('Crédito mensal')
  const [mostrarTabelaParcelas, setMostrarTabelaParcelas] = useState(false)
  const [mostrarTabelaBuyout, setMostrarTabelaBuyout] = useState(false)
  const [mostrarTabelaParcelasConfig, setMostrarTabelaParcelasConfig] = useState(false)
  const [mostrarTabelaBuyoutConfig, setMostrarTabelaBuyoutConfig] = useState(false)

  const [oemBase, setOemBase] = useState(35)
  const [oemInflacao, setOemInflacao] = useState(4)
  const [seguroModo, setSeguroModo] = useState<SeguroModo>('A')
  const [seguroReajuste, setSeguroReajuste] = useState(5)
  const [seguroValorA, setSeguroValorA] = useState(20)
  const [seguroPercentualB, setSeguroPercentualB] = useState(0.3)

  const [exibirLeasingLinha, setExibirLeasingLinha] = useState(true)
  const [exibirFinLinha, setExibirFinLinha] = useState(false)

  const [cashbackPct, setCashbackPct] = useState(10)
  const [depreciacaoAa, setDepreciacaoAa] = useState(12)
  const [inadimplenciaAa, setInadimplenciaAa] = useState(2)
  const [tributosAa, setTributosAa] = useState(6)
  const [ipcaAa, setIpcaAa] = useState(4)
  const [custosFixosM, setCustosFixosM] = useState(0)
  const [opexM, setOpexM] = useState(0)
  const [seguroM, setSeguroM] = useState(0)
  const [duracaoMeses, setDuracaoMeses] = useState(60)
  // Valor informado (ou calculado) de parcelas efetivamente pagas até o mês analisado, usado no crédito de cashback
  const [pagosAcumAteM, setPagosAcumAteM] = useState(0)

  const mesReferencia = mesReferenciaRef.current

  useEffect(() => {
    let cancelado = false
    const uf = ufTarifa.trim()
    const dist = distribuidoraTarifa.trim()

    if (!uf || !dist) {
      setMesReajuste(6)
      return () => {
        cancelado = true
      }
    }

    getMesReajusteFromANEEL(uf, dist)
      .then((mes) => {
        if (cancelado) return
        const normalizado = Number.isFinite(mes) ? Math.round(mes) : 6
        const ajustado = Math.min(Math.max(normalizado || 6, 1), 12)
        setMesReajuste(ajustado)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar mês de reajuste:', error)
        if (!cancelado) setMesReajuste(6)
      })

    return () => {
      cancelado = true
    }
  }, [distribuidoraTarifa, ufTarifa])

  useEffect(() => {
    const ufAtual = (ufTarifa || clienteUf || '').trim()
    if (!ufAtual) {
      return undefined
    }

    const distribuidoraAtual = (distribuidoraTarifa || clienteDistribuidora || '').trim()
    let cancelado = false

    getTarifaCheia({ uf: ufAtual, distribuidora: distribuidoraAtual || undefined })
      .then((valor) => {
        if (cancelado) return
        if (!Number.isFinite(valor)) return

        setTarifaCheia((atual) => {
          if (!Number.isFinite(atual)) {
            return valor
          }
          return Math.abs(atual - valor) < 0.0005 ? atual : valor
        })
      })
      .catch((error) => {
        if (cancelado) return
        console.warn('[Tarifa] Não foi possível atualizar tarifa cheia automaticamente:', error)
      })

    return () => {
      cancelado = true
    }
  }, [clienteDistribuidora, clienteUf, distribuidoraTarifa, ufTarifa])

  useEffect(() => {
    let cancelado = false

    loadDistribuidorasAneel()
      .then((dados) => {
        if (cancelado) return
        setUfsDisponiveis(dados.ufs)
        setDistribuidorasPorUf(dados.distribuidorasPorUf)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar lista de distribuidoras:', error)
      })

    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    setDistribuidoraTarifa((atual) => {
      if (!ufTarifa) return ''
      const lista = distribuidorasPorUf[ufTarifa] ?? []
      if (lista.length === 1) {
        return lista[0]
      }
      return lista.includes(atual) ? atual : ''
    })
  }, [distribuidorasPorUf, ufTarifa])

  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.querySelector<HTMLElement>('.app-header')
      if (header) {
        const { height } = header.getBoundingClientRect()
        document.documentElement.style.setProperty('--header-h', `${Math.round(height)}px`)
      }

      const tabs = document.querySelector<HTMLElement>('.tabs-bar')
      if (tabs) {
        const { height } = tabs.getBoundingClientRect()
        document.documentElement.style.setProperty('--tabs-h', `${Math.round(height)}px`)
      }
    }

    updateHeaderHeight()
    window.addEventListener('resize', updateHeaderHeight)
    return () => window.removeEventListener('resize', updateHeaderHeight)
  }, [])

  useEffect(() => {
    const estadoAtual = (ufTarifa || clienteUf || '').trim()
    if (!estadoAtual) {
      setIrradiacao(IRRADIACAO_FALLBACK)
      return
    }

    if (!hasEstadoMinimo(estadoAtual)) {
      setIrradiacao(IRRADIACAO_FALLBACK)
      return
    }

    let cancelado = false

    getIrradiacaoPorEstado(estadoAtual)
      .then(({ value, matched, via }) => {
        if (cancelado) return
        setIrradiacao((prev) => (prev === value ? prev : value))
        if (!matched) {
          console.warn(
            `[Irradiação] Estado "${estadoAtual}" não encontrado (${via}), usando fallback de ${value.toFixed(2)} kWh/m²/dia.`,
          )
        }
      })
      .catch((error) => {
        if (cancelado) return
        console.warn(
          `[Irradiação] Erro ao carregar dados para "${estadoAtual}":`,
          error,
          `— usando fallback de ${IRRADIACAO_FALLBACK.toFixed(2)} kWh/m²/dia.`,
        )
        setIrradiacao(IRRADIACAO_FALLBACK)
      })

    return () => {
      cancelado = true
    }
  }, [clienteUf, ufTarifa])

  useEffect(() => {
    const { body } = document
    if (!body) return

    if (isSettingsOpen) {
      body.style.setProperty('overflow', 'hidden')
    } else {
      body.style.removeProperty('overflow')
    }

    return () => {
      body.style.removeProperty('overflow')
    }
  }, [isSettingsOpen])

  const eficienciaNormalizada = useMemo(() => {
    if (eficiencia <= 0) return 0
    if (eficiencia >= 1.5) return eficiencia / 100
    return eficiencia
  }, [eficiencia])

  const baseIrradiacao = useMemo(
    () => (irradiacao > 0 ? irradiacao : 0),
    [irradiacao],
  )

  const diasMesNormalizado = useMemo(
    () => (diasMes > 0 ? diasMes : 0),
    [diasMes],
  )

  const fatorGeracaoMensal = useMemo(() => {
    if (baseIrradiacao <= 0 || eficienciaNormalizada <= 0) {
      return 0
    }
    return baseIrradiacao * eficienciaNormalizada * DIAS_MES_PADRAO
  }, [baseIrradiacao, eficienciaNormalizada])

  const numeroPlacasInformado = useMemo(() => {
    if (typeof numeroPlacasManual !== 'number') return null
    if (!Number.isFinite(numeroPlacasManual) || numeroPlacasManual <= 0) return null
    return Math.max(1, Math.round(numeroPlacasManual))
  }, [numeroPlacasManual])

  const potenciaInstaladaKwp = useMemo(() => {
    if (numeroPlacasInformado && potenciaPlaca > 0) {
      return (numeroPlacasInformado * potenciaPlaca) / 1000
    }
    if (fatorGeracaoMensal > 0) {
      return kcKwhMes / fatorGeracaoMensal
    }
    return 0
  }, [kcKwhMes, fatorGeracaoMensal, numeroPlacasInformado, potenciaPlaca])

  const numeroPlacasCalculado = useMemo(() => {
    if (numeroPlacasInformado) return numeroPlacasInformado
    if (potenciaPlaca <= 0) return 0
    const calculado = Math.ceil((potenciaInstaladaKwp * 1000) / potenciaPlaca)
    return Math.max(1, Number.isFinite(calculado) ? calculado : 0)
  }, [numeroPlacasInformado, potenciaInstaladaKwp, potenciaPlaca])

  const geracaoMensalKwh = useMemo(() => {
    if (potenciaInstaladaKwp <= 0 || fatorGeracaoMensal <= 0) {
      return 0
    }
    return Math.round(potenciaInstaladaKwp * fatorGeracaoMensal)
  }, [potenciaInstaladaKwp, fatorGeracaoMensal])

  const geracaoDiariaKwh = useMemo(
    () => (geracaoMensalKwh > 0 && diasMesNormalizado > 0 ? geracaoMensalKwh / diasMesNormalizado : 0),
    [geracaoMensalKwh, diasMesNormalizado],
  )

  const encargosFixos = useMemo(
    () => Math.max(0, bandeiraEncargo + cipEncargo + encargosFixosExtras),
    [bandeiraEncargo, cipEncargo, encargosFixosExtras],
  )

  const modoEntradaNormalizado = useMemo<EntradaModo>(() => {
    if (!entradaRs || entradaRs <= 0) return 'NONE'
    const label = (entradaModo ?? '').toLowerCase().trim()
    if (label.includes('crédito')) return 'CREDITO'
    if (label.includes('reduz')) return 'REDUZ'
    return 'NONE'
  }, [entradaModo, entradaRs])

  const capex = useMemo(() => potenciaInstaladaKwp * precoPorKwp, [potenciaInstaladaKwp, precoPorKwp])

  const simulationState = useMemo<SimulationState>(() => {
    // Mantemos o valor de mercado (vm0) amarrado ao CAPEX calculado neste mesmo memo para
    // evitar dependências de ordem que poderiam reaparecer em merges futuros. Assim garantimos
    // uma única fonte de verdade entre a projeção principal e o fluxo de buyout.
    const valorMercadoBase = Math.max(0, capex)
    const descontoDecimal = Math.max(0, Math.min(desconto / 100, 1))
    const inflacaoAnual = Math.max(-0.99, inflacaoAa / 100)
    return {
      kcKwhMes: Math.max(0, kcKwhMes),
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: descontoDecimal,
      inflacaoAa: inflacaoAnual,
      prazoMeses: Math.max(0, Math.floor(prazoMeses)),
      taxaMinima: Math.max(0, taxaMinima),
      encargosFixos,
      entradaRs: Math.max(0, entradaRs),
      modoEntrada: modoEntradaNormalizado,
      vm0: valorMercadoBase,
      depreciacaoAa: Math.max(0, depreciacaoAa / 100),
      ipcaAa: Math.max(0, ipcaAa / 100),
      inadimplenciaAa: Math.max(0, inadimplenciaAa / 100),
      tributosAa: Math.max(0, tributosAa / 100),
      custosFixosM: Math.max(0, custosFixosM),
      opexM: Math.max(0, opexM),
      seguroM: Math.max(0, seguroM),
      cashbackPct: Math.max(0, cashbackPct / 100),
      pagosAcumManual: Math.max(0, pagosAcumAteM),
      duracaoMeses: Math.max(0, Math.floor(duracaoMeses)),
      geracaoMensalKwh: Math.max(0, geracaoMensalKwh),
      mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
    }
  }, [
    bandeiraEncargo,
    capex,
    cashbackPct,
    cipEncargo,
    custosFixosM,
    desconto,
    entradaRs,
    geracaoMensalKwh,
    inflacaoAa,
    inadimplenciaAa,
    ipcaAa,
    kcKwhMes,
    mesReajuste,
    modoEntradaNormalizado,
    opexM,
    pagosAcumAteM,
    prazoMeses,
    seguroM,
    tarifaCheia,
    taxaMinima,
    tributosAa,
    encargosFixosExtras,
    depreciacaoAa,
    duracaoMeses,
  ])

  const vm0 = simulationState.vm0

  const inflacaoMensal = useMemo(() => selectInflacaoMensal(simulationState), [simulationState])
  const mensalidades = useMemo(() => selectMensalidades(simulationState), [simulationState])
  const mensalidadesPorAno = useMemo(() => selectMensalidadesPorAno(simulationState), [simulationState])
  const creditoEntradaMensal = useMemo(() => selectCreditoMensal(simulationState), [simulationState])
  const kcAjustado = useMemo(() => selectKcAjustado(simulationState), [simulationState])
  const buyoutLinhas = useMemo(() => selectBuyoutLinhas(simulationState), [simulationState])

  const tarifaAno = (ano: number) =>
    tarifaProjetadaCheia(
      simulationState.tarifaCheia,
      simulationState.inflacaoAa,
      (ano - 1) * 12 + 1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )
  const tarifaDescontadaAno = (ano: number) =>
    tarifaDescontadaCalc(
      simulationState.tarifaCheia,
      simulationState.desconto,
      simulationState.inflacaoAa,
      (ano - 1) * 12 + 1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )

  const leasingBeneficios = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      const tarifaCheiaProj = tarifaAno(ano)
      const tarifaDescontadaProj = tarifaDescontadaAno(ano)
      const custoSemSistema = kcKwhMes * tarifaCheiaProj + encargosFixos + taxaMinima
      const prestacao = ano <= leasingPrazo ? kcKwhMes * tarifaDescontadaProj + encargosFixos + taxaMinima : 0
      const beneficio = 12 * (custoSemSistema - prestacao)
      return beneficio
    })
  }, [
    anosAnalise,
    encargosFixos,
    kcKwhMes,
    leasingPrazo,
    simulationState.desconto,
    simulationState.inflacaoAa,
    simulationState.mesReajuste,
    simulationState.mesReferencia,
    simulationState.tarifaCheia,
    taxaMinima,
  ])

  const leasingROI = useMemo(() => {
    const acc: number[] = []
    let acumulado = 0
    leasingBeneficios.forEach((beneficio) => {
      acumulado += beneficio
      acc.push(acumulado)
    })
    return acc
  }, [leasingBeneficios])

  const taxaMensalFin = useMemo(() => Math.pow(1 + jurosFinAa / 100, 1 / 12) - 1, [jurosFinAa])
  const entradaFin = useMemo(() => (capex * entradaFinPct) / 100, [capex, entradaFinPct])
  const valorFinanciado = useMemo(() => Math.max(0, capex - entradaFin), [capex, entradaFin])
  const pmt = useMemo(() => {
    if (valorFinanciado === 0) return 0
    if (taxaMensalFin === 0) return -(valorFinanciado / prazoFinMeses)
    const fator = Math.pow(1 + taxaMensalFin, prazoFinMeses)
    return -valorFinanciado * (taxaMensalFin * fator) / (fator - 1)
  }, [valorFinanciado, taxaMensalFin, prazoFinMeses])

  const custoOeM = (ano: number) => potenciaInstaladaKwp * oemBase * Math.pow(1 + oemInflacao / 100, ano - 1)
  const custoSeguro = (ano: number) => {
    if (seguroModo === 'A') {
      return potenciaInstaladaKwp * seguroValorA * Math.pow(1 + seguroReajuste / 100, ano - 1)
    }
    return vm0 * (seguroPercentualB / 100) * Math.pow(1 + seguroReajuste / 100, ano - 1)
  }

  const financiamentoFluxo = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      const economia = 12 * kcKwhMes * tarifaAno(ano)
      const custoSemSistemaMensal = Math.max(kcKwhMes * tarifaAno(ano), taxaMinima)
      const economiaAnual = 12 * Math.max(custoSemSistemaMensal - taxaMinima, 0)
      const inicioAno = (ano - 1) * 12
      const mesesRestantes = Math.max(0, prazoFinMeses - inicioAno)
      const mesesPagos = Math.min(12, mesesRestantes)
      const custoParcela = mesesPagos * Math.abs(pmt)
      const despesasSistema = custoParcela + custoOeM(ano) + custoSeguro(ano)
      return economiaAnual - despesasSistema
    })
  }, [kcKwhMes, inflacaoAa, jurosFinAa, oemBase, oemInflacao, pmt, prazoFinMeses, seguroModo, seguroPercentualB, seguroReajuste, seguroValorA, tarifaCheia, taxaMinima, vm0, potenciaInstaladaKwp])

  const financiamentoROI = useMemo(() => {
    const valores: number[] = []
    let acumulado = -entradaFin
    financiamentoFluxo.forEach((fluxo) => {
      acumulado += fluxo
      valores.push(acumulado)
    })
    return valores
  }, [entradaFin, financiamentoFluxo])

  const financiamentoMensalidades = useMemo(() => {
    const anos = Math.ceil(prazoFinMeses / 12)
    return Array.from({ length: anos }, () => Math.abs(pmt))
  }, [pmt, prazoFinMeses])

  const parcelasSolarInvest = useMemo(() => {
    const lista: MensalidadeRow[] = []
    let totalAcumulado = 0
    const kcContratado =
      simulationState.modoEntrada === 'REDUZ'
        ? kcAjustado
        : Math.max(0, simulationState.kcKwhMes)
    const margemMinima = Math.max(0, simulationState.taxaMinima) + Math.max(0, simulationState.encargosFixos)
    const manutencaoPrevencaoSeguroMensal = Math.max(0, (simulationState.vm0 * 0.015) / 12)
    mensalidades.forEach((mensalidade, index) => {
      const mes = index + 1
      const tarifaCheiaMes = tarifaProjetadaCheia(
        simulationState.tarifaCheia,
        simulationState.inflacaoAa,
        mes,
        simulationState.mesReajuste,
        simulationState.mesReferencia,
      )
      const tarifaDescontadaMes = selectTarifaDescontada(simulationState, mes)
      const energiaCheia = Math.max(0, kcContratado * tarifaCheiaMes)
      const mensalidadeCheia = Number(
        Math.max(0, energiaCheia + margemMinima + manutencaoPrevencaoSeguroMensal).toFixed(2),
      )
      totalAcumulado += mensalidade
      lista.push({
        mes,
        tarifaCheia: tarifaCheiaMes,
        tarifaDescontada: tarifaDescontadaMes,
        mensalidadeCheia,
        mensalidade: Number(mensalidade.toFixed(2)),
        totalAcumulado: Number(totalAcumulado.toFixed(2)),
      })
    })

    return {
      lista,
      tarifaDescontadaBase: selectTarifaDescontada(simulationState, 1),
      kcAjustado,
      creditoMensal: creditoEntradaMensal,
      margemMinima: simulationState.taxaMinima + simulationState.encargosFixos,
      prazoEfetivo: mensalidades.length,
      totalPago: lista.length > 0 ? lista[lista.length - 1].totalAcumulado : 0,
      inflacaoMensal,
    }
  }, [
    creditoEntradaMensal,
    inflacaoMensal,
    kcAjustado,
    mensalidades,
    simulationState,
  ])

  const leasingMensalidades = mensalidadesPorAno

  const chartData = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      return {
        ano,
        Leasing: leasingROI[i] ?? 0,
        Financiamento: financiamentoROI[i] ?? 0,
      }
    })
  }, [financiamentoROI, leasingROI])
  const beneficioAno30 = useMemo(
    () => chartData.find((row) => row.ano === 30) ?? null,
    [chartData],
  )

  const valoresGrafico = chartData.flatMap((row) => [row.Leasing, row.Financiamento])
  const minY = Math.min(...valoresGrafico, 0)
  const maxY = Math.max(...valoresGrafico, 0)
  const padding = Math.max(5_000, Math.round((maxY - minY) * 0.1))
  const yDomain: [number, number] = [Math.floor((minY - padding) / 1000) * 1000, Math.ceil((maxY + padding) / 1000) * 1000]

  const tabelaBuyout = useMemo<BuyoutRow[]>(() => {
    const horizonte = Math.max(60, Math.floor(simulationState.duracaoMeses))
    const linhasPorMes = new Map<number, BuyoutLinha>()
    buyoutLinhas.forEach((linha) => {
      linhasPorMes.set(linha.mes, linha)
    })

    const rows: BuyoutRow[] = []
    let ultimoCashback = 0
    let ultimoPrestacao = 0
    for (let mes = 1; mes <= horizonte; mes += 1) {
      const linha = linhasPorMes.get(mes)
      if (linha) {
        ultimoCashback = linha.cashback
        ultimoPrestacao = linha.prestacaoAcum
        rows.push({
          mes,
          tarifa: linha.tarifaCheia,
          prestacaoEfetiva: linha.prestacaoEfetiva,
          prestacaoAcum: linha.prestacaoAcum,
          cashback: linha.cashback,
          valorResidual: mes >= 7 && mes <= Math.floor(simulationState.duracaoMeses) ? linha.valorResidual : null,
        })
      } else {
        const fator = Math.pow(1 + inflacaoMensal, Math.max(0, mes - 1))
        const tarifaProjetada = simulationState.tarifaCheia * fator
        rows.push({
          mes,
          tarifa: tarifaProjetada,
          prestacaoEfetiva: 0,
          prestacaoAcum: ultimoPrestacao,
          cashback: ultimoCashback,
          valorResidual: null,
        })
      }
    }

    const mesAceiteFinal = Math.floor(simulationState.duracaoMeses) + 1
    const tarifaAceite = simulationState.tarifaCheia * Math.pow(1 + inflacaoMensal, Math.max(0, mesAceiteFinal - 1))
    rows.push({
      mes: mesAceiteFinal,
      tarifa: tarifaAceite,
      prestacaoEfetiva: 0,
      prestacaoAcum: ultimoPrestacao,
      cashback: ultimoCashback,
      valorResidual: 0,
    })

    return rows
  }, [buyoutLinhas, inflacaoMensal, simulationState])
  const duracaoMesesNormalizada = Math.max(0, Math.floor(duracaoMeses))
  const duracaoMesesExibicao = Math.max(7, duracaoMesesNormalizada)
  const buyoutMesAceiteFinal = duracaoMesesNormalizada + 1
  const buyoutAceiteFinal = tabelaBuyout.find((row) => row.mes === buyoutMesAceiteFinal) ?? null
  const buyoutReceitaRows = useMemo(
    () => tabelaBuyout.filter((row) => row.mes >= 7 && row.mes <= duracaoMesesNormalizada),
    [tabelaBuyout, duracaoMesesNormalizada],
  )

  const buyoutResumo: BuyoutResumo = {
    vm0,
    cashbackPct: cashbackPct,
    depreciacaoPct: depreciacaoAa,
    inadimplenciaPct: inadimplenciaAa,
    tributosPct: tributosAa,
    infEnergia: inflacaoAa,
    ipca: ipcaAa,
    custosFixos: custosFixosM,
    opex: opexM,
    seguro: seguroM,
    duracao: duracaoMeses,
  }

  const printableRef = useRef<HTMLDivElement>(null)

  const handleEficienciaInput = (valor: number) => {
    if (!Number.isFinite(valor)) {
      setEficiencia(0)
      return
    }
    if (valor <= 0) {
      setEficiencia(0)
      return
    }
    if (valor >= 1.5) {
      setEficiencia(valor / 100)
      return
    }
    setEficiencia(valor)
  }
  const handlePrint = () => {
    const node = printableRef.current
    if (!node) return
    const printWindow = window.open('', '_blank', 'width=1024,height=768')
    if (!printWindow) return

    const previewHtml = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Proposta-${cliente.nome || 'SolarInvest'}</title>
          <style>
            ${printStyles}
            body{padding-top:88px;}
            .preview-toolbar{position:fixed;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:16px 44px;border-bottom:1px solid #cbd5f5;box-shadow:0 2px 6px rgba(15,23,42,0.08);}
            .preview-toolbar h1{margin:0;font-size:18px;color:#0f172a;}
            .preview-toolbar p{margin:4px 0 0;font-size:13px;color:#475569;}
            .preview-toolbar button{background:#0f172a;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;}
            .preview-toolbar button:hover{background:#1e293b;}
            .preview-container{max-width:1040px;margin:0 auto;}
            @media print{
              body{padding-top:0;}
              .preview-toolbar{display:none;}
            }
          </style>
        </head>
        <body>
          <div class="preview-toolbar">
            <div>
              <h1>Pré-visualização da proposta</h1>
              <p>Revise o conteúdo e clique em "Imprimir" para gerar o PDF.</p>
            </div>
            <button type="button" onclick="window.print()">Imprimir</button>
          </div>
          <div class="preview-container">${node.outerHTML}</div>
        </body>
      </html>`

    const { document } = printWindow
    document.open()
    document.write(previewHtml)
    document.close()
    printWindow.focus()
  }

  const anosArray = useMemo(() => Array.from({ length: anosAnalise }, (_, i) => i + 1), [])
  const allCurvesHidden = !exibirLeasingLinha && (!mostrarFinanciamento || !exibirFinLinha)

  const handleClienteChange = (key: keyof ClienteDados, value: string) => {
    setCliente((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="page">
      <PrintableProposal
        ref={printableRef}
        cliente={cliente}
        anos={anosArray}
        leasingROI={leasingROI}
        financiamentoFluxo={financiamentoFluxo}
        financiamentoROI={financiamentoROI}
        mostrarFinanciamento={mostrarFinanciamento}
        tabelaBuyout={tabelaBuyout}
        buyoutResumo={buyoutResumo}
        capex={capex}
        geracaoMensalKwh={geracaoMensalKwh}
        potenciaPlaca={potenciaPlaca}
        numeroPlacas={numeroPlacasCalculado}
        potenciaInstaladaKwp={potenciaInstaladaKwp}
        descontoContratualPct={desconto}
        parcelasLeasing={parcelasSolarInvest.lista}
      />
      <header className="topbar app-header">
        <div className="brand">
          <img src="/logo.svg" alt="SolarInvest" />
          <div className="brand-text">
            <h1>SolarInvest App</h1>
            <p>Proposta financeira interativa</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={handlePrint}>Exportar Proposta (PDF)</button>
          <button className="icon" onClick={() => setIsSettingsOpen(true)} aria-label="Abrir configurações">⚙︎</button>
        </div>
      </header>
      <div className="app-main">
        <nav className="tabs tabs-bar">
          <button className={activeTab === 'cliente' ? 'active' : ''} onClick={() => setActiveTab('cliente')}>Cliente</button>
          <button className={activeTab === 'leasing' ? 'active' : ''} onClick={() => setActiveTab('leasing')}>Leasing</button>
          <button className={activeTab === 'vendas' ? 'active' : ''} onClick={() => setActiveTab('vendas')}>Vendas</button>
        </nav>

        <main className="content page-content">
          {activeTab === 'leasing' ? (
            <>
            <section className="card">
              <h2>Usina fotovoltaica</h2>
              <div className="grid g4">
                <Field label="Potência da placa (Wp)">
                  <select value={potenciaPlaca} onChange={(e) => setPotenciaPlaca(Number(e.target.value))}>
                    {painelOpcoes.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Nº de placas informado (opcional)">
                  <input
                    type="number"
                    min={1}
                    value={numeroPlacasManual === '' ? '' : numeroPlacasManual}
                    onChange={(e) => {
                      const { value } = e.target
                      if (value === '') {
                        setNumeroPlacasManual('')
                        return
                      }
                      const parsed = Number(value)
                      if (!Number.isFinite(parsed) || parsed <= 0) {
                        setNumeroPlacasManual('')
                        return
                      }
                      setNumeroPlacasManual(parsed)
                    }}
                  />
                </Field>
                <Field label="Nº de placas (calculado)">
                  <input readOnly value={numeroPlacasCalculado} />
                </Field>
                <Field label="Potência instalada (kWp)">
                  <input readOnly value={potenciaInstaladaKwp.toFixed(2)} />
                </Field>
                <Field label="Geração estimada (kWh/mês)">
                  <input readOnly value={geracaoMensalKwh.toFixed(0)} />
                </Field>
              </div>
              <div className="info-inline">
                <span className="pill">Valor de Mercado Estimado: <strong>{currency(capex)}</strong></span>
                <span className="pill">Consumo diário: <strong>{geracaoDiariaKwh.toFixed(1)} kWh</strong></span>
              </div>
            </section>

            <section className="card">
              <h2>Parâmetros principais</h2>
              <div className="grid g3">
                <Field label="Consumo (kWh/mês)">
                  <input type="number" value={kcKwhMes} onChange={(e) => setKcKwhMes(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Tarifa cheia (R$/kWh)">
                  <input type="number" step="0.001" value={tarifaCheia} onChange={(e) => setTarifaCheia(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Desconto contratual (%)">
                  <input type="number" step="0.1" value={desconto} onChange={(e) => setDesconto(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Taxa mínima (R$/mês)">
                  <input type="number" value={taxaMinima} onChange={(e) => setTaxaMinima(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Encargos adicionais (R$/mês)">
                  <input type="number" value={encargosFixosExtras} onChange={(e) => setEncargosFixosExtras(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Prazo do leasing">
                  <select value={leasingPrazo} onChange={(e) => setLeasingPrazo(Number(e.target.value) as 5 | 7 | 10)}>
                    <option value={5}>5 anos</option>
                    <option value={7}>7 anos</option>
                    <option value={10}>10 anos</option>
                  </select>
                </Field>
                <Field label="UF (ANEEL)">
                  <select
                    value={ufTarifa}
                    onChange={(e) => setUfTarifa(e.target.value)}
                  >
                    <option value="">Selecione a UF</option>
                    {ufsDisponiveis.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf} — {UF_LABELS[uf] ?? uf}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Distribuidora (ANEEL)">
                  <select
                    value={distribuidoraTarifa}
                    onChange={(e) => setDistribuidoraTarifa(e.target.value)}
                    disabled={!ufTarifa || distribuidorasDisponiveis.length === 0}
                  >
                    <option value="">
                      {ufTarifa ? 'Selecione a distribuidora' : 'Selecione a UF'}
                    </option>
                    {distribuidorasDisponiveis.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Irradiação média (kWh/m²/dia)"
                  hint="Atualizado automaticamente conforme a UF ou distribuidora selecionada."
                >
                  <input readOnly value={baseIrradiacao > 0 ? baseIrradiacao.toFixed(2) : '—'} />
                </Field>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2>SolarInvest Leasing</h2>
                <span className="toggle-label">
                  Inflação mensal equivalente: {(parcelasSolarInvest.inflacaoMensal * 100).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}%
                </span>
              </div>

              <div className="grid g2">
                <Field label="Entrada (R$)">
                  <input
                    type="number"
                    value={entradaRs}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setEntradaRs(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                    }}
                  />
                </Field>
              </div>

              <div className="info-inline">
                <span className="pill">
                  Tarifa c/ desconto: <strong>{tarifaCurrency(parcelasSolarInvest.tarifaDescontadaBase)} / kWh</strong>
                </span>
                {modoEntradaNormalizado === 'REDUZ' ? (
                  <span className="pill">
                    Piso contratado ajustado:{' '}
                    <strong>
                      {`${parcelasSolarInvest.kcAjustado.toLocaleString('pt-BR', {
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0,
                      })} kWh`}
                    </strong>
                  </span>
                ) : null}
                {modoEntradaNormalizado === 'CREDITO' ? (
                  <span className="pill">
                    Crédito mensal da entrada: <strong>{currency(parcelasSolarInvest.creditoMensal)}</strong>
                  </span>
                ) : null}
              </div>

              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaParcelas((prev) => !prev)}
                  aria-expanded={mostrarTabelaParcelas}
                  aria-controls="parcelas-solarinvest-tabela"
                >
                  {mostrarTabelaParcelas ? 'Ocultar tabela de parcelas' : 'Exibir tabela de parcelas'}
                </button>
              </div>
              {mostrarTabelaParcelas ? (
                <div className="table-wrapper">
                  <table id="parcelas-solarinvest-tabela">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Tarifa projetada (R$/kWh)</th>
                        <th>Tarifa c/ desconto (R$/kWh)</th>
                        <th>MENSALIDADE CHEIA</th>
                        <th>MENSALIDADE COM LEASING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasSolarInvest.lista.length > 0 ? (
                        parcelasSolarInvest.lista.map((row) => (
                          <tr key={row.mes}>
                            <td>{row.mes}</td>
                            <td>{tarifaCurrency(row.tarifaCheia)}</td>
                            <td>{tarifaCurrency(row.tarifaDescontada)}</td>
                            <td>{currency(row.mensalidadeCheia)}</td>
                            <td>{currency(row.mensalidade)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="muted">Defina um prazo contratual para gerar a projeção das parcelas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <div className="grid g2">
              <section className="card">
                <h2>Leasing — Mensalidade</h2>
                <div className="list-col">
                  {leasingMensalidades.map((valor, index) => (
                    <div className="list-row" key={`leasing-m${index}`}>
                      <span>Ano {index + 1}</span>
                      <strong>{currency(valor)}</strong>
                    </div>
                  ))}
                </div>
                <div className="notice">
                  <div className="dot" />
                  <div>
                    <p className="notice-title">Fim do prazo</p>
                    <p className="notice-sub">Após {leasingPrazo} anos a curva acelera: 100% do retorno fica com o cliente.</p>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <h2>Financiamento — Mensalidade</h2>
                  <span className="toggle-label">Coluna ativa: {mostrarFinanciamento ? 'Sim' : 'Não'}</span>
                </div>
                {mostrarFinanciamento ? (
                  <div className="list-col">
                    {financiamentoMensalidades.map((valor, index) => (
                      <div className="list-row" key={`fin-m${index}`}>
                        <span>Ano {index + 1}</span>
                        <strong>{currency(valor)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Habilite nas configurações para comparar a coluna de financiamento.</p>
                )}
              </section>
            </div>

            <section className="card">
              <div className="card-header">
                <h2>Compra antecipada (Buyout)</h2>
                <span className="muted">Valores entre o mês 7 e o mês {duracaoMesesExibicao}.</span>
              </div>
              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaBuyout((prev) => !prev)}
                  aria-expanded={mostrarTabelaBuyout}
                  aria-controls="compra-antecipada-tabela"
                >
                  {mostrarTabelaBuyout ? 'Ocultar tabela de buyout' : 'Exibir tabela de buyout'}
                </button>
              </div>
              {mostrarTabelaBuyout ? (
                <div className="table-wrapper">
                  <table id="compra-antecipada-tabela">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Tarifa projetada</th>
                        <th>Prestação efetiva</th>
                        <th>Cashback</th>
                        <th>Valor de compra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabelaBuyout
                        .filter((row) => row.mes >= 7 && row.mes <= duracaoMesesNormalizada)
                        .map((row) => (
                          <tr key={row.mes}>
                            <td>{row.mes}</td>
                            <td>{tarifaCurrency(row.tarifa)}</td>
                            <td>{currency(row.prestacaoEfetiva)}</td>
                            <td>{currency(row.cashback)}</td>
                            <td>{row.valorResidual === null ? '—' : currency(row.valorResidual)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
            {mostrarGrafico ? (
              <section className="card">
                <div className="card-header">
                  <h2>Beneficio acumulado em 30 anos</h2>
                  <div className="legend-toggle">
                    <label>
                      <input type="checkbox" checked={exibirLeasingLinha} onChange={(e) => setExibirLeasingLinha(e.target.checked)} />
                      <span style={{ color: chartColors.Leasing }}>Leasing</span>
                    </label>
                    {mostrarFinanciamento ? (
                      <label>
                        <input type="checkbox" checked={exibirFinLinha} onChange={(e) => setExibirFinLinha(e.target.checked)} />
                        <span style={{ color: chartColors.Financiamento }}>Financiamento</span>
                      </label>
                    ) : null}
                  </div>
                </div>
                <div className="chart">
                  {!allCurvesHidden ? (
                    <div className="chart-explainer">
                      <strong>ROI Leasing – Benefício financeiro</strong>
                      <span>Economia acumulada versus concessionária.</span>
                      {beneficioAno30 ? (
                        <span className="chart-highlight">
                          Beneficio acumulado em 30 anos:
                          <strong style={{ color: chartColors.Leasing }}> {currency(beneficioAno30.Leasing)}</strong>
                          {mostrarFinanciamento && exibirFinLinha ? (
                            <>
                              {' • '}Financiamento:{' '}
                              <strong style={{ color: chartColors.Financiamento }}>{currency(beneficioAno30.Financiamento)}</strong>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="ano" stroke="#9CA3AF" label={{ value: 'Anos', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF' }} />
                      <YAxis stroke="#9CA3AF" tickFormatter={formatAxis} domain={yDomain} width={92} />
                      <Tooltip formatter={(value: number) => currency(Number(value))} contentStyle={{ background: '#0b1220', border: '1px solid #1f2b40' }} />
                      <Legend verticalAlign="bottom" align="right" wrapperStyle={{ paddingTop: 16 }} />
                      <ReferenceLine y={0} stroke="#475569" />
                      {exibirLeasingLinha ? <Line type="monotone" dataKey="Leasing" stroke={chartColors.Leasing} strokeWidth={2} dot /> : null}
                      {mostrarFinanciamento && exibirFinLinha ? (
                        <Line type="monotone" dataKey="Financiamento" stroke={chartColors.Financiamento} strokeWidth={2} dot />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}
          </>
        ) : activeTab === 'cliente' ? (
          <section className="card">
            <h2>Dados do cliente</h2>
            <div className="grid g2">
              <Field label="Nome ou Razão social">
                <input value={cliente.nome} onChange={(e) => handleClienteChange('nome', e.target.value)} />
              </Field>
              <Field label="CPF/CNPJ">
                <input value={cliente.documento} onChange={(e) => handleClienteChange('documento', e.target.value)} />
              </Field>
              <Field label="E-mail">
                <input value={cliente.email} onChange={(e) => handleClienteChange('email', e.target.value)} />
              </Field>
              <Field label="Telefone">
                <input value={cliente.telefone} onChange={(e) => handleClienteChange('telefone', e.target.value)} />
              </Field>
              <Field label="Distribuidora">
                <input value={cliente.distribuidora} onChange={(e) => handleClienteChange('distribuidora', e.target.value)} />
              </Field>
              <Field label="Unidade consumidora (UC)">
                <input value={cliente.uc} onChange={(e) => handleClienteChange('uc', e.target.value)} />
              </Field>
              <Field label="Endereço">
                <input value={cliente.endereco} onChange={(e) => handleClienteChange('endereco', e.target.value)} />
              </Field>
              <Field label="Cidade">
                <input value={cliente.cidade} onChange={(e) => handleClienteChange('cidade', e.target.value)} />
              </Field>
              <Field label="UF ou Estado">
                <input value={cliente.uf} onChange={(e) => handleClienteChange('uf', e.target.value)} />
              </Field>
            </div>
          </section>
        ) : (
          <section className="card">
            <h2>Vendas</h2>
            <p className="muted">Área de Vendas em desenvolvimento.</p>
          </section>
        )}
        </main>
      </div>

      {isSettingsOpen ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configurações</h3>
              <button className="icon" onClick={() => setIsSettingsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <h4>Mercado & energia</h4>
              <div className="grid g2">
                <Field label="Inflação energética (%)">
                  <input type="number" step="0.1" value={inflacaoAa} onChange={(e) => setInflacaoAa(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Preço por kWp (R$)">
                  <input type="number" value={precoPorKwp} onChange={(e) => setPrecoPorKwp(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Irradiação média (kWh/m²/dia)">
                  <input
                    type="number"
                    step="0.1"
                    min={0.01}
                    value={irradiacao}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setIrradiacao(Number.isFinite(parsed) && parsed > 0 ? parsed : 0)
                    }}
                  />
                </Field>
                <Field label="Eficiência do sistema">
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={eficiencia}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setEficiencia(0)
                        return
                      }
                      handleEficienciaInput(Number(e.target.value))
                    }}
                  />
                </Field>
                <Field label="Dias no mês (cálculo)">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={diasMes > 0 ? diasMes : ''}
                    onChange={(e) => {
                      const { value } = e.target
                      if (value === '') {
                        setDiasMes(0)
                        return
                      }
                      const parsed = Number(value)
                      setDiasMes(Number.isFinite(parsed) ? parsed : 0)
                    }}
                  />
                </Field>
              </div>

              <h4>Leasing parâmetros</h4>
              <div className="grid g3">
                <Field label="Prazo contratual (meses)">
                  <input
                    type="number"
                    min={1}
                    value={prazoMeses}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setPrazoMeses(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                    }}
                  />
                </Field>
                <Field label="Bandeira tarifária (R$)">
                  <input
                    type="number"
                    value={bandeiraEncargo}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setBandeiraEncargo(Number.isFinite(parsed) ? parsed : 0)
                    }}
                  />
                </Field>
                <Field label="Contribuição CIP (R$)">
                  <input
                    type="number"
                    value={cipEncargo}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setCipEncargo(Number.isFinite(parsed) ? parsed : 0)
                    }}
                  />
                </Field>
                <Field label="Uso da entrada">
                  <select value={entradaModo} onChange={(e) => setEntradaModo(e.target.value as EntradaModoLabel)}>
                    <option value="Crédito mensal">Crédito mensal</option>
                    <option value="Reduz piso contratado">Reduz piso contratado</option>
                  </select>
                </Field>
              </div>
              <div className="info-inline">
                <span className="pill">
                  Margem mínima: <strong>{currency(parcelasSolarInvest.margemMinima)}</strong>
                </span>
                <span className="pill">
                  Total pago no prazo: <strong>{currency(parcelasSolarInvest.totalPago)}</strong>
                </span>
              </div>

              <h4>Financiamento parâmetros</h4>
              <div className="grid g3">
                <Field label="Juros a.a. (%)">
                  <input type="number" step="0.1" value={jurosFinAa} onChange={(e) => setJurosFinAa(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Prazo (meses)">
                  <input type="number" value={prazoFinMeses} onChange={(e) => setPrazoFinMeses(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Entrada (%)">
                  <input type="number" step="0.1" value={entradaFinPct} onChange={(e) => setEntradaFinPct(Number(e.target.value) || 0)} />
                </Field>
              </div>

              <h4>Buyout parâmetros</h4>
              <div className="grid g3">
                <Field label="Cashback (%)">
                  <input type="number" step="0.1" value={cashbackPct} onChange={(e) => setCashbackPct(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Depreciação (%)">
                  <input type="number" step="0.1" value={depreciacaoAa} onChange={(e) => setDepreciacaoAa(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Inadimplência (%)">
                  <input type="number" step="0.1" value={inadimplenciaAa} onChange={(e) => setInadimplenciaAa(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Tributos (%)">
                  <input type="number" step="0.1" value={tributosAa} onChange={(e) => setTributosAa(Number(e.target.value) || 0)} />
                </Field>
                <Field label="IPCA (%)">
                  <input type="number" step="0.1" value={ipcaAa} onChange={(e) => setIpcaAa(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Custos fixos (R$)">
                  <input type="number" value={custosFixosM} onChange={(e) => setCustosFixosM(Number(e.target.value) || 0)} />
                </Field>
                <Field label="OPEX (R$)">
                  <input type="number" value={opexM} onChange={(e) => setOpexM(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Seguro (R$)">
                  <input type="number" value={seguroM} onChange={(e) => setSeguroM(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Duração (meses)">
                  <input type="number" value={duracaoMeses} onChange={(e) => setDuracaoMeses(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Pagos acumulados até o mês (R$)">
                  <input
                    type="number"
                    value={pagosAcumAteM}
                    onChange={(e) => setPagosAcumAteM(Number(e.target.value) || 0)}
                  />
                </Field>
              </div>

              <h4>O&M e seguro</h4>
              <div className="grid g3">
                <Field label="O&M base (R$/kWp)">
                  <input type="number" value={oemBase} onChange={(e) => setOemBase(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Reajuste O&M (%)">
                  <input type="number" step="0.1" value={oemInflacao} onChange={(e) => setOemInflacao(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Reajuste seguro (%)">
                  <input type="number" step="0.1" value={seguroReajuste} onChange={(e) => setSeguroReajuste(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Modo de seguro">
                  <select value={seguroModo} onChange={(e) => setSeguroModo(e.target.value as SeguroModo)}>
                    <option value="A">Modo A — Potência (R$)</option>
                    <option value="B">Modo B — % Valor de mercado</option>
                  </select>
                </Field>
                <Field label="Base seguro modo A (R$/kWp)">
                  <input type="number" value={seguroValorA} onChange={(e) => setSeguroValorA(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Seguro modo B (%)">
                  <input type="number" step="0.01" value={seguroPercentualB} onChange={(e) => setSeguroPercentualB(Number(e.target.value) || 0)} />
                </Field>
              </div>

              <h4>Exibição</h4>
              <div className="grid g2">
                <Field label="Mostrar gráfico ROI">
                  <select value={mostrarGrafico ? '1' : '0'} onChange={(e) => setMostrarGrafico(e.target.value === '1')}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                </Field>
                <Field label="Mostrar coluna financiamento">
                  <select value={mostrarFinanciamento ? '1' : '0'} onChange={(e) => setMostrarFinanciamento(e.target.value === '1')}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                </Field>
              </div>

              <h4>Parcelas — Total pago acumulado</h4>
              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaParcelasConfig((prev) => !prev)}
                  aria-expanded={mostrarTabelaParcelasConfig}
                  aria-controls="config-parcelas-total"
                >
                  {mostrarTabelaParcelasConfig ? 'Ocultar tabela de parcelas' : 'Exibir tabela de parcelas'}
                </button>
              </div>
              {mostrarTabelaParcelasConfig ? (
                <div className="table-wrapper">
                  <table id="config-parcelas-total">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Total pago acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasSolarInvest.lista.length > 0 ? (
                        parcelasSolarInvest.lista.map((row) => (
                          <tr key={`config-parcela-${row.mes}`}>
                            <td>{row.mes}</td>
                            <td>{currency(row.totalAcumulado)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="muted">Defina um prazo contratual para gerar a projeção das parcelas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <h4>Buyout — Receita acumulada</h4>
              <div className="table-controls">
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaBuyoutConfig((prev) => !prev)}
                  aria-expanded={mostrarTabelaBuyoutConfig}
                  aria-controls="config-buyout-receita"
                >
                  {mostrarTabelaBuyoutConfig ? 'Ocultar tabela de buyout' : 'Exibir tabela de buyout'}
                </button>
              </div>
              {mostrarTabelaBuyoutConfig ? (
                <div className="table-wrapper">
                  <table id="config-buyout-receita">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Receita acumulada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyoutReceitaRows.length > 0 ? (
                        buyoutReceitaRows.map((row) => (
                          <tr key={`config-buyout-${row.mes}`}>
                            <td>{row.mes}</td>
                            <td>{currency(row.prestacaoAcum)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="muted">Defina os parâmetros para visualizar a receita acumulada.</td>
                        </tr>
                      )}
                      {buyoutAceiteFinal ? (
                        <tr>
                          <td>{buyoutMesAceiteFinal}</td>
                          <td>{currency(buyoutAceiteFinal.prestacaoAcum)}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

