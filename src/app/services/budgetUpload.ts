import {
  handleUpload,
  type BudgetUploadResult,
  type HandleUploadOptions,
  type BudgetUploadProgress,
  BudgetUploadError,
  MAX_FILE_SIZE_BYTES,
  DEFAULT_OCR_DPI,
} from '../../lib/budget/budgetUploadPipeline'

export type { BudgetUploadResult, HandleUploadOptions, BudgetUploadProgress }
export { BudgetUploadError, MAX_FILE_SIZE_BYTES, DEFAULT_OCR_DPI }

export async function uploadBudgetFile(
  file: File,
  options: HandleUploadOptions = {},
): Promise<BudgetUploadResult> {
  return handleUpload(file, options)
}
