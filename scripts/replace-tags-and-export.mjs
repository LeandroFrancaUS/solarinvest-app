import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { exec as _exec } from 'node:child_process';
import util from 'node:util';
const exec = util.promisify(_exec);

// ===== Helpers =====
function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Constrói regex que tolera boundary de run <w:t></w:t><w:r><w:t> entre cada caractere do literal
function buildRunSafeTagRegex(tagLiteral /* p.ex. "{{nomeCompleto}}" */) {
  const GAP = String.raw`(?:\s*</w:t>\s*</w:r>\s*<w:r[^>]*>\s*<w:t[^>]*>\s*)?`;
  const esc = tagLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escapa meta-chars
  return new RegExp(esc.split('').join(GAP), 'g');
}

// Substitui a tag por um único run simples
function replaceTagRunSafe(xmlStr, tagLiteral, value, opts = {}) {
  const re = buildRunSafeTagRegex(tagLiteral);
  const textNode = `<w:r>${opts.bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t>${escapeXml(value ?? '')}</w:t></w:r>`;
  return xmlStr.replace(re, textNode);
}

// Remove chaves órfãs produzidas por quebras esquisitas de runs.
// Regras conservadoras para não afetar texto real do contrato.
function removeOrphanBraces(xmlStr) {
  let out = xmlStr;
  // 1) '{{' aberto antes de boundary
  out = out.replace(/\{(?=\s*<\/w:t>\s*<\/w:r>)/g, '');
  // 2) '}}' fechado após abrir <w:t>
  out = out.replace(/(?<=<w:t[^>]*>\s*)\}/g, '');
  // 3) Sequências vazias '{}' entre runs
  out = out.replace(/\{\s*<\/w:t>\s*<\/w:r>\s*<w:r[^>]*>\s*<w:t[^>]*>\s*\}/g, '');
  return out;
}

// Aplica substituições de todas as tags conhecidas e limpa chaves órfãs
function replaceAllTagsAndClean(xmlStr, data, styleMap = {}) {
  let out = xmlStr;

  const entries = [
    ['{{nomeCompleto}}', data.nomeCompleto],
    ['{{cpfCnpj}}', data.cpfCnpjFmt ?? data.cpfCnpj],
    ['{{enderecoCompleto}}', data.enderecoCompleto],
    ['{{unidadeConsumidora}}', data.unidadeConsumidora],
    ['{{dataAtualExtenso}}', data.dataAtualExtenso],
  ];

  for (const [tag, value] of entries) {
    const bold = styleMap[tag] === 'bold'; // permitir forçar bold via mapa
    out = replaceTagRunSafe(out, tag, value ?? '', { bold });
  }

  // Remover chaves restantes se sobrar alguma splitada
  out = removeOrphanBraces(out);
  return out;
}

// Processa um arquivo .docx/.dotx → substitui tags → gera novo .docx (memória) → salva → converte PDF
async function processOneDocx(inputPath, outputDir, data, styleMap = {}) {
  const bin = await fs.readFile(inputPath);
  const zip = await JSZip.loadAsync(bin);

  const names = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));

  for (const name of names) {
    const xml = await zip.file(name).async('string');
    const replaced = replaceAllTagsAndClean(xml, data, styleMap);
    zip.file(name, replaced);
  }

  await fs.mkdir(outputDir, { recursive: true });

  const base = path.basename(inputPath).replace(/\.(docx|dotx)$/i, '');
  const outDocx = path.join(outputDir, base + '.docx');
  const node = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outDocx, node);

  // Converter para PDF (se preferir outra ferramenta, troque aqui)
  await exec(`soffice --headless --convert-to pdf --outdir ${JSON.stringify(outputDir)} ${JSON.stringify(outDocx)}`);

  return {
    docx: outDocx,
    pdf: path.join(outputDir, base + '.pdf'),
  };
}

// Batch: percorre todos os .docx/.dotx do diretório e executa o pipeline
export async function processDirectory({ inputDir, outputDir, data, styleMap = {} }) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const targets = entries
    .filter(e => e.isFile() && /\.(docx|dotx)$/i.test(e.name))
    .map(e => path.join(inputDir, e.name));

  const results = [];
  for (const file of targets) {
    const r = await processOneDocx(file, outputDir, data, styleMap);
    results.push(r);
  }
  return results;
}

// ====== CLI simples ======
// Exemplo de uso:
// node scripts/replace-tags-and-export.mjs "/public/templates/contratos" "/tmp/output" data.json
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const [, , inputDir, outputDir, dataJsonPath, styleJsonPath] = process.argv;
    if (!inputDir || !outputDir || !dataJsonPath) {
      console.error('Uso: node scripts/replace-tags-and-export.mjs <inputDir> <outputDir> <data.json> [style.json]');
      process.exit(1);
    }
    const raw = await fs.readFile(dataJsonPath, 'utf-8');
    const data = JSON.parse(raw);
    const style = styleJsonPath ? JSON.parse(await fs.readFile(styleJsonPath, 'utf-8')) : {};

    // Fallback simples de máscara CPF/CNPJ se não vier pronto
    if (!data.cpfCnpjFmt && data.cpfCnpj) {
      const d = String(data.cpfCnpj).replace(/\D/g, '');
      data.cpfCnpjFmt = d.length <= 11
        ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        : d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    const results = await processDirectory({ inputDir, outputDir, data, styleMap: style });
    console.log(JSON.stringify(results, null, 2));
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
