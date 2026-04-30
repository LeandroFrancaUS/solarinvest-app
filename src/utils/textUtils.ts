export const normalizeText = (value: string | null | undefined): string =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
