// src/features/simulacoes/useLeasingFinanciamentoState.ts
//
// Extracted from App.tsx. Owns the leasing/financing display state group:
// interest rate, term, down-payment, chart toggles, and table visibility flags.
//
// Zero behavioural change — exact same logic as the original App.tsx block.

import { useState } from 'react'
import { INITIAL_VALUES, type EntradaModoLabel } from '../../app/config'

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseLeasingFinanciamentoStateResult {
  jurosFinAa: number
  setJurosFinAa: React.Dispatch<React.SetStateAction<number>>
  prazoFinMeses: number
  setPrazoFinMeses: React.Dispatch<React.SetStateAction<number>>
  entradaFinPct: number
  setEntradaFinPct: React.Dispatch<React.SetStateAction<number>>
  mostrarFinanciamento: boolean
  setMostrarFinanciamento: React.Dispatch<React.SetStateAction<boolean>>
  mostrarGrafico: boolean
  setMostrarGrafico: React.Dispatch<React.SetStateAction<boolean>>
  prazoMeses: number
  setPrazoMeses: React.Dispatch<React.SetStateAction<number>>
  bandeiraEncargo: number
  setBandeiraEncargo: React.Dispatch<React.SetStateAction<number>>
  cipEncargo: number
  setCipEncargo: React.Dispatch<React.SetStateAction<number>>
  entradaRs: number
  setEntradaRs: React.Dispatch<React.SetStateAction<number>>
  entradaModo: EntradaModoLabel
  setEntradaModo: React.Dispatch<React.SetStateAction<EntradaModoLabel>>
  mostrarValorMercadoLeasing: boolean
  setMostrarValorMercadoLeasing: React.Dispatch<React.SetStateAction<boolean>>
  mostrarTabelaParcelas: boolean
  setMostrarTabelaParcelas: React.Dispatch<React.SetStateAction<boolean>>
  mostrarTabelaBuyout: boolean
  setMostrarTabelaBuyout: React.Dispatch<React.SetStateAction<boolean>>
  gerandoTabelaTransferencia: boolean
  setGerandoTabelaTransferencia: React.Dispatch<React.SetStateAction<boolean>>
  mostrarTabelaParcelasConfig: boolean
  setMostrarTabelaParcelasConfig: React.Dispatch<React.SetStateAction<boolean>>
  mostrarTabelaBuyoutConfig: boolean
  setMostrarTabelaBuyoutConfig: React.Dispatch<React.SetStateAction<boolean>>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLeasingFinanciamentoState(): UseLeasingFinanciamentoStateResult {
  const [jurosFinAa, setJurosFinAa] = useState(INITIAL_VALUES.jurosFinanciamentoAa)
  const [prazoFinMeses, setPrazoFinMeses] = useState(INITIAL_VALUES.prazoFinanciamentoMeses)
  const [entradaFinPct, setEntradaFinPct] = useState(INITIAL_VALUES.entradaFinanciamentoPct)
  const [mostrarFinanciamento, setMostrarFinanciamento] = useState(
    INITIAL_VALUES.mostrarFinanciamento,
  )
  const [mostrarGrafico, setMostrarGrafico] = useState(INITIAL_VALUES.mostrarGrafico)
  const [prazoMeses, setPrazoMeses] = useState(INITIAL_VALUES.prazoMeses)
  const [bandeiraEncargo, setBandeiraEncargo] = useState(INITIAL_VALUES.bandeiraEncargo)
  const [cipEncargo, setCipEncargo] = useState(INITIAL_VALUES.cipEncargo)
  const [entradaRs, setEntradaRs] = useState(INITIAL_VALUES.entradaRs)
  const [entradaModo, setEntradaModo] = useState<EntradaModoLabel>(INITIAL_VALUES.entradaModo)
  const [mostrarValorMercadoLeasing, setMostrarValorMercadoLeasing] = useState(
    INITIAL_VALUES.mostrarValorMercadoLeasing,
  )
  const [mostrarTabelaParcelas, setMostrarTabelaParcelas] = useState(INITIAL_VALUES.tabelaVisivel)
  const [mostrarTabelaBuyout, setMostrarTabelaBuyout] = useState(INITIAL_VALUES.tabelaVisivel)
  const [gerandoTabelaTransferencia, setGerandoTabelaTransferencia] = useState(false)
  const [mostrarTabelaParcelasConfig, setMostrarTabelaParcelasConfig] = useState(
    INITIAL_VALUES.tabelaVisivel,
  )
  const [mostrarTabelaBuyoutConfig, setMostrarTabelaBuyoutConfig] = useState(
    INITIAL_VALUES.tabelaVisivel,
  )

  return {
    jurosFinAa,
    setJurosFinAa,
    prazoFinMeses,
    setPrazoFinMeses,
    entradaFinPct,
    setEntradaFinPct,
    mostrarFinanciamento,
    setMostrarFinanciamento,
    mostrarGrafico,
    setMostrarGrafico,
    prazoMeses,
    setPrazoMeses,
    bandeiraEncargo,
    setBandeiraEncargo,
    cipEncargo,
    setCipEncargo,
    entradaRs,
    setEntradaRs,
    entradaModo,
    setEntradaModo,
    mostrarValorMercadoLeasing,
    setMostrarValorMercadoLeasing,
    mostrarTabelaParcelas,
    setMostrarTabelaParcelas,
    mostrarTabelaBuyout,
    setMostrarTabelaBuyout,
    gerandoTabelaTransferencia,
    setGerandoTabelaTransferencia,
    mostrarTabelaParcelasConfig,
    setMostrarTabelaParcelasConfig,
    mostrarTabelaBuyoutConfig,
    setMostrarTabelaBuyoutConfig,
  }
}
