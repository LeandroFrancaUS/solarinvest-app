// server/financial-import/canonicalizer.js
// Converts a raw 2-D sheet array into the canonical JSON structure:
//   { importType, clientName, uf, worksheetType, usina, financeiro, entries }
//
// Supported worksheet types (detected from sheet name / column headers):
//   sale_project     — Projeto Venda
//   leasing_project  — Projeto Leasing
//   fixed_costs      — Custos Fixos
//   variable_costs   — Custos Variados / Despesas
//
// All numeric values are normalised to plain numbers (pt-BR comma format accepted).

/**
 * Detect worksheet type from sheet name and/or first few rows.
 * @param {string} sheetName
 * @param {string[][]} rows
 * @returns {'sale_project'|'leasing_project'|'fixed_costs'|'variable_costs'|'unknown'}
 */
export function detectWorksheetType(sheetName, rows) {
  const name = (sheetName ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/venda|sale/.test(name)) return 'sale_project'
  if (/leasing/.test(name)) return 'leasing_project'
  if (/fixo|fixed/.test(name)) return 'fixed_costs'
  if (/variav|variable|despesa|expense/.test(name)) return 'variable_costs'

  // Inspect first few header rows for keywords
  const headerText = rows
    .slice(0, 5)
    .flat()
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/venda|kit solar|valor contrato/.test(headerText)) return 'sale_project'
  if (/leasing|mensalidade|kwh mes/.test(headerText)) return 'leasing_project'
  if (/custo fixo|salario|aluguel/.test(headerText)) return 'fixed_costs'
  if (/combustivel|hotel|alimentacao|translado/.test(headerText)) return 'variable_costs'

  return 'unknown'
}

/**
 * Build a header → column-index map from the first non-empty row.
 * Keys are lower-cased, accent-stripped, space-normalised.
 */
function buildHeaderMap(rows) {
  for (const row of rows) {
    if (row.some((c) => c.trim() !== '')) {
      const map = {}
      row.forEach((cell, idx) => {
        const key = cell
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .trim()
        if (key) map[key] = idx
      })
      return { map, headerRowIndex: rows.indexOf(row) }
    }
  }
  return { map: {}, headerRowIndex: -1 }
}

/** Parse a pt-BR or en-US numeric string. Returns null for invalid. */
function parseNum(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  if (s === '') return null
  // Remove currency symbols and thousands separators
  const cleaned = s
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:[.,]|$))/g, '') // remove thousands dot
    .replace(',', '.') // decimal comma → dot
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Get a value from a row by one or more possible header keys. Returns ''. */
function get(row, map, ...keys) {
  for (const key of keys) {
    const idx = map[key]
    if (idx != null && row[idx] != null) {
      const v = String(row[idx]).trim()
      if (v !== '') return v
    }
  }
  return ''
}

// ── Sale project ─────────────────────────────────────────────────────────────

/**
 * Convert a sale_project sheet into canonical form.
 * Expected columns (flexible matching):
 *   cliente / client_name, uf, potencia_kwp, custo_kit, frete,
 *   valor_contrato, capex_total, receita, lucro, roi, payback, tir
 */
export function canonicalizeSaleSheet(rows) {
  if (rows.length < 2) return []
  const { map, headerRowIndex } = buildHeaderMap(rows)
  const results = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row.some((c) => c.trim() !== '')) continue // skip empty rows

    const clientName = get(row, map, 'cliente', 'client_name', 'nome', 'name', 'nome_cliente')
    if (!clientName) continue

    const uf = get(row, map, 'uf', 'estado', 'state')

    const usina = {
      potencia_instalada_kwp: parseNum(get(row, map, 'potencia_kwp', 'potencia', 'kwp', 'potencia_instalada_kwp')),
      modelo_modulo: get(row, map, 'modulo', 'modelo_modulo', 'painel'),
      modelo_inversor: get(row, map, 'inversor', 'modelo_inversor'),
      quantidade_modulos: parseNum(get(row, map, 'qtd_modulos', 'quantidade_modulos', 'modulos')),
    }

    const financeiro = {
      capex_total: parseNum(get(row, map, 'capex_total', 'capex', 'custo_total', 'investimento_total')),
      custo_kit: parseNum(get(row, map, 'custo_kit', 'kit', 'valor_kit')),
      frete: parseNum(get(row, map, 'frete', 'frete_logistica')),
      engineering_cost: parseNum(get(row, map, 'engenharia', 'engineering_cost', 'projeto_engenharia')),
      installation_cost: parseNum(get(row, map, 'instalacao', 'installation_cost')),
      commission_amount: parseNum(get(row, map, 'comissao', 'commission', 'commission_amount')),
      taxes_amount: parseNum(get(row, map, 'impostos', 'taxes', 'taxes_amount')),
      expected_total_revenue: parseNum(get(row, map, 'receita', 'receita_total', 'valor_contrato', 'contract_value')),
      expected_profit: parseNum(get(row, map, 'lucro', 'profit', 'lucro_esperado')),
      roi_percent: parseNum(get(row, map, 'roi', 'roi_percent', 'roi_pct')),
      payback_months: parseNum(get(row, map, 'payback', 'payback_months', 'payback_meses')),
      irr_annual: parseNum(get(row, map, 'tir', 'tir_aa', 'irr', 'irr_annual')),
    }

    results.push({
      clientName,
      uf: uf.toUpperCase() || null,
      worksheetType: 'sale_project',
      sourceRowIndex: i,
      usina,
      financeiro,
      rawRow: row,
    })
  }

  return results
}

