// SolarInvest — Composição da UFV (Leasing/Venda)
// Cálculo de CAPEX, Venda, Comissão, Impostos (retidos e por regime)
// Suporta flag para incluir impostos no CAPEX

// =========================
// Tipos & Defaults
// =========================

export type ComissaoTipo = "valor" | "percentual";
export type BasePercentualComissao = "venda_total" | "venda_liquida";

// Observação: "ME" e "LTDA" são naturezas jurídicas;
// tributariamente, normalmente caem em Simples, Presumido ou Real.
// Mantemos enum de regimes para cálculo.
export type RegimeTributario = "simples" | "lucro_presumido" | "lucro_real";

export interface Inputs {
  // Custos diretos
  projeto: number;
  instalacao: number;
  material_ca: number;
  crea: number;
  art: number;
  placa: number;

  // Comissão
  comissao_liquida_input: number; // valor em R$ ou % (conforme tipo)
  comissao_tipo: ComissaoTipo;
  comissao_percent_base: BasePercentualComissao;

  // Margem operacional
  margem_operacional: number; // valor em R$ ou % (conforme tipo)
  margem_tipo: "valor" | "percentual";

  // Descontos comerciais
  descontos: number;

  // Impostos
  regime: RegimeTributario;
  // Imposto retido na fonte (ex.: IRRF/ISS/INSS retido pelo tomador)
  imposto_retido_aliquota: number; // %

  // Parametrização de regime (opcional; se não vier, usamos defaults abaixo)
  impostosRegime?: Partial<ImpostosRegimeConfig>;

  // Flag: somar impostos ao CAPEX
  incluirImpostosNoCAPEX: boolean;
}

export type MargemTipo = Inputs["margem_tipo"];

export interface Outputs {
  capex_base: number;
  margem_operacional_valor: number;

  venda_total: number;
  venda_liquida: number;

  comissao_liquida_valor: number;

  // Impostos
  imposto_retido_valor: number;      // Retenção na fonte sobre a venda_total
  impostos_regime_valor: number;     // Soma dos componentes do regime tributário
  impostos_totais_valor: number;     // retido + regime

  capex_total: number;               // CAPEX final (com ou sem impostos, conforme flag)
  total_contrato_R$: number;         // venda_total (mantemos separado para clareza)

  // Quebra por componentes do regime (para exibir)
  regime_breakdown: Array<{ nome: string; aliquota: number; valor: number }>;
}

// =========================
// Tabela paramétrica de impostos por regime (defaults)
// =========================
//
// Todos os percentuais abaixo são "efetivos sobre a receita (venda_total)"
// e servem como ponto de partida. Ajuste com seu contador/CNAE/município.
// - SIMPLES: alíquota nominal varia por anexo/faixa; usamos 6% como default.
// - PRESUMIDO: valores típicos (serviços gerais, sem ICMS). Ajuste ISS (ex.: 2%-5%).
// - REAL: exemplo de efetivo sobre receita (desonerado pode variar MUITO).
//
// Importante: ISS é municipal; PIS/COFINS mudam por cumulatividade;
// IRPJ/CSLL dependem de base e adicional. Trate estes como presets flexíveis.

export interface ImpostosRegimeConfig {
  simples: RegimeComponent[];
  lucro_presumido: RegimeComponent[];
  lucro_real: RegimeComponent[];
}

export interface RegimeComponent {
  nome: string;
  aliquota_percent: number; // % efetivo sobre venda_total
}

export const DEFAULT_IMPOSTOS_REGIME: ImpostosRegimeConfig = {
  simples: [
    { nome: "SIMPLIS_Total", aliquota_percent: 6.0 }, // ajuste por anexo/faixa
  ],
  lucro_presumido: [
    { nome: "ISS",      aliquota_percent: 3.0 },  // ajustar por município (2–5%)
    { nome: "PIS",      aliquota_percent: 0.65 },
    { nome: "COFINS",   aliquota_percent: 3.00 },
    // IRPJ/CSLL (efetivo aproximado sobre a RECEITA, já considerando presunções)
    { nome: "IRPJ",     aliquota_percent: 1.20 }, // ex. ~1.2% efetivo
    { nome: "CSLL",     aliquota_percent: 1.08 }, // ex. ~1.08% efetivo
  ],
  lucro_real: [
    // Exemplo de efetivos sobre receita; no Real a base é LUCRO, então trate como proxy.
    { nome: "PIS",      aliquota_percent: 1.65 },
    { nome: "COFINS",   aliquota_percent: 7.60 },
    { nome: "ISS",      aliquota_percent: 3.0 },  // ajustar por município
    // IRPJ/CSLL no Real dependem do lucro; aqui um proxy ilustrativo baixo:
    { nome: "IRPJ+CSLL_Efetivo", aliquota_percent: 2.0 },
  ],
};

// =========================
// Utilitários
// =========================

