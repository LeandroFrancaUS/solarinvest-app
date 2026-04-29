import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const SERVER = path.join(ROOT, 'server');
const API = path.join(ROOT, 'api');
const SCRIPTS = path.join(ROOT, 'scripts');
const DOCS = path.join(ROOT, 'docs');

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.vite', 'coverage', '.next', '.turbo']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(item)) walk(full, files);
      continue;
    }
    if (EXTENSIONS.has(path.extname(full))) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function count(text, regex) {
  return [...text.matchAll(regex)].length;
}

function classify(file) {
  const r = rel(file);
  if (r.includes('/pages/')) return 'page';
  if (r.includes('/components/')) return 'component';
  if (r.includes('/stores/') || r.includes('/store/') || /use[A-Z].*Store/.test(r)) return 'store';
  if (r.includes('/contexts/') || r.includes('/context/')) return 'context';
  if (r.includes('/services/') || r.startsWith('server/')) return 'service';
  if (r.startsWith('api/')) return 'api';
  if (r.includes('/domain/')) return 'domain';
  if (r.includes('/shared/')) return 'shared';
  if (r.includes('/lib/finance') || /roi|payback|vpl/i.test(r)) return 'engine:finance';
  if (r.includes('/lib/pdf') || /pdf|printable|proposal/i.test(r)) return 'engine:pdf';
  if (/parser|extract|ocr|plumber/i.test(r)) return 'engine:parser';
  if (/payment|cobranca|mensalidade|installment/i.test(r)) return 'engine:payments';
  if (/format|locale|br-number|document/i.test(r)) return 'engine:formatting';
  return 'other';
}

function getImports(text) {
  const imports = [];
  const re = /import\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g;
  for (const match of text.matchAll(re)) imports.push(match[1]);
  return imports;
}

function maxBraceDepth(text) {
  let depth = 0;
  let max = 0;
  for (const ch of text) {
    if (ch === '{') max = Math.max(max, ++depth);
    if (ch === '}') depth = Math.max(0, depth - 1);
  }
  return max;
}

function auditFile(file) {
  const text = read(file);
  const lines = text.split('\n');
  const basename = path.basename(file);
  const imports = getImports(text);
  const jsxNodes = count(text, /<[A-Z][A-Za-z0-9]*|<div\b|<section\b|<article\b|<main\b|<form\b|<table\b/g);

  return {
    file: rel(file),
    type: classify(file),
    lines: lines.length,
    imports,
    exports: count(text, /\bexport\b/g),
    functions: count(text, /\bfunction\s+\w+/g) + count(text, /const\s+\w+\s*=\s*(?:async\s*)?\(/g),
    hooks: count(text, /\buse[A-Z]\w*\s*\(/g),
    jsxNodes,
    maxBraceDepth: maxBraceDepth(text),
    anyCount: count(text, /:\s*any\b|as\s+any\b/g),
    todoCount: count(text, /TODO|FIXME|HACK|XXX/g),
    appImportRisk: imports.some((x) => /(^|\/)App(\.tsx?)?$/.test(x) || x === '@/App'),
    barrelRisk: basename === 'index.ts' || basename === 'index.tsx',
    businessLogicInJsxRisk: jsxNodes > 80 && count(text, /\?\s|&&|\|\||\.map\(|\.filter\(|\.reduce\(/g) > 25,
    deeplyNestedRisk: lines.length > 500 || maxBraceDepth(text) > 18 || count(text, /if\s*\(/g) > 25,
  };
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const k = item[key];
    acc[k] ||= [];
    acc[k].push(item);
    return acc;
  }, {});
}

function riskReasons(file) {
  const reasons = [];
  if (file.lines > 500) reasons.push(`arquivo grande (${file.lines} linhas)`);
  if (file.appImportRisk) reasons.push('importa App.tsx');
  if (file.barrelRisk) reasons.push('barrel/index export');
  if (file.anyCount > 0) reasons.push(`uso de any (${file.anyCount})`);
  if (file.businessLogicInJsxRisk) reasons.push('possível regra de negócio no JSX');
  if (file.deeplyNestedRisk) reasons.push('deeply nested / complexidade alta');
  if (file.todoCount > 0) reasons.push(`TODO/FIXME (${file.todoCount})`);
  return reasons;
}

function markdownReport(results) {
  const byType = groupBy(results, 'type');
  const bigFiles = results.filter((x) => x.lines > 500).sort((a, b) => b.lines - a.lines);
  const risky = results.map((x) => ({ ...x, reasons: riskReasons(x) })).filter((x) => x.reasons.length > 0);
  const engines = results.filter((x) => x.type.startsWith('engine:'));

  return `# Auditoria do Projeto SolarInvest\n\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n## Resumo\n\n- Arquivos analisados: ${results.length}\n- Motores identificados: ${engines.length}\n- Arquivos grandes > 500 linhas: ${bigFiles.length}\n- Arquivos com riscos técnicos: ${risky.length}\n\n## Mapa por tipo\n\n${Object.entries(byType).sort(([a], [b]) => a.localeCompare(b)).map(([type, files]) => `- ${type}: ${files.length}`).join('\n')}\n\n## Motores encontrados\n\n${engines.map((x) => `- ${x.file} (${x.type})`).join('\n') || 'Nenhum motor identificado por heurística.'}\n\n## Arquivos grandes\n\n${bigFiles.map((x) => `- ${x.file}: ${x.lines} linhas`).join('\n') || 'Nenhum.'}\n\n## Riscos encontrados\n\n${risky.map((x) => `### ${x.file}\n\n- Tipo: ${x.type}\n- Linhas: ${x.lines}\n- Imports: ${x.imports.length}\n- Hooks: ${x.hooks}\n- JSX nodes aprox.: ${x.jsxNodes}\n- Profundidade de chaves aprox.: ${x.maxBraceDepth}\n- Motivos: ${x.reasons.join(', ')}\n`).join('\n') || 'Nenhum risco relevante encontrado.'}\n\n## Recomendações automáticas\n\n1. Mover regras de negócio para src/domain ou src/lib.\n2. Quebrar componentes acima de 400–500 linhas.\n3. Manter App.tsx como composição de providers/rotas, sem regra de negócio.\n4. Evitar barrels index.ts em stores, contexts, pdf, domain e shared.\n5. Centralizar motores puros para status de pagamento, ROI, geração, parser PDF, formatação pt-BR e proposta.\n6. Substituir JSX profundamente aninhado por componentes menores e view models.\n7. Trocar condicionais complexas inline por funções nomeadas.\n8. Trocar strings soltas por enums/maps centralizados.\n`;
}

const roots = [SRC, SERVER, API, SCRIPTS];
const files = roots.flatMap((root) => walk(root));
const results = files.map(auditFile);

fs.mkdirSync(DOCS, { recursive: true });
fs.writeFileSync(path.join(DOCS, 'AUDITORIA_DO_PROJETO.md'), markdownReport(results));
fs.writeFileSync(path.join(DOCS, 'audit-data.json'), JSON.stringify(results, null, 2));

console.log('✅ Auditoria gerada em docs/AUDITORIA_DO_PROJETO.md');
console.log('✅ Dados gerados em docs/audit-data.json');
