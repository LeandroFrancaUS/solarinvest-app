// SolarInvest — Composição da UFV (Leasing/Venda)
// Cálculo de CAPEX, Venda, Comissão, Impostos (retidos e por regime)
// Suporta flag para incluir impostos no CAPEX

// =========================
// Tipos & Defaults
// =========================

export type ComissaoTipo = "valor" | "percentual";
export type BasePercentualComissao = "venda_total" | "venda_liquida";
export type ArredondarPasso = 1 | 10 | 50 | 100;

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
  teto_comissao_percent?: number; // teto aplicado quando comissão for percentual

  // Margem operacional
  margem_operacional_padrao_percent: number;
  margem_manual_valor?: number | null;
  usar_margem_manual?: boolean;
  valor_total_orcamento?: number;

  // Descontos comerciais
  descontos: number;

  // Guardrails comerciais
  preco_minimo_percent_sobre_capex: number;
  arredondar_venda_para: ArredondarPasso;
  desconto_max_percent_sem_aprovacao: number;
  workflow_aprovacao_ativo: boolean;

  // Impostos
  regime: RegimeTributario;
  imposto_retido_aliquota: number; // %
  impostosRegime?: Partial<ImpostosRegimeConfig>;

  // Flag: somar impostos ao CAPEX
  incluirImpostosNoCAPEX: boolean;
}

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

  // Guardrails
  preco_minimo: number;
  venda_total_sem_guardrails: number;
  preco_minimo_aplicado: boolean;
  arredondamento_aplicado: number;
  desconto_percentual: number;
  desconto_requer_aprovacao: boolean;
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

const clampRange = (valor: number, min: number, max: number): number => {
  if (!Number.isFinite(valor)) {
    return min;
  }
  if (valor < min) return min;
  if (valor > max) return max;
  return valor;
};

const arredondarValor = (valor: number, passo: ArredondarPasso): number => {
  if (!Number.isFinite(valor) || passo <= 0) {
    return 0;
  }
  return Math.round(valor / passo) * passo;
};