// ── Leasing project ──────────────────────────────────────────────────────────

export function canonicalizeLeasingSheet(rows) {
  if (rows.length < 2) return []
  const { map, headerRowIndex } = buildHeaderMap(rows)
  const results = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row.some((c) => c.trim() !== '')) continue

    const clientName = get(row, map, 'cliente', 'client_name', 'nome', 'nome_cliente')
    if (!clientName) continue

    const uf = get(row, map, 'uf', 'estado', 'state')

    const usina = {
      consumo_kwh_mes: parseNum(get(row, map, 'consumo_kwh_mes', 'consumo', 'kwh_mes')),
      kwh_contratado: parseNum(get(row, map, 'kwh_contratado', 'kwh_contratado_mes')),
      potencia_instalada_kwp: parseNum(get(row, map, 'potencia_kwp', 'potencia', 'kwp')),
      tarifa_cheia_r_kwh: parseNum(get(row, map, 'tarifa', 'tarifa_kwh', 'tarifa_cheia')),
      modelo_modulo: get(row, map, 'modulo', 'modelo_modulo', 'painel'),
      modelo_inversor: get(row, map, 'inversor', 'modelo_inversor'),
    }

    const financeiro = {
      capex_total: parseNum(get(row, map, 'capex_total', 'capex', 'custo_total')),
      custo_kit: parseNum(get(row, map, 'custo_kit', 'kit', 'valor_kit')),
      frete: parseNum(get(row, map, 'frete')),
      monthly_revenue: parseNum(get(row, map, 'mensalidade', 'mensalidade_base', 'monthly_revenue')),
      expected_total_revenue: parseNum(get(row, map, 'receita_total', 'receita', 'receita_esperada')),
      expected_profit: parseNum(get(row, map, 'lucro', 'lucro_esperado')),
      roi_percent: parseNum(get(row, map, 'roi', 'roi_percent')),
      payback_months: parseNum(get(row, map, 'payback', 'payback_months', 'payback_meses')),
      irr_annual: parseNum(get(row, map, 'tir', 'irr', 'tir_aa', 'irr_annual')),
      default_rate_percent: parseNum(get(row, map, 'inadimplencia', 'default_rate', 'default_rate_percent')),
    }

    results.push({
      clientName,
      uf: uf.toUpperCase() || null,
      worksheetType: 'leasing_project',
      sourceRowIndex: i,
      usina,
      financeiro,
      rawRow: row,
    })
  }

  return results
}

// ── Fixed costs ───────────────────────────────────────────────────────────────

export function canonicalizeFixedCostsSheet(rows) {
  if (rows.length < 2) return []
  const { map, headerRowIndex } = buildHeaderMap(rows)
  const results = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row.some((c) => c.trim() !== '')) continue

    const description = get(row, map, 'descricao', 'description', 'item', 'nome', 'name')
    const amount = parseNum(get(row, map, 'valor', 'amount', 'custo', 'cost'))
    if (!description || amount == null) continue

    const category = get(row, map, 'categoria', 'category', 'tipo', 'type') || 'Outros'
    const competenceDate = get(row, map, 'competencia', 'data', 'mes', 'competence_date', 'date')

    results.push({
      worksheetType: 'fixed_costs',
      sourceRowIndex: i,
      entry: {
        entry_type: 'expense',
        scope_type: 'company',
        description,
        category,
        amount,
        competence_date: competenceDate || null,
        is_recurring: true,
        recurrence_frequency: 'monthly',
        status: 'planned',
      },
      rawRow: row,
    })
  }

  return results
}

// ── Variable costs ────────────────────────────────────────────────────────────

export function canonicalizeVariableCostsSheet(rows) {
  if (rows.length < 2) return []
  const { map, headerRowIndex } = buildHeaderMap(rows)
  const results = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row.some((c) => c.trim() !== '')) continue

    const description = get(row, map, 'descricao', 'description', 'item', 'nome', 'name')
    const amount = parseNum(get(row, map, 'valor', 'amount', 'custo', 'cost'))
    if (!description || amount == null) continue

    const category = get(row, map, 'categoria', 'category', 'tipo', 'type') || 'Outros'
    const clientName = get(row, map, 'cliente', 'client_name', 'projeto')
    const competenceDate = get(row, map, 'data', 'competencia', 'competence_date')

    results.push({
      worksheetType: 'variable_costs',
      sourceRowIndex: i,
      clientName: clientName || null,
      entry: {
        entry_type: 'expense',
        scope_type: clientName ? 'project' : 'company',
        description,
        category,
        amount,
        competence_date: competenceDate || null,
        is_recurring: false,
        status: 'planned',
      },
      rawRow: row,
    })
  }

  return results
}

/**
 * Canonicalize a single sheet based on its detected type.
 * Returns an array of canonical items.
 */
export function canonicalizeSheet(sheetName, rows) {
  const wsType = detectWorksheetType(sheetName, rows)
  switch (wsType) {
    case 'sale_project':     return { type: wsType, items: canonicalizeSaleSheet(rows) }
    case 'leasing_project':  return { type: wsType, items: canonicalizeLeasingSheet(rows) }
    case 'fixed_costs':      return { type: wsType, items: canonicalizeFixedCostsSheet(rows) }
    case 'variable_costs':   return { type: wsType, items: canonicalizeVariableCostsSheet(rows) }
    default:
      return { type: 'unknown', items: [] }
  }
}
