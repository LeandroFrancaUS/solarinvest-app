export type MultiUcClasse =
  | 'B1_Residencial'
  | 'B2_Rural'
  | 'B3_Comercial'
  | 'B4_Iluminacao'

export type MultiUcTarifa = {
  TE: number
  TUSD_total: number
  TUSD_FioB: number
}

export const MULTI_UC_CLASSES: readonly MultiUcClasse[] = [
  'B1_Residencial',
  'B2_Rural',
  'B3_Comercial',
  'B4_Iluminacao',
] as const

export const MULTI_UC_CLASS_LABELS: Record<MultiUcClasse, string> = {
  B1_Residencial: 'B1 — Residencial',
  B2_Rural: 'B2 — Rural',
  B3_Comercial: 'B3 — Comercial',
  B4_Iluminacao: 'B4 — Iluminação pública',
}
