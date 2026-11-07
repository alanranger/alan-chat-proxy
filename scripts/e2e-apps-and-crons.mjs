/**
 * End-to-end health check across apps-dashboard tiles + cron auth.
 * Usage: node scripts/e2e-apps-and-crons.mjs
 * Optional env: INGEST_TOKEN, CRON_SECRET (apps-dashboard), ARP_ADMIN_KEY
 */
import fs from 'fs';
import { spawnSync } from 'child_process';

const ROOTS = {
  chat: 'G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot',
  apps: 'G:/Dropbox/alan ranger photography/Website Code/apps-dashboard',
  aigeo: 'G:/Dropbox/alan ranger photography/Website Code/AI GEO Audit',
};
const VC = 'C:/Users/alan/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';

function pullEnv(cwd, keys) {
  const out = `${process.env.TEMP || '/tmp'}/e2e-env-${Date.now()}.env`;
  spawnSync(process.execPath, [VC, 'env', 'pull', out, '--environment=production', '--yes', '--cwd', cwd], {
    encoding: 'utf8',
    cwd
  });
  const map = {};
  if (fs.existsSync(out)) {
    for (const line of fs.readFileSync(out, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const k = m[1];
      if (!keys.includes(k)) continue;
      map[k] = m[2].replace(/^"|"$/g, '');
    }
    fs.unlinkSync(out);
  }
  return map;
}

async function hit(url, opts = {}) {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 60000);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
      redirect: 'follow'
    });
    const text = await res.text();
    return { status: res.status, ms: Date.now() - started, text, ok: res.ok };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, text: '', error: e.message, ok: false };
  } finally {
    clearTimeout(t);
  }
}

function pass(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  return ok;
}

const results = [];
const chatEnv = pullEnv(ROOTS.chat, ['INGEST_TOKEN']);
const appsEnv = pullEnv(ROOTS.apps, ['CRON_SECRET', 'MC_CRON_SECRET']);
const ingest = process.env.INGEST_TOKEN || chatEnv.INGEST_TOKEN || '';
const cronSecret = process.env.CRON_SECRET || appsEnv.CRON_SECRET || appsEnv.MC_CRON_SECRET || '';

console.log(`tokens: ingest=${ingest ? ingest.length : 0}chars cron=${cronSecret ? cronSecret.length : 0}chars`);

const dashHtml = fs.readFileSync(`${ROOTS.apps}/index.html`, 'utf8');
const appUrls = [...dashHtml.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
const internal = [
  'https://apps-dashboard-lilac.vercel.app/',
  'https://apps-dashboard-lilac.vercel.app/mission-control',
  'https://apps-dashboard-lilac.vercel.app/handoff',
  'https://apps-dashboard-lilac.vercel.app/bau-workflow.html'
];

console.log('\n=== 1) App page loads ===');
for (const url of [...new Set([...internal, ...appUrls])]) {
  const r = await hit(url, { timeoutMs: 45000 });
  let ok = r.status >= 200 && r.status < 400;
  let detail = `${r.status} ${r.ms}ms`;
  if (url.includes('practice-pack-generator') && (r.status === 404 || r.status === 200)) {
    ok = true;
    detail += ' (private repo OK)';
  }
  if (r.status === 429) {
    ok = true; // rate limit ≠ broken deploy
    detail += ' (rate-limited; treat as up)';
  }
  if (r.error) { ok = false; detail = r.error; }
  results.push(pass(url, ok, detail));
}

console.log('\n=== 2) Chat proxy functional ===');
{
  const chat = await hit('https://alan-chat-proxy.vercel.app/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { query: 'What photography workshops do you run?', pageContext: null },
    timeoutMs: 90000
  });
  const hasAnswer = /answer|structured|markdown|ok/i.test(chat.text);
  results.push(pass('POST /api/chat', chat.status === 200 && hasAnswer, `${chat.status} ${chat.ms}ms`));

  const auth = { Authorization: `Bearer ${ingest}` };
  for (const [name, url] of [
    ['admin cron_jobs', 'https://alan-chat-proxy.vercel.app/api/admin?action=cron_jobs'],
    ['db-health', 'https://alan-chat-proxy.vercel.app/api/db-health'],
    ['tools health', 'https://alan-chat-proxy.vercel.app/api/tools?action=health'],
    ['chat-improvement analyze', 'https://alan-chat-proxy.vercel.app/api/chat-improvement?action=analyze']
  ]) {
    const r = await hit(url, { headers: auth, timeoutMs: 120000 });
    results.push(pass(name, r.status === 200, `${r.status} ${r.ms}ms`));
  }

  const noAuth = await hit('https://alan-chat-proxy.vercel.app/api/tools?action=health');
  results.push(pass('tools rejects anon', noAuth.status === 401, String(noAuth.status)));

  for (const page of ['admin.html', 'cron-dashboard.html', 'analytics.html', 'bulk-simple.html']) {
    const r = await hit(`https://alan-chat-proxy.vercel.app/${page}`);
    const leaked = /eyJhbGci|b6c3f0c9e6f44cce/.test(r.text);
    results.push(pass(`safe ${page}`, r.status === 200 && !leaked, `${r.status} leaked=${leaked}`));
  }
}

console.log('\n=== 3) Apps-dashboard cron auth ===');
{
  const endpoints = [
    'https://apps-dashboard-lilac.vercel.app/api/cron/hotel-source-reconcile',
    'https://apps-dashboard-lilac.vercel.app/api/cron/diary-drift',
    'https://apps-dashboard-lilac.vercel.app/api/cron/gcal-auto-sync'
  ];
  for (const url of endpoints) {
    const anon = await hit(url, { timeoutMs: 20000 });
    const anonOk = anon.status === 401 || anon.status === 403;
    results.push(pass(`anon blocked ${url.split('/').pop()}`, anonOk, `${anon.status} ${anon.error || ''}`));

    if (cronSecret) {
      const probeUrl = url.includes('hotel-source') ? url : `${url}?probe=1`;
      const authed = await hit(probeUrl, {
        headers: { Authorization: `Bearer ${cronSecret}` },
        timeoutMs: url.includes('hotel-source') ? 120000 : 30000
      });
      const ok = authed.status === 200 || authed.status === 503;
      results.push(pass(`authed ${url.split('/').pop()}`, ok, `${authed.status} ${authed.ms}ms`));
    } else {
      results.push(pass(`authed ${url.split('/').pop()}`, false, 'CRON_SECRET missing locally'));
    }
  }
}

console.log('\n=== 4) AI GEO ===');
{
  const dash = await hit('https://ai-geo-audit.vercel.app/audit-dashboard.html', { timeoutMs: 60000 });
  results.push(pass('AI GEO dashboard', dash.status === 200 && dash.text.length > 10000, `${dash.status} ${dash.text.length}b`));
  const hist = await hit('https://ai-geo-audit.vercel.app/api/cron/job-history');
  results.push(pass('AI GEO cron history requires auth', hist.status === 401 || hist.status === 403, String(hist.status)));
}

const failed = results.filter((x) => !x).length;
const passed = results.length - failed;
console.log(`\n=== SUMMARY ${passed}/${results.length} passed, ${failed} failed ===`);
process.exitCode = failed ? 1 : 0;
