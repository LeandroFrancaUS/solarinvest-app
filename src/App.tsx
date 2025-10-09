import React, { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid } from 'recharts'

const currency = (v:number)=> v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

export default function App(){
  const [Kc,setKc]=useState<number>(600)
  const [T,setT]=useState<number>(0.946)
  const [descontoPct,setDescontoPct]=useState<number>(20)
  const [encargos,setEncargos]=useState<number>(0)
  const [taxaMinima,setTaxaMinima]=useState<number>(35)
  const [leasingTermYears,setLeasingTermYears]=useState<5|7|10>(5)

  const [irradiacao]=useState<number>(5.0)
  const [eficiencia]=useState<number>(0.75)
  const [precoPorKWp]=useState<number>(2470)

  const [potenciaPlacaWp,setPotenciaPlacaWp]=useState<number>(550)
  const painelOpcoes = [450,500,550,600,650,700]

  const [jurosFinAA,setJurosFinAA]=useState<number>(16)
  const [prazoFinMeses,setPrazoFinMeses]=useState<number>(60)
  const [entradaFinPct,setEntradaFinPct]=useState<number>(20)
  const [showFinanciamento,setShowFinanciamento]=useState<boolean>(true)

  const [inflAA,setInflAA]=useState<number>(10)

  // Dimensionamento 
  const consumoDiario = useMemo(()=> Kc/30, [Kc])
  const kWp = useMemo(()=> {
    const denom = Math.max(irradiacao*eficiencia, 0.0001)
    return consumoDiario/denom
  }, [consumoDiario,irradiacao,eficiencia])
  const placas = useMemo(()=> Math.max(1, Math.ceil(kWp*1000/potenciaPlacaWp)), [kWp,potenciaPlacaWp])
  const potenciaRealKwp = useMemo(()=> (placas*potenciaPlacaWp)/1000, [placas,potenciaPlacaWp])
  const capex = useMemo(()=> potenciaRealKwp*precoPorKWp, [potenciaRealKwp,precoPorKWp])
  const energiaMesAprox = useMemo(()=> potenciaRealKwp*irradiacao*eficiencia*30, [potenciaRealKwp,irradiacao,eficiencia])

  // Financiamento: PMT e médias anuais
  const taxaMensalFin = useMemo(()=> Math.pow(1+jurosFinAA/100,1/12)-1, [jurosFinAA])
  const valorFinanciado = useMemo(()=> capex*(1-entradaFinPct/100), [capex,entradaFinPct])
  const pmtFin = useMemo(()=> valorFinanciado===0?0: - (valorFinanciado*taxaMensalFin) / (1 - Math.pow(1+taxaMensalFin, -prazoFinMeses)), [valorFinanciado,taxaMensalFin,prazoFinMeses])
  const finMedioAnual = useMemo(()=> {
    const anos = Math.ceil(prazoFinMeses/12)
    return Array.from({length: anos}, ()=> Math.abs(pmtFin))
  }, [pmtFin,prazoFinMeses])

  // ROI (anuais, 30 anos)
  const anosAnalise = 30
  const lucroMensal = (tarifa:number)=> Math.max(0,(Kc*tarifa)-taxaMinima)

  // À vista
  const serieVista:number[]=[]; let accV=-capex; let t1=T
  for(let a=0;a<=anosAnalise;a++){
    if(a>0){
      for(let m=0;m<12;m++){ accV += lucroMensal(t1) }
      t1 *= (1+inflAA/100)
    }
    serieVista.push(accV)
  }

  // Leasing
  const serieLeasing:number[]=[]; let accL=0; let t2=T
  for(let a=0;a<=anosAnalise;a++){
    if(a>0){
      for(let m=0;m<12;m++){
        if(a<=leasingTermYears){
          const td = T*(1-descontoPct/100) * Math.pow(1+inflAA/100, (a-1)) // inflação anual no desconto também
          const mensalidade = (Kc*td) + encargos
          accL += (Kc*t2) - mensalidade
        } else {
          accL += lucroMensal(t2)
        }
      }
      t2 *= (1+inflAA/100)
    }
    serieLeasing.push(accL)
  }

  // Financiado
  const serieFin:number[]=[]; let accF=-(capex*(entradaFinPct/100)); let t3=T
  for(let a=0;a<=anosAnalise;a++){
    if(a>0){
      for(let m=1;m<=12;m++){
        const mesAbs = (a-1)*12 + m
        const parcela = mesAbs<=prazoFinMeses ? -Math.abs(pmtFin) : 0
        accF += lucroMensal(t3) + parcela
      }
      t3 *= (1+inflAA/100)
    }
    serieFin.push(accF)
  }

  type Row = { ano:number, Leasing:number, Vista:number, Financiado:number }
  const data:Row[] = Array.from({length: anosAnalise+1}, (_,i)=> ({
    ano:i, Leasing: serieLeasing[i], Vista: serieVista[i], Financiado: serieFin[i]
  }))

  const allVals = data.flatMap(d=> [d.Leasing, d.Vista, d.Financiado])
  const minY = Math.min(...allVals)
  const maxY = Math.max(...allVals)
  const pad = Math.max(1000, Math.round((maxY - minY) * 0.08))
  const yMin = Math.floor((minY - pad) / 100) * 100
  const yMax = Math.ceil((maxY + pad) / 100) * 100

  return (
    <div className="container">
      <div className="brand">
        <img src="/logo.png" alt="SolarInvest"/>
        <p className="subtitle">Proposta Interativa</p>
      </div>

      <div className="card">
        <div className="grid g3">
          <div className="row"><label>Consumo mensal (kWh/mês)</label><input type="number" value={Kc} onChange={e=>setKc(parseFloat(e.target.value||'0'))}/></div>
          <div className="row"><label>Tarifa cheia R$/kWh</label><input type="number" step="0.001" value={T} onChange={e=>setT(parseFloat(e.target.value||'0'))}/></div>
          <div className="row"><label>Desconto (%)</label><input type="number" step="0.1" value={descontoPct} onChange={e=>setDescontoPct(parseFloat(e.target.value||'0'))}/></div>
          <div className="row"><label>Taxa mínima (R$/mês)</label><input type="number" value={taxaMinima} onChange={e=>setTaxaMinima(parseFloat(e.target.value||'0'))}/></div>
          <div className="row"><label>Outros encargos (R$/mês)</label><input type="number" value={encargos} onChange={e=>setEncargos(parseFloat(e.target.value||'0'))}/></div>
          <div className="row">
            <label>Prazo do leasing</label>
            <select value={leasingTermYears} onChange={e=>setLeasingTermYears(parseInt(e.target.value) as 5|7|10)}>
              <option value={5}>5 anos</option><option value={7}>7 anos</option><option value={10}>10 anos</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <p className="title">Informações da usina fotovoltaica</p>
        <div className="grid g4">
          <div className="row"><label>Potência da placa (Wp)</label>
            <select value={potenciaPlacaWp} onChange={e=>setPotenciaPlacaWp(parseFloat(e.target.value))}>
              {painelOpcoes.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="row"><label>Placas aproximadas</label><input readOnly value={placas}/></div>
          <div className="row"><label>Potência estimada (kWp)</label><input readOnly value={potenciaRealKwp.toFixed(2)}/></div>
          <div className="row"><label>kWh/mês aproximado</label><input readOnly value={energiaMesAprox.toFixed(0)}/></div>
        </div>
        <div className="kpis" style={{marginTop:10}}><span className="pill">Custo médio estimado à vista: <b>{currency(capex)}</b></span></div>
      </div>

      <div className="grid g2" style={{marginTop:16}}>
        <div className="card">
          <p className="title">Leasing — médias anuais</p>
          <div className="list-col">
            {Array.from({length: leasingTermYears},(_,i)=>{
              const tdAno = T*(1-descontoPct/100) * Math.pow(1+inflAA/100, i)
              const media = (Kc*tdAno + encargos)
              return (<div key={i} className="list-row"><span>Ano {i+1}</span><b>{currency(media)}</b></div>)
            })}
            <div className="notice"><div className="dot"></div><div><div className="notice-title">Fim do prazo do leasing</div><div className="notice-sub">A partir do ano {leasingTermYears+1}: prestação = R$ 0,00 • 100% do retorno ao contratante</div></div></div>
          </div>
        </div>
        <div className="card">
          <div className="row" style={{marginBottom:8}}>
            <label>Mostrar coluna de financiamento</label>
            <select value={showFinanciamento?'on':'off'} onChange={e=>setShowFinanciamento(e.target.value==='on')}><option value="on">Sim</option><option value="off">Não</option></select>
          </div>
          {showFinanciamento ? (<>
            <p className="title">Financiamento — média anual</p>
            <div className="list-col">
              {finMedioAnual.map((v,i)=> (<div key={i} className="list-row"><span>Ano {i+1}</span><b>{currency(v)}</b></div>))}
            </div>
          </>) : <p className="muted">Coluna desativada nas configurações.</p>}
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <p className="title">ROI acumulado — 30 anos</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
              <XAxis dataKey="ano" stroke="#9CA3AF" label={{value:'Anos', position:'insideBottomRight', offset:-5, fill:'#9CA3AF'}}/>
              <YAxis stroke="#9CA3AF" tickFormatter={(v)=>currency(Number(v))} domain={[yMin, yMax]} width={96}/>
              <Tooltip formatter={(v)=>currency(Number(v))} contentStyle={{background:'#0b1220',border:'1px solid #1f2b40'}}/>
              <Legend/>
              <ReferenceLine y={0} stroke="#475569"/>
              <Line type="monotone" dataKey="Leasing" stroke="#FF8C00" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Vista" stroke="#22c55e" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Financiado" stroke="#60A5FA" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
