/**
 * Prefer AI GEO Audit .env.vercel.prod sb_secret over disabled JWTs in .env.local.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JWT = /^eyJ/;
const AUDIT = resolve(ROOT, '../AI GEO Audit');

function parseEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '').replace(/\\n$/, '');
    const cur = process.env[m[1]] || '';
    if (!cur || (JWT.test(cur) && (val.startsWith('sb_') || !JWT.test(val)))) {
      process.env[m[1]] = val;
    }
  }
}

export function loadSupabaseEnv() {
  for (const file of [
    resolve(AUDIT, '.env.vercel.prod'),
    resolve(AUDIT, '.env.local'),
    resolve(ROOT, '.env.local'),
    resolve(ROOT, '.env')
  ]) parseEnvFile(file);
  return {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE || ''
  };
}
