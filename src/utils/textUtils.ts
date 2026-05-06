export const normalizeText = (value: string | null | undefined): string =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** Remove acentuação, converte para minúsculas e aplica trim. */
export const normalizeCidade = (value: string): string => normalizeText(value).trim()
