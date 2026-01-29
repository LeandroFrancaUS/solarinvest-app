import { RawInvoiceData } from "../engine/types.js";
import { parseBrNumber } from "../utils/brNumber.js";

function extractMesReferencia(text: string): string | null {
  const monthMap: Record<string, string> = {
    jan: "01",
    fev: "02",
    mar: "03",
    abr: "04",
    mai: "05",
    jun: "06",
    jul: "07",
    ago: "08",
    set: "09",
    out: "10",
    nov: "11",
    dez: "12"
  };
  const monthRegex = /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[\/\-]?\s?(20\d{2})/i;
  const numeric = /(0?[1-9]|1[0-2])[\/\\\-](20\d{2})/;
  const monthMatch = text.match(monthRegex);
  if (monthMatch) {
    const month = monthMap[monthMatch[1].toLowerCase()];
    return `${monthMatch[2]}-${month}`;
  }
  const numericMatch = text.match(numeric);
  if (numericMatch) {
    const [, m, y] = numericMatch;
    const month = m.padStart(2, "0");
    return `${y}-${month}`;
  }
  return null;
}

function findNumberAfter(label: RegExp, text: string): number | null {
  const regex = new RegExp(`${label.source}[^0-9]*([0-9.,]+)`, "i");
  const match = text.match(regex);
  if (match) {
    return parseBrNumber(match[1]);
  }
  return null;
}

export function parseEnergyInvoice(ocrText: string): RawInvoiceData {
  const normalized = ocrText.replace(/\s+/g, " ").trim();
  const upper = normalized.toUpperCase();

  const distribuidoraMatch = upper.match(/EQUATORIAL|ENEL|NORTE FLUMINENSE|CEB|CEEE/);
  const ufMatch = upper.match(/\b(AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);

  const raw: RawInvoiceData = {
    distribuidora: distribuidoraMatch ? distribuidoraMatch[0] : null,
    uf: ufMatch ? ufMatch[0] : null,
    mesReferencia: extractMesReferencia(upper),
    numeroCliente: null,
    numeroInstalacao: null,
    numeroContaContrato: null,
    consumoKWh: findNumberAfter(/CONSUMO|ENERGIA EL[AÉ]TRICA/, upper),
    energiaCompensadaKWh: findNumberAfter(/ENERGIA COMPENSADA|CR[EÉ]DITO/, upper),
    creditosAnterioresKWh: findNumberAfter(/CR[EÉ]DITO\s+ANT/, upper),
    creditosAtuaisKWh: findNumberAfter(/CR[EÉ]DITO\s+ATUAL/, upper),
    tarifaCheiaRSKWh: findNumberAfter(/TARIFA|TUSD|TE/, upper),
    tarifaPisoComDescontoRSKWh: findNumberAfter(/TARIFA\s+DESCONTO|PISO/, upper),
    valorCIP: findNumberAfter(/CIP|ILUMINA[CÇ][AÃ]O P[UÚ]BLICA/, upper),
    valorBandeira: findNumberAfter(/BANDEIRA/, upper),
    outrosEncargos: findNumberAfter(/ENCARGOS|TAXAS/, upper),
    nomeTitular: null,
    enderecoInstalacao: null,
    numeroUC: null
  };

  return raw;
}
