const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export const formatCurrency = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? currencyFormatter.format(value) : null

export const formatNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : null

export const formatPercent = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? percentFormatter.format(value) : null
