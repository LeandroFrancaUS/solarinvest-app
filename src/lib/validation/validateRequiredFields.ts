export type RequiredClientField = {
  key: string
  label: string
  selector: string
  getValue: () => unknown
}

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

export function isMissing(value: unknown): boolean {
  return normalizeText(value) === ''
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
