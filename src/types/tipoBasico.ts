export type TipoBasicoCliente =
  | 'residencial'
  | 'comercial'
  | 'cond_vertical'
  | 'cond_horizontal'
  | 'industrial'
  | 'outros'

export function normalizeTipoBasico(
  value: string | undefined | null,
): TipoBasicoCliente {
  if (!value) return 'residencial'

  const v = value.toLowerCase()

  if (v === 'residencial') return 'residencial'
  if (v === 'comercial') return 'comercial'
  if (v === 'industrial') return 'industrial'
  if (v === 'cond_vertical' || v === 'cond. vertical' || v === 'condominio_vertical') return 'cond_vertical'
  if (v === 'cond_horizontal' || v === 'cond. horizontal' || v === 'condominio_horizontal')
    return 'cond_horizontal'

  if (v === 'rural') return 'residencial'
  if (v === 'hibrido' || v === 'híbrido' || v === 'híbrida') return 'outros'
  if (v === 'condominio' || v === 'condomínio') return 'cond_vertical'

  return 'outros'
}

export const TIPO_BASICO_LABELS: Record<TipoBasicoCliente, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  cond_vertical: 'Cond. Vertical',
  cond_horizontal: 'Cond. Horizontal',
  industrial: 'Industrial',
  outros: 'Outros',
}

export const TIPO_BASICO_OPTIONS = Object.entries(TIPO_BASICO_LABELS).map(([value, label]) => ({
  value: value as TipoBasicoCliente,
  label,
}))

export const mapTipoBasicoToLabel = (value: string): string => {
  const match = TIPO_BASICO_OPTIONS.find((tipo) => tipo.value === value)
  return match ? match.label : 'Outros'
}
