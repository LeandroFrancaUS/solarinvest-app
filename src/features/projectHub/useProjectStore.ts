import { createStore } from '../../store/createStore'

export type ProjetoTipo = 'venda' | 'leasing'
export type ProjetoStatus = 'aprovado' | 'implantacao' | 'ativo' | 'finalizado' | 'monitoramento'

export type ComissaoStatus =
  | 'nao_elegivel'
  | 'adiantamento_disponivel'
  | 'adiantamento_pago'
  | 'parcial_pago'
  | 'pago'
  | 'estornado'

export type ParcelaComissao = {
  descricao: string
  percentual: number
  valor: number
  gatilho: string
  pago: boolean
  pagoEm?: string
}

export type ComissaoConsultor = {
  regra: 'leasing' | 'venda'
  valorTotalEstimado: number
  valorPago: number
  status: ComissaoStatus
  parcelas: ParcelaComissao[]
}

export type Projeto = {
  id: string
  tipo: ProjetoTipo
  status: ProjetoStatus
  cliente: {
    nome: string
  }
  financeiro: {
    valorContrato: number
    custoTotal: number
    margem: number
    mensalidade?: number
  }
  consultor?: {
    id?: string
    nome: string
  }
  comissaoConsultor?: ComissaoConsultor
  createdAt: string
}

export interface ProjectState {
  projetos: Projeto[]
}

export interface ProjectActions {
  addProjeto: (projeto: Projeto) => void
  updateProjeto: (id: string, patch: Partial<Projeto>) => void
  setProjetos: (lista: Projeto[]) => void
  reset: () => void
}

export type ProjectStore = ProjectState & ProjectActions

const PROJECT_DEFAULTS: ProjectState = {
  projetos: [],
}

export const useProjectStore = createStore<ProjectStore>((set, get) => ({
  ...PROJECT_DEFAULTS,
  addProjeto: (projeto) =>
    set({ projetos: [...get().projetos, projeto] }),
  updateProjeto: (id, patch) =>
    set({
      projetos: get().projetos.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }),
  setProjetos: (lista) => set({ projetos: lista }),
  reset: () => set({ ...PROJECT_DEFAULTS }),
}))

// State selectors
export const selectProjetos = (s: ProjectStore) => s.projetos
export const selectProjetoById =
  (id: string) =>
  (s: ProjectStore): Projeto | undefined =>
    s.projetos.find((p) => p.id === id)

// Action selectors
export const selectAddProjeto = (s: ProjectStore) => s.addProjeto
export const selectUpdateProjeto = (s: ProjectStore) => s.updateProjeto
