#!/usr/bin/env node
/**
 * Monday brief · System health: the CSV auto-sync status lives only on this PC
 * (alan-shared-resources/outputs/AUTO-SYNC-STATUS-LATEST.json). The handoff cycle copies it to
 * system_maintenance_state (key csv_auto_sync) so the Vercel brief can show it. State + times only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(HERE, '..', '..', '.env.local');
const STATUS_FILE = 'G:\\Dropbox\\alan ranger photography\\Website Code\\alan-shared-resources\\outputs\\AUTO-SYNC-STATUS-LATEST.json';

function env(key) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const m = text.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

export function statusRow(status, now = new Date()) {
  return {
    key: 'csv_auto_sync',
    state: String(status?.state || 'unknown'),
    updated_at: now.toISOString(),
    last_details: {
      checked_at: status?.checked_at || null,
      ahead_of_origin: status?.ahead_of_origin ?? null,
      recovered_on_retry: Array.isArray(status?.recovered_on_retry) ? status.recovered_on_retry.length : 0,
      source: 'AUTO-SYNC-STATUS-LATEST.json'
    }
  };
}

async function main() {
  if (!env('SUPABASE_URL') || !fs.existsSync(STATUS_FILE)) return console.log('autosync status: skipped (no env or status file)');
  const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8').replace(/^\uFEFF/, ''));
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await globalThis.fetch(`${env('SUPABASE_URL')}/rest/v1/system_maintenance_state?on_conflict=key`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(statusRow(status))
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  console.log(`autosync status: reported ${status.state} (${status.checked_at})`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(`autosync status: ${e.message}`); process.exitCode = 1; });
