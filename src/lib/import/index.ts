import { extractCanonicalGrid } from './parsers/generic'

export type ImportedBudgetItem = {
  produto: string
  descricao: string | null
  quantidade: number
  unidade: string | null
}

export type BudgetImportResult = {
  items: ImportedBudgetItem[]
  ignoredByNoise: number
  ignoredByValidation: number
}

export function importBudgetFromLines(lines: string[]): BudgetImportResult {
  const grid = extractCanonicalGrid(lines)
  const items: ImportedBudgetItem[] = grid.rows.map((row) => ({
    produto: row.produto,
    descricao: row.descricao,
    quantidade: row.quantidade ?? 0,
    unidade: row.unidade,
  }))

  return {
    items,
    ignoredByNoise: grid.ignoredByNoise,
    ignoredByValidation: grid.ignoredByValidation,
  }
}
