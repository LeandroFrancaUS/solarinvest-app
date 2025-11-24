import axios from "axios";
import FormData from "form-data";
import { env, isOcrConfigured } from "../config/env.js";
import { logConfigWarnings } from "../config/env.js";

export async function runExternalOcr(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  if (!isOcrConfigured()) {
    logConfigWarnings();
    return "FATURA EDP GO 01/2024 CONSUMO 2500 kWh TARIFA 1,10 CIP 12,50 BANDEIRA 0";
  }

  const form = new FormData();
  form.append("file", fileBuffer, { filename: fileName, contentType: mimeType });

  try {
    const response = await axios.post(env.ocr.url, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${env.ocr.apiKey}`
      },
      timeout: env.ocr.timeoutMs
    });

    if (!response.data) {
      throw new Error("Resposta vazia do OCR");
    }

    if (typeof response.data === "string") {
      return response.data;
    }

    if (response.data.text) {
      return response.data.text as string;
    }

    throw new Error("Formato de resposta inesperado do OCR");
  } catch (error) {
    console.error("Falha ao conectar ao OCR externo", error);
    throw new Error("Falha ao conectar ao OCR externo");
  }
}
