/**
 * Smoke-test all apps linked from apps-dashboard + cron auth sanity.
 * Usage: node scripts/smoke-all-apps.mjs
 */
import fs from 'fs';

const DASH = 'G:/Dropbox/alan ranger photography/Website Code/apps-dashboard/index.html';
const html = fs.readFileSync(DASH, 'utf8');
const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
const internal = [
  'https://apps-dashboard-lilac.vercel.app/',
  'https://apps-dashboard-lilac.vercel.app/apps',
  'https://apps-dashboard-lilac.vercel.app/mission-control',
  'https://apps-dashboard-lilac.vercel.app/handoff',
  'https://apps-dashboard-lilac.vercel.app/bau-workflow.html'
];

const extraApis = [
  { name: 'chat-proxy /api/chat POST', url: 'https://alan-chat-proxy.vercel.app/api/chat', method: 'POST', body: { query: 'ping health', pageContext: null }, expect: [200] },
  { name: 'chat-proxy tools health (no auth)', url: 'https://alan-chat-proxy.vercel.app/api/tools?action=health', expect: [401] },
  { name: 'chat-proxy admin.html', url: 'https://alan-chat-proxy.vercel.app/admin.html', expect: [200], forbid: ['eyJhbGciOi', 'taken offline'] },
  { name: 'chat-proxy cron-dashboard', url: 'https://alan-chat-proxy.vercel.app/cron-dashboard.html', expect: [200], forbid: ['b6c3f0c9', 'eyJhbGciOi', 'abc123xyz456'] },
  { name: 'ai-geo dashboard', url: 'https://ai-geo-audit.vercel.app/audit-dashboard.html', expect: [200] },
  { name: 'ai-geo cron job-history (no auth)', url: 'https://ai-geo-audit.vercel.app/api/cron/job-history', expect: [200, 401, 403] },
  { name: 'apps-dash diary-drift (no auth)', url: 'https://apps-dashboard-lilac.vercel.app/api/cron/diary-drift', expect: [401, 403, 405] },
  { name: 'apps-dash gcal-auto-sync (no auth)', url: 'https://apps-dashboard-lilac.vercel.app/api/cron/gcal-auto-sync', expect: [401, 403, 405] },
  { name: 'practice-pack github api', url: 'https://api.github.com/repos/alanranger/practice-pack-generator', expect: [200, 404] }
];

async function hit(url, opts = {}) {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 45000);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers || { Accept: 'text/html,application/json,*/*' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      redirect: 'follow',
      signal: ctrl.signal
    });
    const text = await res.text();
    return { status: res.status, ms: Date.now() - started, len: text.length, text: text.slice(0, 4000), ok: res.ok };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, len: 0, text: '', error: e.message, ok: false };
  } finally {
    clearTimeout(t);
  }
}

function row(status, name, detail) {
  console.log(`${status.padEnd(4)} ${name} — ${detail}`);
}

const results = [];

console.log('=== Page loads (dashboard links) ===');
for (const url of [...new Set([...internal, ...urls])]) {
  const r = await hit(url);
  let pass = r.status >= 200 && r.status < 400;
  let note = `${r.status} ${r.ms}ms ${r.len}b`;
  if (r.error) { pass = false; note = r.error; }
  // Private GitHub repo: unauthenticated may 404 — treat as OK if private confirmed later
  if (url.includes('github.com/alanranger/practice-pack-generator') && (r.status === 404 || r.status === 200)) {
    pass = true;
    note += r.status === 404 ? ' (private/hidden from anon — OK)' : '';
  }
  row(pass ? 'OK' : 'FAIL', url, note);
  results.push({ type: 'page', url, pass, ...r });
}

console.log('\n=== API / security checks ===');
for (const spec of extraApis) {
  const headers = { Accept: '*/*' };
  if (spec.body) headers['Content-Type'] = 'application/json';
  const r = await hit(spec.url, { method: spec.method, body: spec.body, headers });
  let pass = spec.expect.includes(r.status);
  let note = `${r.status} ${r.ms}ms`;
  if (r.error) { pass = false; note = r.error; }
  if (pass && spec.forbid) {
    for (const bad of spec.forbid) {
      if (r.text.includes(bad)) { pass = false; note += ` LEAK:${bad.slice(0, 12)}`; }
    }
  }
  if (spec.name.includes('practice-pack github')) {
    try {
      const j = JSON.parse(r.text);
      if (j.private === true) note += ' private=true';
      else if (j.message) note += ` ${j.message}`;
      else if (j.private === false) { pass = false; note += ' STILL PUBLIC'; }
    } catch { /* ignore */ }
  }
  row(pass ? 'OK' : 'FAIL', spec.name, note);
  results.push({ type: 'api', name: spec.name, pass, status: r.status, note });
}

const failed = results.filter((x) => !x.pass);
console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ===`);
if (failed.length) {
  for (const f of failed) console.log(' -', f.name || f.url, f.note || f.status || f.error);
  process.exitCode = 1;
}
