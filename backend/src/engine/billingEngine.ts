import { env } from "../config/env.js";
import { BillingInput, BillingItem, BillingMeta, BillingResult } from "./types.js";

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function createItem(codigo: string, descricao: string, valor: number, incluido: boolean): BillingItem {
  return {
    codigo,
    descricao,
    valor: Number(valor.toFixed(2)),
    incluidoNaCobranca: incluido
  };
}

export function calcularFaturaSolarInvest(input: BillingInput): BillingResult {
  const { rawInvoice, contrato } = input;
  const consumo = safeNumber(rawInvoice.consumoKWh, NaN);
  if (Number.isNaN(consumo)) {
    throw new Error("Consumo não informado na fatura. Não é possível calcular.");
  }

  const kc = safeNumber(contrato.kcEnergiaContratadaKWh);
  const desconto = contrato.descontoPercentual || 0;
  const tarifaCheia = safeNumber(rawInvoice.tarifaCheiaRSKWh, 0.98);
  const tarifaComDesconto = safeNumber(rawInvoice.tarifaPisoComDescontoRSKWh, tarifaCheia * (1 - desconto));
  const creditos = safeNumber(rawInvoice.creditosAnterioresKWh) + safeNumber(rawInvoice.creditosAtuaisKWh);
  const energiaCompensada = safeNumber(rawInvoice.energiaCompensadaKWh);

  const excedenteKWh = Math.max(consumo - kc - creditos + energiaCompensada, 0);
  const pisoValor = kc * tarifaComDesconto;
  const excedenteValor = excedenteKWh * tarifaCheia;

  const itens: BillingItem[] = [
    createItem("PISO", `Energia contratada (${kc} kWh) x Tarifa Piso`, pisoValor, true),
    createItem("EXCEDENTE", `Excedente (${excedenteKWh.toFixed(0)} kWh) x Tarifa Cheia`, excedenteValor, excedenteKWh > 0)
  ];

  if (contrato.incluirCIPNaCobranca) {
    itens.push(createItem("CIP", "Contribuição de Iluminação Pública", safeNumber(rawInvoice.valorCIP), true));
  }
  if (contrato.incluirBandeiraNaCobranca) {
    itens.push(createItem("BANDEIRA", "Bandeira tarifária", safeNumber(rawInvoice.valorBandeira), true));
  }
  if (contrato.incluirOutrosEncargosNaCobranca) {
    itens.push(createItem("ENCARGOS", "Outros encargos", safeNumber(rawInvoice.outrosEncargos), true));
  }

  const totalAPagarRS = Number(
    itens.filter((i) => i.incluidoNaCobranca).reduce((sum, i) => sum + i.valor, 0).toFixed(2)
  );

  const meta: BillingMeta = {
    uf: rawInvoice.uf || env.defaults.uf,
    distribuidora: rawInvoice.distribuidora || env.defaults.distribuidora,
    mesReferencia: rawInvoice.mesReferencia || "N/D",
    idContrato: contrato.idContrato,
    dataCalculoISO: new Date().toISOString(),
    versaoRegra: "ENGINE-v1"
  };

  const resumoTextoExplicativo = `Cálculo com base em Kc=${kc} kWh, consumo real ${consumo} kWh, créditos ${creditos} kWh, tarifa piso R$ ${tarifaComDesconto.toFixed(2)}/kWh e tarifa excedente R$ ${tarifaCheia.toFixed(2)}/kWh.`;

  return {
    totalAPagarRS,
    itens,
    resumoTextoExplicativo,
    meta
  };
}