const nz = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const pct = (p: number) => Math.max(nz(p), 0) / 100;

function mergeImpostosRegime(
  base: ImpostosRegimeConfig,
  overrides?: Partial<ImpostosRegimeConfig>
): ImpostosRegimeConfig {
  if (!overrides) return base;
  const clone = structuredClone(base);
  for (const k of ["simples", "lucro_presumido", "lucro_real"] as const) {
    if (overrides[k]?.length) clone[k] = overrides[k]!;
  }
  return clone;
}

// =========================
// Núcleo do cálculo
// =========================

export function calcularComposicaoUFV(i: Inputs): Outputs {
  // 1) CAPEX Base
  const capex_base =
    nz(i.projeto) +
    nz(i.instalacao) +
    nz(i.material_ca) +
    nz(i.crea) +
    nz(i.art) +
    nz(i.placa);

  // 2) Margem operacional (valor)
  const margem_operacional_valor =
    i.margem_tipo === "percentual"
      ? capex_base * pct(i.margem_operacional)
      : nz(i.margem_operacional);

  // 3) Comissão (trata circularidade quando %)
  const descontos = nz(i.descontos);
  let venda_total: number;
  let venda_liquida: number;
  let comissao_liquida_valor: number;

  if (i.comissao_tipo === "percentual") {
    const c = pct(i.comissao_liquida_input);
    const P = capex_base + margem_operacional_valor;

    if (i.comissao_percent_base === "venda_total") {
      // venda_total = P / (1 - c)
      venda_total = P / (1 - c);
      comissao_liquida_valor = venda_total * c;
      venda_liquida = Math.max(venda_total - descontos, 0);
    } else {
      // base = venda_liquida
      // venda_total = (P + c*d) / (1 - c)
      venda_total = (P + c * descontos) / (1 - c);
      venda_liquida = Math.max(venda_total - descontos, 0);
      comissao_liquida_valor = c * venda_liquida;
    }
  } else {
    // comissão valor fixo
    comissao_liquida_valor = nz(i.comissao_liquida_input);
    venda_total = capex_base + margem_operacional_valor + comissao_liquida_valor;
    venda_liquida = Math.max(venda_total - descontos, 0);
  }

  // 4) Impostos — Retido na fonte
  const imposto_retido_valor = venda_total * pct(i.imposto_retido_aliquota);

  // 5) Impostos por Regime
  const tabelaRegime = mergeImpostosRegime(DEFAULT_IMPOSTOS_REGIME, i.impostosRegime);
  const componentes: RegimeComponent[] = tabelaRegime[i.regime];

  let impostos_regime_valor = 0;
  const regime_breakdown: Array<{ nome: string; aliquota: number; valor: number }> = [];

  for (const comp of componentes) {
    const aliq = Math.max(nz(comp.aliquota_percent), 0);
    const valor = venda_total * (aliq / 100);
    impostos_regime_valor += valor;
    regime_breakdown.push({ nome: comp.nome, aliquota: aliq, valor });
  }

  // 6) Impostos totais
  const impostos_totais_valor = imposto_retido_valor + impostos_regime_valor;

  // 7) CAPEX Total (com ou sem impostos, conforme flag)
  const capex_total = i.incluirImpostosNoCAPEX
    ? capex_base + impostos_totais_valor
    : capex_base;

  // 8) Total do contrato (mantemos venda_total como preço bruto antes de descontos)
  const total_contrato_R$ = venda_total;

  return {
    capex_base,
    margem_operacional_valor,

    venda_total,
    venda_liquida,

    comissao_liquida_valor,

    imposto_retido_valor,
    impostos_regime_valor,
    impostos_totais_valor,

    capex_total,
    total_contrato_R$,

    regime_breakdown,
  };
}

// =========================
// Exemplo de uso
// =========================
/*
const out = calcularComposicaoUFV({
  projeto: 3000,
  instalacao: 7000,
  material_ca: 2500,
  crea: 450,
  art: 350,
  placa: 12000,

  comissao_liquida_input: 3,          // 3%
  comissao_tipo: "percentual",
  comissao_percent_base: "venda_total",

  margem_operacional: 20,             // 20% sobre CAPEX base
  margem_tipo: "percentual",

  descontos: 0,

  regime: "lucro_presumido",
  imposto_retido_aliquota: 6,         // 6% retido

  // Sobrescrever defaults (opcional):
  impostosRegime: {
    lucro_presumido: [
      { nome: "ISS",    aliquota_percent: 3.5 },
      { nome: "PIS",    aliquota_percent: 0.65 },
      { nome: "COFINS", aliquota_percent: 3.0 },
      { nome: "IRPJ",   aliquota_percent: 1.2 },
      { nome: "CSLL",   aliquota_percent: 1.08 },
    ],
  },

  incluirImpostosNoCAPEX: true,
});

console.log(out);
*/
