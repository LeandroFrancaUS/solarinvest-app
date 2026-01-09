import type { RequiredClientField } from './validateRequiredFields'
import {
  buildRequiredFieldsBase,
  type RequiredFieldsInput,
} from './buildRequiredFieldsVenda'

export const buildRequiredFieldsLeasing = (
  input: RequiredFieldsInput,
): RequiredClientField[] => buildRequiredFieldsBase(input)
