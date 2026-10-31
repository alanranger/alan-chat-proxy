/**
 * Minimal RFC-4180 CSV read/write used by the review scripts.
 */
import fs from 'node:fs';

export function parseCsvObjects(text) {
  const t = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (inQ) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') inQ = false; else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const kept = rows.filter((r) => r.some((v) => v !== ''));
  const header = (kept[0] || []).map((h) => h.trim());
  return kept.slice(1).map((r) => Object.fromEntries(header.map((h, ix) => [h, r[ix] ?? ''])));
}

export function readCsvFile(file) {
  return parseCsvObjects(fs.readFileSync(file, 'utf8'));
}

export function writeCsvFile(file, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))];
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}
