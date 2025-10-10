import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid } from 'recharts'

const currency = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$\u00a00,00'

const formatAxis = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`
  return currency(v)
}

type TabKey = 'principal' | 'cliente'

type SeguroModo = 'A' | 'B'

type EntradaModo = 'Crédito mensal' | 'Reduz piso contratado'

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
  valorMercado: number
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
  leasingBeneficios: number[]
  leasingROI: number[]
  financiamentoFluxo: number[]
  financiamentoROI: number[]
  mostrarFinanciamento: boolean
  tabelaBuyout: BuyoutRow[]
  buyoutResumo: BuyoutResumo
  capex: number
}

type MensalidadeRow = {
  mes: number
  tarifaCheia: number
  tarifaDescontada: number
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
  { cliente, anos, leasingBeneficios, leasingROI, financiamentoFluxo, financiamentoROI, mostrarFinanciamento, tabelaBuyout, buyoutResumo, capex },
  ref,
) {
  return (
    <div ref={ref} className="print-layout">
      <header className="print-header">
        <div className="print-logo">
          <img src="/logo.svg" alt="SolarInvest" />
        </div>
        <div className="print-client">
          <h1>Proposta SolarInvest</h1>
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
        <h2>Resumo financeiro</h2>
        <p>
          <strong>Investimento estimado (CAPEX):</strong> {currency(capex)}
        </p>
        <div className={`print-grid ${mostrarFinanciamento ? 'two' : 'one'}`}>
          <div>
            <h3>Leasing</h3>
            <table>
              <thead>
                <tr>
                  <th>Ano</th>
                  <th>Benefício anual</th>
                  <th>ROI acumulado</th>
                </tr>
              </thead>
              <tbody>
                {anos.map((ano) => (
                  <tr key={`leasing-${ano}`}>
                    <td>{ano}</td>
                    <td>{currency(leasingBeneficios[ano - 1] ?? 0)}</td>
                    <td>{currency(leasingROI[ano - 1] ?? 0)}</td>
                  </tr>
                ))}
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
                    <th>ROI acumulado</th>
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
        <h2>Buyout — projeção</h2>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Tarifa projetada</th>
              <th>Prestação efetiva</th>
              <th>Receita acumulada</th>
              <th>Cashback</th>
              <th>Valor de compra</th>
            </tr>
          </thead>
          <tbody>
            {tabelaBuyout
              .filter((row) => row.mes >= 6 && row.mes <= 60)
              .map((row) => (
                <tr key={row.mes}>
                  <td>{row.mes}</td>
                  <td>{currency(row.tarifa)}</td>
                  <td>{currency(row.prestacaoEfetiva)}</td>
                  <td>{currency(row.prestacaoAcum)}</td>
                  <td>{currency(row.cashback)}</td>
                  <td>{row.valorResidual === null ? '—' : currency(row.valorResidual)}</td>
                </tr>
              ))}
            <tr key="61">
              <td>61</td>
              <td colSpan={4}>Aceite final</td>
              <td>{currency(0)}</td>
            </tr>
          </tbody>
        </table>
        <div className="print-notes">
          <p><strong>Parâmetros considerados:</strong></p>
          <ul>
            <li>Valor de mercado: {currency(buyoutResumo.valorMercado)} • Cashback: {buyoutResumo.cashbackPct}%</li>
            <li>
              Depreciação: {buyoutResumo.depreciacaoPct}% • Inadimplência: {buyoutResumo.inadimplenciaPct}% • Tributos: {buyoutResumo.tributosPct}%
            </li>
            <li>Inflação energética: {buyoutResumo.infEnergia}% • IPCA: {buyoutResumo.ipca}%</li>
            <li>
              Custos fixos: {currency(buyoutResumo.custosFixos)} • OPEX: {currency(buyoutResumo.opex)} • Seguro: {currency(buyoutResumo.seguro)}
            </li>
            <li>Duração contratual: {buyoutResumo.duracao} meses</li>
          </ul>
        </div>
        <p className="print-footer">
          Após o prazo, o cliente passa a capturar 100% da economia frente à concessionária — ROI Leasing – Benefício financeiro.
        </p>
      </section>
    </div>
  )
})

const anosAnalise = 30
const diasMesPadrao = 30
const painelOpcoes = [450, 500, 550, 600, 650, 700]
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
  .print-grid{display:grid;gap:16px;}
  .print-grid.two{grid-template-columns:repeat(2,minmax(0,1fr));}
  .print-grid.one{grid-template-columns:repeat(1,minmax(0,1fr));}
  ul{margin:8px 0 0;padding-left:18px;}
  li{font-size:12px;margin-bottom:4px;}
`;


