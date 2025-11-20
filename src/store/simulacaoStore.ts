import { createStore } from './createStore'
import type { SimulacaoResultado } from '../lib/finance/simulacaoEngineV35'

type SimulacaoBasicaInput = {
  tipoSistema: 'leasing' | 'venda' | 'hibrido' | 'offgrid'
  consumoMensalKwh: number
  tarifaAtual: number
  capex: number
  opexMensal: number
  descontoClientePercent?: number
  prazoAnos: number
}

type SimulacaoRegistro = {
  id: string
  nome: string
  criadaEm: string
  atualizadaEm: string
  dadosEntrada: SimulacaoBasicaInput
  resultado?: SimulacaoResultado
}

type SimulacaoStoreState = {
  simulacoes: SimulacaoRegistro[]
  simulacaoAtual: SimulacaoRegistro | null
  criarSimulacao: (dadosEntrada: SimulacaoBasicaInput, nome?: string) => SimulacaoRegistro
  atualizarSimulacao: (id: string, patch: Partial<SimulacaoRegistro>) => void
  salvarSimulacao: (simulacao: SimulacaoRegistro) => void
  carregarSalvas: () => void
}

const STORAGE_KEY = 'simulacoes-solarinvest-v0'

const persist = (simulacoes: SimulacaoRegistro[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simulacoes))
}

const carregar = (): SimulacaoRegistro[] => {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SimulacaoRegistro[]
  } catch (err) {
    console.error('Erro ao carregar simulações', err)
    return []
  }
}

export const simulacaoStore = createStore<SimulacaoStoreState>((set, get) => ({
  simulacoes: [],
  simulacaoAtual: null,
  criarSimulacao: (dadosEntrada, nome) => {
    const nova: SimulacaoRegistro = {
      id: crypto.randomUUID(),
      nome: nome ?? 'Nova Simulação',
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
      dadosEntrada,
    }
    const proxima = [...get().simulacoes, nova]
    set({ simulacoes: proxima, simulacaoAtual: nova })
    persist(proxima)
    return nova
  },
  atualizarSimulacao: (id, patch) => {
    const proxima = get().simulacoes.map((sim) => (sim.id === id ? { ...sim, ...patch, atualizadaEm: new Date().toISOString() } : sim))
    set({ simulacoes: proxima, simulacaoAtual: proxima.find((s) => s.id === id) ?? null })
    persist(proxima)
  },
  salvarSimulacao: (simulacao) => {
    const existente = get().simulacoes.some((s) => s.id === simulacao.id)
    const proxima = existente
      ? get().simulacoes.map((s) => (s.id === simulacao.id ? simulacao : s))
      : [...get().simulacoes, simulacao]
    set({ simulacoes: proxima, simulacaoAtual: simulacao })
    persist(proxima)
  },
  carregarSalvas: () => {
    const salvas = carregar()
    if (salvas.length) {
      set({ simulacoes: salvas, simulacaoAtual: salvas[salvas.length - 1] })
    }
  },
}))

export type { SimulacaoBasicaInput, SimulacaoRegistro }
