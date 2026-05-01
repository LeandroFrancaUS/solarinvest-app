export type FinancialAnalysisMode = 'venda' | 'leasing'

export interface SavedFinancialAnalysis {
  id: string
  client_id?: string | null
  analysis_name: string
  mode: FinancialAnalysisMode
  payload_json: unknown
  created_by_user_id?: string | null
  created_at: string
}

export interface SaveFinancialAnalysisInput {
  client_id?: string | null
  analysis_name: string
  mode: FinancialAnalysisMode
  payload: unknown
}

export async function listFinancialAnalyses(): Promise<SavedFinancialAnalysis[]> {
  const res = await fetch('/api/financial-analyses')
  if (!res.ok) throw new Error('Falha ao carregar análises salvas')
  const json = (await res.json()) as { data?: SavedFinancialAnalysis[] }
  return Array.isArray(json.data) ? json.data : []
}

export async function saveFinancialAnalysis(input: SaveFinancialAnalysisInput): Promise<SavedFinancialAnalysis> {
  const res = await fetch('/api/financial-analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Falha ao salvar análise financeira')
  }
  const json = (await res.json()) as { data: SavedFinancialAnalysis }
  return json.data
}