export function calcularComposicaoUFV(i: Inputs): Outputs {
  const capex_base =
    nz(i.projeto) + nz(i.instalacao) + nz(i.material_ca) + nz(i.crea) + nz(i.art) + nz(i.placa);

  const descontos = Math.max(0, nz(i.descontos));
  const margemPercent = clampRange(i.margem_operacional_padrao_percent ?? 0, 0, 80);
  const margemManualInformada = Number.isFinite(i.margem_manual_valor ?? Number.NaN)
    ? Number(i.margem_manual_valor)
    : 0;
  const margemManualAtiva = Boolean(i.usar_margem_manual) &&
    Number.isFinite(i.margem_manual_valor ?? Number.NaN);
  const valorOrcamentoTotal = Math.max(0, nz(i.valor_total_orcamento ?? 0));
  const margemBaseValor = margemManualAtiva
    ? margemManualInformada
    : (capex_base + valorOrcamentoTotal) * (margemPercent / 100);

  let venda_total_base = 0;
  let venda_liquida_base = 0;
  let comissao_liquida_base = 0;
  let comissaoPercentual = 0;

  if (i.comissao_tipo === 'percentual') {
    const teto = clampRange(i.teto_comissao_percent ?? 100, 0, 100);
    const comissaoFracInput = pct(i.comissao_liquida_input);
    const tetoFrac = pct(teto);
    const comissaoFrac = teto < 100 ? Math.min(comissaoFracInput, tetoFrac) : comissaoFracInput;
    const base = capex_base + margemBaseValor;
    const divisor = Math.max(1 - comissaoFrac, 0.000001);

    if (i.comissao_percent_base === 'venda_total') {
      venda_total_base = base / divisor;
      comissao_liquida_base = venda_total_base * comissaoFrac;
      venda_liquida_base = Math.max(venda_total_base - descontos, 0);
    } else {
      venda_total_base = (base + comissaoFrac * descontos) / divisor;
      venda_liquida_base = Math.max(venda_total_base - descontos, 0);
      comissao_liquida_base = venda_liquida_base * comissaoFrac;
    }

    comissaoPercentual = comissaoFrac;
  } else {
    comissao_liquida_base = Math.max(0, nz(i.comissao_liquida_input));
    venda_total_base = capex_base + margemBaseValor + comissao_liquida_base;
    venda_liquida_base = Math.max(venda_total_base - descontos, 0);
  }

  const precoMinPercent = clampRange(i.preco_minimo_percent_sobre_capex ?? 0, 0, 100);
  const preco_minimo = capex_base * (1 + precoMinPercent / 100);
  const venda_pos_minimo = Math.max(venda_total_base, preco_minimo);
  const passoArredondamento = i.arredondar_venda_para ?? 100;
  let venda_total = arredondarValor(venda_pos_minimo, passoArredondamento);
  if (venda_total < preco_minimo) {
    venda_total = Math.ceil(preco_minimo / passoArredondamento) * passoArredondamento;
  }

  const venda_total_sem_guardrails = venda_total_base;
  const preco_minimo_aplicado = venda_total_base < preco_minimo - 0.0001;
  const arredondamento_aplicado = venda_total - venda_pos_minimo;

  let comissao_liquida_valor = 0;
  let venda_liquida = Math.max(venda_total - descontos, 0);
  let margem_operacional_valor = margemManualAtiva ? margemManualInformada : 0;

  if (i.comissao_tipo === 'percentual') {
    const frac = Math.max(0, Math.min(1, comissaoPercentual));
    if (i.comissao_percent_base === 'venda_total') {
      comissao_liquida_valor = venda_total * frac;
      venda_liquida = Math.max(venda_total - descontos, 0);
      if (!margemManualAtiva) {
        margem_operacional_valor = Math.max(venda_total * (1 - frac) - capex_base, 0);
      }
    } else {
      venda_liquida = Math.max(venda_total - descontos, 0);
      comissao_liquida_valor = venda_liquida * frac;
      if (!margemManualAtiva) {
        margem_operacional_valor = Math.max(
          venda_total * (1 - frac) - capex_base - frac * descontos,
          0,
        );
      }
    }
  } else {
    comissao_liquida_valor = comissao_liquida_base;
    if (!margemManualAtiva) {
      margem_operacional_valor = Math.max(venda_total - capex_base - comissao_liquida_valor, 0);
    }
  }

  const imposto_retido_valor = venda_total * pct(i.imposto_retido_aliquota);
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

  const impostos_totais_valor = imposto_retido_valor + impostos_regime_valor;
  const capex_total = i.incluirImpostosNoCAPEX ? capex_base + impostos_totais_valor : capex_base;
  const total_contrato_R$ = venda_total;

  const desconto_percentual = venda_total > 0 ? (descontos / venda_total) * 100 : 0;
  const desconto_requer_aprovacao = Boolean(i.workflow_aprovacao_ativo) &&
    desconto_percentual > clampRange(i.desconto_max_percent_sem_aprovacao ?? 0, 0, 100);

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

    preco_minimo,
    venda_total_sem_guardrails,
    preco_minimo_aplicado,
    arredondamento_aplicado,
    desconto_percentual,
    desconto_requer_aprovacao,
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
  teto_comissao_percent: 8,

  margem_operacional_padrao_percent: 29,
  margem_manual_valor: 0,
  usar_margem_manual: false,
  valor_total_orcamento: 0,

  descontos: 0,
  preco_minimo_percent_sobre_capex: 10,
  arredondar_venda_para: 100,
  desconto_max_percent_sem_aprovacao: 5,
  workflow_aprovacao_ativo: true,

  regime: "lucro_presumido",
  imposto_retido_aliquota: 6,

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
