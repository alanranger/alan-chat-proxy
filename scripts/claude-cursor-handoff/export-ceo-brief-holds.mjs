#!/usr/bin/env node
/**
 * CEO brief held by the Monday sense-check → ALERT-ceo-brief-held-LATEST.md for Claude (Cursor Outputs).
 * Vercel cannot write to Google Drive, so the PC's handoff cycle polls ceo_brief_holds and writes the alert once
 * per hold (alert_exported_at). No figures beyond the failed checks; no personal data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(HERE, '..', '..', '.env.local');
const OUTBOX = 'C:\\Users\\alan\\Google Drive\\Claude shared resources\\Cursor Outputs for Claude';
const ALERT = path.join(OUTBOX, 'ALERT-ceo-brief-held-LATEST.md');

function env(key) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const m = text.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

async function rest(pathAndQuery, init = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await globalThis.fetch(`${env('SUPABASE_URL')}/rest/v1/${pathAndQuery}`, {
    ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

export function alertMarkdown(hold, now = new Date()) {
  const lines = (hold.failures || []).map((f) => `- **${f.id}**: ${f.detail}`);
  return [
    `# ALERT: CEO brief held (week of ${hold.week_start})`,
    '',
    `Written ${now.toISOString()} by the PC handoff cycle. Held at ${hold.held_at}.`,
    '',
    'The Monday sense-check held this week\'s brief. Alan got the short "held while figures are checked" note instead, with no figures.',
    '',
    '## Checks that failed',
    ...lines,
    '',
    '## What happens next',
    '- Check the figures, then either fix the source and re-run, or Alan presses **Send anyway** on the dashboard banner.',
    `- Hold id: \`${hold.id}\` (table \`ceo_brief_holds\`).`,
    '',
  ].join('\n');
}

async function main() {
  if (!env('SUPABASE_URL')) return console.log('ceo brief holds: no Supabase env, skipped');
  const holds = await rest('ceo_brief_holds?select=*&alert_exported_at=is.null&released_at=is.null&order=held_at.desc&limit=5');
  if (!holds?.length) return console.log('ceo brief holds: none new');
  fs.writeFileSync(ALERT, alertMarkdown(holds[0]), 'utf8');
  for (const h of holds) {
    await rest(`ceo_brief_holds?id=eq.${h.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ alert_exported_at: new Date().toISOString() }) });
  }
  console.log(`ceo brief holds: alert written for week ${holds[0].week_start}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(`ceo brief holds: ${e.message}`); process.exitCode = 1; });
