import type { StructuredItem } from './structuredBudgetParser'

type Classification = 'module' | 'inverter'

type AnalyzableItem = {
  id?: string
  product?: string | null
  description?: string | null
  quantity?: number | null
  extra?: string | null
}

export type EssentialCategoryInfo = {
  hasAny: boolean
  hasProduct: boolean
  hasDescription: boolean
  hasQuantity: boolean
  missingFields: string[]
  firstMissingId?: string
}

export type EssentialInfoSummary = {
  modules: EssentialCategoryInfo
  inverter: EssentialCategoryInfo
}

const normalize = (value: string | null | undefined): string =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()

const classifyNormalized = (normalized: string): Classification | null => {
  if (!normalized) {
    return null
  }
  if (normalized.includes('INVERSOR')) {
    return 'inverter'
  }
  if (normalized.includes('MODULO') && !normalized.includes('ESTRUTURA')) {
    return 'module'
  }
  return null
}

const buildNormalizedText = (item: AnalyzableItem): string =>
  normalize(`${item.product ?? ''} ${item.description ?? ''} ${item.extra ?? ''}`)

const createEmptyCategory = (): EssentialCategoryInfo => ({
  hasAny: false,
  hasProduct: false,
  hasDescription: false,
  hasQuantity: false,
  missingFields: [],
  firstMissingId: undefined,
})

const hasText = (value: string | null | undefined): boolean => {
  const trimmed = value?.toString().trim() ?? ''
  return trimmed.length > 0 && trimmed !== '—'
}

const isPositiveQuantity = (value: number | null | undefined): boolean => {
  if (!Number.isFinite(value as number)) {
    return false
  }
  return Number(value) > 0
}

export const classifyBudgetItem = (item: AnalyzableItem): Classification | null =>
  classifyNormalized(buildNormalizedText(item))

export const sumModuleQuantities = (structured: StructuredItem[]): number => {
  let total = 0
  structured.forEach((item) => {
    const classification = classifyBudgetItem({
      product: item.produto,
      description: item.descricao,
      quantity: item.quantidade ?? null,
      extra: `${item.modelo ?? ''} ${item.fabricante ?? ''}`,
    })
    if (classification !== 'module') {
      return
    }
    const quantity = Number.isFinite(item.quantidade) ? Math.round(Number(item.quantidade)) : NaN
    if (Number.isFinite(quantity) && quantity > 0) {
      total += quantity
    }
  })
  return total
}

export const analyzeEssentialInfo = (items: AnalyzableItem[]): EssentialInfoSummary => {
  const modules = createEmptyCategory()
  const inverter = createEmptyCategory()

  items.forEach((item) => {
    const classification = classifyBudgetItem(item)
    if (!classification) {
      return
    }
    const bucket = classification === 'module' ? modules : inverter
    bucket.hasAny = true

    const productOk = hasText(item.product)
    const descriptionOk = hasText(item.description)
    const quantityOk = isPositiveQuantity(item.quantity)

    if (productOk) {
      bucket.hasProduct = true
    } else {
      bucket.missingFields.push('produto')
      if (!bucket.firstMissingId && item.id) {
        bucket.firstMissingId = item.id
      }
    }

    if (descriptionOk) {
      bucket.hasDescription = true
    } else {
      bucket.missingFields.push('descrição')
      if (!bucket.firstMissingId && item.id) {
        bucket.firstMissingId = item.id
      }
    }

    if (quantityOk) {
      bucket.hasQuantity = true
    } else {
      bucket.missingFields.push('quantidade')
      if (!bucket.firstMissingId && item.id) {
        bucket.firstMissingId = item.id
      }
    }
  })

  const finalizeCategory = (category: EssentialCategoryInfo) => {
    if (!category.hasAny) {
      category.missingFields = ['produto', 'descrição', 'quantidade']
    } else {
      const uniqueMissing = Array.from(new Set(category.missingFields))
      category.missingFields = uniqueMissing
    }
  }

  finalizeCategory(modules)
  finalizeCategory(inverter)

  return { modules, inverter }
}

