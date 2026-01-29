import dotenv from "dotenv";

dotenv.config();

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: toNumber(process.env.PORT, 3001),
  ocr: {
    url: process.env.OCR_API_URL || "",
    apiKey: process.env.OCR_API_KEY || "",
    timeoutMs: toNumber(process.env.OCR_API_TIMEOUT_MS, 30000)
  },
  defaults: {
    uf: process.env.BILLING_DEFAULT_UF || "GO",
    distribuidora: process.env.BILLING_DEFAULT_DISTRIBUIDORA || "EQUATORIAL GO"
  }
};

export function isOcrConfigured(): boolean {
  return Boolean(env.ocr.url && env.ocr.apiKey);
}

export function logConfigWarnings(): void {
  if (!isOcrConfigured()) {
    console.warn("OCR externo não configurado — retornando texto simulado para desenvolvimento");
  }
}