export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('principal')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [consumoMensal, setConsumoMensal] = useState(1200)
  const [tarifaBase, setTarifaBase] = useState(0.964)
  const [descontoPct, setDescontoPct] = useState(20)
  const [taxaMinima, setTaxaMinima] = useState(95)
  const [encargos, setEncargos] = useState(0)
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

  const [precoPorKwp, setPrecoPorKwp] = useState(2470)
  const [irradiacao, setIrradiacao] = useState(5.51)
  const [eficiencia, setEficiencia] = useState(0.8)
  const [inflEnergia, setInflEnergia] = useState(8)

  const [jurosFinAA, setJurosFinAA] = useState(15)
  const [prazoFinMeses, setPrazoFinMeses] = useState(120)
  const [entradaFinPct, setEntradaFinPct] = useState(20)
  const [mostrarFinanciamento, setMostrarFinanciamento] = useState(true)
  const [mostrarGrafico, setMostrarGrafico] = useState(true)

  const [prazoContratoMeses, setPrazoContratoMeses] = useState(60)
  const [bandeiraValor, setBandeiraValor] = useState(0)
  const [cipValor, setCipValor] = useState(0)
  const [entradaValor, setEntradaValor] = useState(0)
  const [entradaModo, setEntradaModo] = useState<EntradaModo>('Crédito mensal')
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

  const [buyoutValorMercado, setBuyoutValorMercado] = useState(0)
  const [buyoutCashbackPct, setBuyoutCashbackPct] = useState(10)
  const [buyoutDepreciacaoPct, setBuyoutDepreciacaoPct] = useState(12)
  const [buyoutInadimplenciaPct, setBuyoutInadimplenciaPct] = useState(2)
  const [buyoutTributosPct, setBuyoutTributosPct] = useState(6)
  const [buyoutIpca, setBuyoutIpca] = useState(4)
  const [buyoutCustosFixos, setBuyoutCustosFixos] = useState(0)
  const [buyoutOpex, setBuyoutOpex] = useState(0)
  const [buyoutSeguro, setBuyoutSeguro] = useState(0)
  const [buyoutDuracao, setBuyoutDuracao] = useState(60)

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
    () => irradiacao > 0 ? irradiacao : 0,
    [irradiacao],
  )

  const fatorGeracao = useMemo(
    () => baseIrradiacao * eficienciaNormalizada * diasMesPadrao,
    [baseIrradiacao, eficienciaNormalizada],
  )

  const numeroPlacasInformado = useMemo(() => {
    if (typeof numeroPlacasManual !== 'number') return null
    if (!Number.isFinite(numeroPlacasManual) || numeroPlacasManual <= 0) return null
    return Math.max(1, Math.round(numeroPlacasManual))
  }, [numeroPlacasManual])

  const potenciaInstaladaKwp = useMemo(() => {
    if (numeroPlacasInformado && potenciaPlaca > 0) {
      return (numeroPlacasInformado * potenciaPlaca) / 1000
    }
    if (fatorGeracao > 0) {
      return consumoMensal / fatorGeracao
    }
    return 0
  }, [consumoMensal, fatorGeracao, numeroPlacasInformado, potenciaPlaca])

  const numeroPlacasCalculado = useMemo(() => {
    if (numeroPlacasInformado) return numeroPlacasInformado
    if (potenciaPlaca <= 0) return 0
    const calculado = Math.ceil((potenciaInstaladaKwp * 1000) / potenciaPlaca)
    return Math.max(1, Number.isFinite(calculado) ? calculado : 0)
  }, [numeroPlacasInformado, potenciaInstaladaKwp, potenciaPlaca])

  const geracaoMensalKwh = useMemo(
    () => potenciaInstaladaKwp * fatorGeracao,
    [potenciaInstaladaKwp, fatorGeracao],
  )

  const geracaoDiariaKwh = useMemo(
    () => (geracaoMensalKwh > 0 ? geracaoMensalKwh / diasMesPadrao : 0),
    [geracaoMensalKwh],
  )

  const capex = useMemo(() => potenciaInstaladaKwp * precoPorKwp, [potenciaInstaladaKwp, precoPorKwp])

  useEffect(() => {
    if (buyoutValorMercado === 0) {
      setBuyoutValorMercado(Math.round(capex))
    }
  }, [capex, buyoutValorMercado])

  const valorMercado = useMemo(() => (buyoutValorMercado > 0 ? buyoutValorMercado : capex), [buyoutValorMercado, capex])

  const tarifaAno = (ano: number) => tarifaBase * Math.pow(1 + inflEnergia / 100, ano - 1)
  const tarifaDescontadaAno = (ano: number) => tarifaAno(ano) * (1 - descontoPct / 100)

  const leasingBeneficios = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      const tarifaCheia = tarifaAno(ano)
      const tarifaDescontada = tarifaDescontadaAno(ano)
      const custoSemSistema = consumoMensal * tarifaCheia + encargos + taxaMinima
      const prestacao = ano <= leasingPrazo ? consumoMensal * tarifaDescontada + encargos + taxaMinima : 0
      const beneficio = 12 * (custoSemSistema - prestacao)
      return beneficio
    })
  }, [consumoMensal, descontoPct, encargos, inflEnergia, leasingPrazo, tarifaBase, taxaMinima])

  const entradaModoNormalizado = useMemo<'CREDITO' | 'REDUZ' | 'NONE'>(() => {
    const label = (entradaModo ?? '').toLowerCase().trim()
    if (!entradaValor || entradaValor <= 0) return 'NONE'
    if (label === 'crédito mensal' || label === 'credito mensal') return 'CREDITO'
    if (label === 'reduz piso contratado') return 'REDUZ'
    return 'NONE'
  }, [entradaModo, entradaValor])

  const leasingROI = useMemo(() => {
    const acc: number[] = []
    let acumulado = 0
    leasingBeneficios.forEach((beneficio) => {
      acumulado += beneficio
      acc.push(acumulado)
    })
    return acc
  }, [leasingBeneficios])

  const taxaMensalFin = useMemo(() => Math.pow(1 + jurosFinAA / 100, 1 / 12) - 1, [jurosFinAA])
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
    return valorMercado * (seguroPercentualB / 100) * Math.pow(1 + seguroReajuste / 100, ano - 1)
  }

  const financiamentoFluxo = useMemo(() => {
    return Array.from({ length: anosAnalise }, (_, i) => {
      const ano = i + 1
      const economia = 12 * consumoMensal * tarifaAno(ano)
      const custoSemSistemaMensal = Math.max(consumoMensal * tarifaAno(ano), taxaMinima)
      const economiaAnual = 12 * Math.max(custoSemSistemaMensal - taxaMinima, 0)
      const inicioAno = (ano - 1) * 12
      const mesesRestantes = Math.max(0, prazoFinMeses - inicioAno)
      const mesesPagos = Math.min(12, mesesRestantes)
      const custoParcela = mesesPagos * Math.abs(pmt)
      const despesasSistema = custoParcela + custoOeM(ano) + custoSeguro(ano)
      return economiaAnual - despesasSistema
    })
  }, [consumoMensal, inflEnergia, jurosFinAA, oemBase, oemInflacao, pmt, prazoFinMeses, seguroModo, seguroPercentualB, seguroReajuste, seguroValorA, tarifaBase, taxaMinima, valorMercado, potenciaInstaladaKwp])

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
    const descontoDecimal = Math.max(0, Math.min(descontoPct / 100, 1))
    const inflacaoAnual = Math.max(0, inflEnergia / 100)
    const meses = Math.max(0, Math.floor(prazoContratoMeses))
    const tarifaDescontadaBase = tarifaBase * (1 - descontoDecimal)
    const encargosFixos = Math.max(0, bandeiraValor + cipValor + encargos)
    const taxaMinimaNormalizada = Math.max(0, taxaMinima)
    const margemMinima = taxaMinimaNormalizada + encargosFixos

    const denominadorReducao = consumoMensal * tarifaBase * (1 - descontoDecimal) * meses
    const fracReducao =
      entradaModoNormalizado === 'REDUZ' && denominadorReducao > 0
        ? Math.min(1, Math.max(0, entradaValor / denominadorReducao))
        : 0
    const kcAjustado = Math.max(0, consumoMensal * (1 - fracReducao))
    const creditoMensal = entradaModoNormalizado === 'CREDITO' && meses > 0 ? entradaValor / meses : 0

    const lista: MensalidadeRow[] = []
    if (meses > 0) {
      let totalAcumulado = 0
      for (let mes = 1; mes <= meses; mes += 1) {
        const anoIndex = Math.floor((mes - 1) / 12)
        const fatorInflacao = Math.pow(1 + inflacaoAnual, anoIndex)
        const tarifaCheia = tarifaBase * fatorInflacao
        const tarifaDescontada = tarifaDescontadaBase * fatorInflacao

        const consumoContratado = entradaModoNormalizado === 'REDUZ' ? kcAjustado : consumoMensal
        const baseEnergia = consumoContratado * tarifaDescontada

        let mensalidadeLiquida = baseEnergia + taxaMinimaNormalizada + encargosFixos
        if (entradaModoNormalizado === 'CREDITO') {
          mensalidadeLiquida -= creditoMensal
        }

        mensalidadeLiquida = Math.max(0, mensalidadeLiquida)
        totalAcumulado += mensalidadeLiquida
        lista.push({
          mes,
          tarifaCheia,
          tarifaDescontada,
          mensalidade: Number(mensalidadeLiquida.toFixed(2)),
          totalAcumulado: Number(totalAcumulado.toFixed(2)),
        })
      }
    }

    const totalPago = lista.length > 0 ? lista[lista.length - 1].totalAcumulado : 0

    return {
      lista,
      tarifaDescontadaBase,
      kcAjustado,
      creditoMensal,
      margemMinima,
      prazoEfetivo: meses,
      totalPago,
      inflacaoMensal: Math.pow(1 + inflacaoAnual, 1 / 12) - 1,
    }
  }, [
    bandeiraValor,
    cipValor,
    consumoMensal,
    descontoPct,
    encargos,
    entradaModoNormalizado,
    entradaValor,
    inflEnergia,
    prazoContratoMeses,
    tarifaBase,
    taxaMinima,
  ])

  const leasingMensalidades = useMemo(() => {
    if (parcelasSolarInvest.lista.length === 0) return []

    const meses = parcelasSolarInvest.prazoEfetivo
    const anos = Math.ceil(meses / 12)
    const valoresPorAno: number[] = []

    for (let ano = 0; ano < anos; ano += 1) {
      const inicio = ano * 12
      const fim = Math.min((ano + 1) * 12, parcelasSolarInvest.lista.length)
      const chunk = parcelasSolarInvest.lista.slice(inicio, fim)
      if (chunk.length === 0) continue
      const soma = chunk.reduce((acc, row) => acc + row.mensalidade, 0)
      valoresPorAno.push(Number((soma / chunk.length).toFixed(2)))
    }

    return valoresPorAno
  }, [parcelasSolarInvest])

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

  const valoresGrafico = chartData.flatMap((row) => [row.Leasing, row.Financiamento])
  const minY = Math.min(...valoresGrafico, 0)
  const maxY = Math.max(...valoresGrafico, 0)
  const padding = Math.max(5_000, Math.round((maxY - minY) * 0.1))
  const yDomain: [number, number] = [Math.floor((minY - padding) / 1000) * 1000, Math.ceil((maxY + padding) / 1000) * 1000]

  const buyoutMeses = useMemo(() => Array.from({ length: Math.max(buyoutDuracao, 60) }, (_, i) => i + 1), [buyoutDuracao])

  const tabelaBuyout = useMemo<BuyoutRow[]>(() => {
    const rows: BuyoutRow[] = []
    const tarifasLeasingPorMes = new Map<number, number>()
    parcelasSolarInvest.lista.forEach((row) => {
      tarifasLeasingPorMes.set(row.mes, row.tarifaCheia)
    })

    const obterTarifaProjetada = (mes: number) => {
      const mesReferencia = mes - 5
      if (mesReferencia <= 0) {
        if (parcelasSolarInvest.lista.length > 0) {
          return parcelasSolarInvest.lista[0].tarifaCheia
        }
        return tarifaBase
      }

      const tarifaLeasing = tarifasLeasingPorMes.get(mesReferencia)
      if (typeof tarifaLeasing === 'number') {
        return tarifaLeasing
      }

      if (parcelasSolarInvest.lista.length > 0) {
        const ultimaParcela = parcelasSolarInvest.lista[parcelasSolarInvest.lista.length - 1]
        if (mesReferencia >= ultimaParcela.mes) {
          return ultimaParcela.tarifaCheia
        }
      }

      const anosDecorridos = Math.floor(Math.max(mesReferencia - 1, 0) / 12)
      return tarifaBase * Math.pow(1 + inflEnergia / 100, anosDecorridos)
    }

    let prestAcum = 0
    buyoutMeses.forEach((mes) => {
      const tarifa = obterTarifaProjetada(mes)
      const prestBruta = geracaoMensalKwh * tarifa * (1 - descontoPct / 100) + taxaMinima + buyoutCustosFixos + buyoutOpex + buyoutSeguro
      const receitaEfetiva = prestBruta * (1 - buyoutInadimplenciaPct / 100)
      const tributos = receitaEfetiva * (buyoutTributosPct / 100)
      const prestEfetiva = receitaEfetiva - tributos
      prestAcum += prestEfetiva
      const cashback = (buyoutCashbackPct / 100) * prestAcum
      let valorResidual: number | null = null
      if (mes >= 6 && mes <= 60) {
        const baseLinear = Math.max(
          valorMercado * (1 - (buyoutDepreciacaoPct / 100) * ((mes - 6) / (60 - 6))),
          valorMercado * 0.3,
        )
        valorResidual = Math.max(baseLinear, valorMercado - cashback)
      }
      rows.push({ mes, tarifa, prestacaoEfetiva: prestEfetiva, prestacaoAcum: prestAcum, cashback, valorResidual })
    })
    rows.push({
      mes: 61,
      tarifa: obterTarifaProjetada(61),
      prestacaoEfetiva: 0,
      prestacaoAcum: prestAcum,
      cashback: (buyoutCashbackPct / 100) * prestAcum,
      valorResidual: 0,
    })
    return rows
  }, [
    buyoutMeses,
    parcelasSolarInvest,
    tarifaBase,
    inflEnergia,
    geracaoMensalKwh,
    descontoPct,
    taxaMinima,
    buyoutCustosFixos,
    buyoutOpex,
    buyoutSeguro,
    buyoutInadimplenciaPct,
    buyoutTributosPct,
    buyoutCashbackPct,
    valorMercado,
    buyoutDepreciacaoPct,
  ])

  const buyoutAceiteFinal = tabelaBuyout.find((row) => row.mes === 61) ?? null
  const buyoutReceitaRows = useMemo(() => tabelaBuyout.filter((row) => row.mes >= 6 && row.mes <= 60), [tabelaBuyout])

  const buyoutResumo: BuyoutResumo = {
    valorMercado,
    cashbackPct: buyoutCashbackPct,
    depreciacaoPct: buyoutDepreciacaoPct,
    inadimplenciaPct: buyoutInadimplenciaPct,
    tributosPct: buyoutTributosPct,
    infEnergia: inflEnergia,
    ipca: buyoutIpca,
    custosFixos: buyoutCustosFixos,
    opex: buyoutOpex,
    seguro: buyoutSeguro,
    duracao: buyoutDuracao,
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
        leasingBeneficios={leasingBeneficios}
        leasingROI={leasingROI}
        financiamentoFluxo={financiamentoFluxo}
        financiamentoROI={financiamentoROI}
        mostrarFinanciamento={mostrarFinanciamento}
        tabelaBuyout={tabelaBuyout}
        buyoutResumo={buyoutResumo}
        capex={capex}
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
          <button className={activeTab === 'principal' ? 'active' : ''} onClick={() => setActiveTab('principal')}>Principal</button>
          <button className={activeTab === 'cliente' ? 'active' : ''} onClick={() => setActiveTab('cliente')}>Cliente</button>
        </nav>

        <main className="content page-content">
          {activeTab === 'principal' ? (
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
                  <input type="number" value={consumoMensal} onChange={(e) => setConsumoMensal(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Tarifa cheia (R$/kWh)">
                  <input type="number" step="0.001" value={tarifaBase} onChange={(e) => setTarifaBase(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Desconto contratual (%)">
                  <input type="number" step="0.1" value={descontoPct} onChange={(e) => setDescontoPct(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Taxa mínima (R$/mês)">
                  <input type="number" value={taxaMinima} onChange={(e) => setTaxaMinima(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Encargos adicionais (R$/mês)">
                  <input type="number" value={encargos} onChange={(e) => setEncargos(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Prazo do leasing">
                  <select value={leasingPrazo} onChange={(e) => setLeasingPrazo(Number(e.target.value) as 5 | 7 | 10)}>
                    <option value={5}>5 anos</option>
                    <option value={7}>7 anos</option>
                    <option value={10}>10 anos</option>
                  </select>
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
                    value={entradaValor}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setEntradaValor(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                    }}
                  />
                </Field>
              </div>

              <div className="info-inline">
                <span className="pill">
                  Tarifa c/ desconto: <strong>{currency(parcelasSolarInvest.tarifaDescontadaBase)} / kWh</strong>
                </span>
                {entradaModoNormalizado === 'REDUZ' ? (
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
                {entradaModoNormalizado === 'CREDITO' ? (
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
                        <th>Mensalidade líquida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasSolarInvest.lista.length > 0 ? (
                        parcelasSolarInvest.lista.map((row) => (
                          <tr key={row.mes}>
                            <td>{row.mes}</td>
                            <td>{currency(row.tarifaCheia)}</td>
                            <td>{currency(row.tarifaDescontada)}</td>
                            <td>{currency(row.mensalidade)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="muted">Defina um prazo contratual para gerar a projeção das parcelas.</td>
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

            {mostrarGrafico ? (
              <section className="card">
                <div className="card-header">
                  <h2>ROI acumulado — 30 anos</h2>
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
                      <span>Economia acumulada versus concessionária. Após o prazo, o retorno cresce acelerado.</span>
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

            <section className="card">
              <div className="card-header">
                <h2>Compra antecipada (Buyout)</h2>
                <span className="muted">Valores entre o mês 6 e o mês 60.</span>
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
                        .filter((row) => row.mes >= 6 && row.mes <= 60)
                        .map((row) => (
                          <tr key={row.mes}>
                            <td>{row.mes}</td>
                            <td>{currency(row.tarifa)}</td>
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
          </>
        ) : (
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
              <Field label="UF">
                <input value={cliente.uf} maxLength={2} onChange={(e) => handleClienteChange('uf', e.target.value.toUpperCase())} />
              </Field>
            </div>
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
                  <input type="number" step="0.1" value={inflEnergia} onChange={(e) => setInflEnergia(Number(e.target.value) || 0)} />
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
              </div>

              <h4>Leasing parâmetros</h4>
              <div className="grid g3">
                <Field label="Prazo contratual (meses)">
                  <input
                    type="number"
                    min={1}
                    value={prazoContratoMeses}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setPrazoContratoMeses(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                    }}
                  />
                </Field>
                <Field label="Bandeira tarifária (R$)">
                  <input
                    type="number"
                    value={bandeiraValor}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setBandeiraValor(Number.isFinite(parsed) ? parsed : 0)
                    }}
                  />
                </Field>
                <Field label="Contribuição CIP (R$)">
                  <input
                    type="number"
                    value={cipValor}
                    onChange={(e) => {
                      const parsed = Number(e.target.value)
                      setCipValor(Number.isFinite(parsed) ? parsed : 0)
                    }}
                  />
                </Field>
                <Field label="Uso da entrada">
                  <select value={entradaModo} onChange={(e) => setEntradaModo(e.target.value as EntradaModo)}>
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
                  <input type="number" step="0.1" value={jurosFinAA} onChange={(e) => setJurosFinAA(Number(e.target.value) || 0)} />
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
                <Field label="Valor de mercado (R$)">
                  <input type="number" value={buyoutValorMercado} onChange={(e) => setBuyoutValorMercado(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Cashback (%)">
                  <input type="number" step="0.1" value={buyoutCashbackPct} onChange={(e) => setBuyoutCashbackPct(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Depreciação (%)">
                  <input type="number" step="0.1" value={buyoutDepreciacaoPct} onChange={(e) => setBuyoutDepreciacaoPct(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Inadimplência (%)">
                  <input type="number" step="0.1" value={buyoutInadimplenciaPct} onChange={(e) => setBuyoutInadimplenciaPct(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Tributos (%)">
                  <input type="number" step="0.1" value={buyoutTributosPct} onChange={(e) => setBuyoutTributosPct(Number(e.target.value) || 0)} />
                </Field>
                <Field label="IPCA (%)">
                  <input type="number" step="0.1" value={buyoutIpca} onChange={(e) => setBuyoutIpca(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Custos fixos (R$)">
                  <input type="number" value={buyoutCustosFixos} onChange={(e) => setBuyoutCustosFixos(Number(e.target.value) || 0)} />
                </Field>
                <Field label="OPEX (R$)">
                  <input type="number" value={buyoutOpex} onChange={(e) => setBuyoutOpex(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Seguro (R$)">
                  <input type="number" value={buyoutSeguro} onChange={(e) => setBuyoutSeguro(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Duração (meses)">
                  <input type="number" value={buyoutDuracao} onChange={(e) => setBuyoutDuracao(Number(e.target.value) || 0)} />
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
                          <td>61</td>
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

