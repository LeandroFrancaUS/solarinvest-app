import { createStore } from '../../store/createStore'

export type ProjetoTipo = 'venda' | 'leasing'

export type ProjetoStatusLeasing =
  | 'proposta_emitida'
  | 'contrato_emitido'
  | 'contrato_assinado'
  | 'validacao_documental'
  | 'validacao_viabilidade'
  | 'aprovado'
  | 'ativo'
  | 'desativado'
  | 'cancelado'

export type ProjetoStatusVenda =
  | 'proposta_emitida'
  | 'contrato_assinado'
  | 'aprovado'
  | 'concluido'
  | 'cancelado'

export type ProjetoStatus = ProjetoStatusLeasing | ProjetoStatusVenda

export type ComissaoStatus =
  | 'nao_elegivel'
  | 'adiantamento_disponivel'
  | 'adiantamento_pago'
  | 'parcial_pago'
  | 'pago'
  | 'estornado'

export type ComissaoParcela = {
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
  parcelas: ComissaoParcela[]
}

export type AprovacaoItem = {
  obrigatorio: boolean
  aprovado: boolean
}

export type AprovacaoDocumental = {
  comprovacaoRenda: AprovacaoItem
  analiseCreditoSerasa: AprovacaoItem
  faturasDistribuidoraSemAtraso: AprovacaoItem
}

export type AprovacaoViabilidade = {
  areaInstalacaoCompativel: AprovacaoItem
  padraoRelogioAprovadoEngenharia: AprovacaoItem
}

export type Projeto = {
  id: string
  tipo: ProjetoTipo
  status: ProjetoStatus
  /**
   * True when this project has been successfully persisted in the backend.
   * Absence or false means the project is local-only and cannot open ProjectDetailPage.
   */
  persisted?: boolean
  /**
   * True when this project was intentionally kept local (no backend client linked,
   * or no serverClientId at conversion time). Complementary to persisted.
   */
  localOnly?: boolean
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
  aprovacaoDocumental?: AprovacaoDocumental
  aprovacaoViabilidade?: AprovacaoViabilidade
  pagamento?: {
    modalidade?: 'avista' | 'parcelado'
  }
  createdAt: string
}

export interface ProjectState {
  projetos: Projeto[]
}

export interface ProjectActions {
  addProjeto: (projeto: Projeto) => void
  updateProjeto: (id: string, patch: Partial<Projeto>) => void
  removeProjeto: (id: string) => void
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
  removeProjeto: (id) =>
    set({ projetos: get().projetos.filter((p) => p.id !== id) }),
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
export const selectRemoveProjeto = (s: ProjectStore) => s.removeProjeto

// Automation helpers — prepared for future use, not yet used to block UI
export function isDocumentacaoAprovada(projeto: Projeto): boolean {
  const doc = projeto.aprovacaoDocumental
  if (!doc) return false
  return Object.values(doc).every((item) => !item.obrigatorio || item.aprovado)
}

export function isViabilidadeAprovada(projeto: Projeto): boolean {
  const via = projeto.aprovacaoViabilidade
  if (!via) return false
  return Object.values(via).every((item) => !item.obrigatorio || item.aprovado)
}
