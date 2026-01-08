import { isMissing, type ClientFieldKey, type RequiredClientField } from './clientRequiredFields'

export interface ValidationResult {
  ok: boolean
  missingKeys: ClientFieldKey[]
}

export function validateClient(requiredFields: RequiredClientField[]): ValidationResult {
  const missingKeys = requiredFields
    .filter((field) => isMissing(field.getValue()))
    .map((field) => field.key)

  return { ok: missingKeys.length === 0, missingKeys }
}
