import type { RequiredClientField } from './validateRequiredFields'
import {
  buildRequiredFieldsBase,
  type RequiredFieldsInput,
} from './buildRequiredFieldsVenda'
import { buildRequiredFieldsLeasingProposta } from './buildRequiredFieldsLeasingProposta'

export const buildRequiredFieldsLeasing = (
  input: RequiredFieldsInput,
): RequiredClientField[] => buildRequiredFieldsBase(input)

export { buildRequiredFieldsLeasingProposta }
