export function parseBrNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatBrNumber(value: number, decimals = 2): string {
  return value
    .toFixed(decimals)
    .replace(/\./g, ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
