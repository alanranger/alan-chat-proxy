import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /node_modules|(^|\/)(_|tmp|\.tmp)|testing-scripts/;

function sourceFiles(dir) {
  const out = [];
  if (!fs.existsSync(path.join(ROOT, dir))) return out;
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (SKIP.test(rel)) continue;
    if (e.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(m|c)?js$/.test(e.name)) out.push(rel);
  }
  return out;
}

test('every paged Supabase read has an explicit order (use lib/supabase-paged.js)', () => {
  const offenders = [];
  for (const rel of ['api', 'lib', 'scripts'].flatMap(sourceFiles)) {
    if (rel === 'lib/supabase-paged.js') continue;
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const paged = /\.range\((?!\s*0\s*,)/.test(line) || /[?&]offset=/.test(line);
      if (!paged) return;
      const window = lines.slice(Math.max(0, i - 40), i + 1).join('\n');
      if (!/\.order\(|orderedQuery\(|order=/.test(window)) offenders.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
