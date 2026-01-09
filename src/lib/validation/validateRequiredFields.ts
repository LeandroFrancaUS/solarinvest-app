export type RequiredClientField = {
  key: string
  label: string
  selector: string
  getValue: () => unknown
}

export function normalizeText(v: unknown): string {
  return String(v ?? '').trim()
}

export function isMissing(v: unknown): boolean {
  return normalizeText(v) === ''
}

export function validateRequiredFields(fields: RequiredClientField[]) {
  const missing = fields.filter((field) => isMissing(field.getValue()))
  return {
    ok: missing.length === 0,
    missingKeys: missing.map((field) => field.key),
    missingSelectors: missing.map((field) => field.selector),
    missingLabels: missing.map((field) => field.label),
  }
}
