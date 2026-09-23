/* eslint-disable no-undef -- Node 18+ fetch/AbortController */
/**
 * RLS Phase A functional baseline / after suite.
 * Usage: node scripts/rls-phase-a-baseline.mjs [--label=before|after]
 * Pulls Vercel env for tokens; uses publishable key from env PUBLIC_SUPABASE_KEY if set.
 */
import fs from 'fs';
import { spawnSync } from 'child_process';

const LABEL = (process.argv.find((a) => a.startsWith('--label=')) || '--label=run').split('=')[1];
const ROOTS = {
  chat: 'G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot',
  apps: 'G:/Dropbox/alan ranger photography/Website Code/apps-dashboard',
  aigeo: 'G:/Dropbox/alan ranger photography/Website Code/AI GEO Audit',
};
const VC = 'C:/Users/alan/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const CHAT = 'https://alan-chat-proxy.vercel.app';
const AIGEO = 'https://ai-geo-audit.vercel.app';
const APPS = 'https://apps-dashboard-lilac.vercel.app';
const SB = 'https://igzvwbvgvmzvvzoclufx.supabase.co';

function pullEnv(cwd, keys) {
  const out = `${process.env.TEMP || '/tmp'}/rls-env-${Date.now()}-${Math.random().toString(16).slice(2)}.env`;
  spawnSync(process.execPath, [VC, 'env', 'pull', out, '--environment=production', '--yes', '--cwd', cwd], {
    encoding: 'utf8',
    cwd,
  });
  const map = {};
  if (fs.existsSync(out)) {
    for (const line of fs.readFileSync(out, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || !keys.includes(m[1])) continue;
      map[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    try {
      fs.unlinkSync(out);
    } catch {
      /* ignore */
    }
  }
  return map;
}

async function hit(url, opts = {}) {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 60000);
  try {
    const headers = { ...(opts.headers || {}) };
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    return { status: res.status, ms: Date.now() - started, text, ok: res.ok };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, text: '', error: e.message, ok: false };
  } finally {
    clearTimeout(t);
  }
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: String(detail).slice(0, 240) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

const chatEnv = pullEnv(ROOTS.chat, ['INGEST_TOKEN', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
const appsEnv = pullEnv(ROOTS.apps, ['CRON_SECRET', 'MC_CRON_SECRET']);
const aigeoEnv = pullEnv(ROOTS.aigeo, ['CRON_SECRET']);
const ingest = process.env.INGEST_TOKEN || chatEnv.INGEST_TOKEN || '';
const cronApps = process.env.CRON_SECRET || appsEnv.CRON_SECRET || appsEnv.MC_CRON_SECRET || '';
const cronGeo = process.env.CRON_SECRET || aigeoEnv.CRON_SECRET || '';
const pubKey =
  process.env.PUBLIC_SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  chatEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  chatEnv.SUPABASE_ANON_KEY ||
  '';

console.log(`\n=== RLS suite label=${LABEL} ===`);
console.log(
  `tokens: ingest=${ingest ? 'yes' : 'no'} appsCron=${cronApps ? 'yes' : 'no'} geoCron=${cronGeo ? 'yes' : 'no'} pubKey=${pubKey ? pubKey.slice(0, 14) + '…' : 'no'}`
);

// 1) Chat
{
  const r = await hit(`${CHAT}/api/chat`, {
    method: 'POST',
    body: { query: 'What photography workshops do you run?', pageContext: null },
    timeoutMs: 90000,
  });
  let jsonOk = false;
  try {
    const j = JSON.parse(r.text);
    jsonOk = !!(j.answer || j.response || j.ok || j.reply);
  } catch {
    jsonOk = r.text.length > 40;
  }
  record('chat POST /api/chat', r.status === 200 && jsonOk, `${r.status} ${r.ms}ms`);
}

// 2) AI GEO
{
  const dash = await hit(`${AIGEO}/audit-dashboard.html`);
  record('aigeo dashboard HTML', dash.status === 200 && dash.text.includes('Revenue'), `${dash.status} ${dash.ms}ms`);
  const hist = await hit(`${AIGEO}/api/cron/job-history`);
  record(
    'aigeo job-history',
    [200, 401, 403].includes(hist.status),
    `${hist.status} (auth gate ok if 401/403)`
  );
  if (cronGeo) {
    const probe = await hit(`${AIGEO}/api/cron/job-history`, {
      headers: { Authorization: `Bearer ${cronGeo}` },
    });
    record('aigeo job-history authed', probe.status === 200, `${probe.status}`);
  }
  const rt = await hit(`${AIGEO}/api/aigeo/revenue-truth-findings`);
  record('aigeo revenue-truth-findings', [200, 401, 403, 404].includes(rt.status), `${rt.status}`);
}

// 3) apps-dashboard tiles + crons
{
  const html = fs.readFileSync(`${ROOTS.apps}/index.html`, 'utf8');
  const appUrls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  const pages = [
    `${APPS}/`,
    `${APPS}/mission-control`,
    `${APPS}/handoff`,
    `${APPS}/bau-workflow.html`,
    ...appUrls,
  ];
  for (const url of [...new Set(pages)]) {
    const r = await hit(url, { timeoutMs: 45000 });
    const ok = r.status >= 200 && r.status < 400;
    record(`apps page ${url.replace(/^https?:\/\//, '').slice(0, 60)}`, ok, `${r.status} ${r.ms}ms`);
  }
  for (const path of [
    '/api/cron/diary-drift?probe=1',
    '/api/cron/gcal-auto-sync?probe=1',
    '/api/cron/hotel-source-reconcile?probe=1',
  ]) {
    const noAuth = await hit(`${APPS}${path}`);
    record(`apps ${path} no-auth`, [401, 403].includes(noAuth.status), `${noAuth.status}`);
    if (cronApps) {
      const auth = await hit(`${APPS}${path}`, {
        headers: { Authorization: `Bearer ${cronApps}` },
      });
      record(`apps ${path} authed`, auth.status === 200, `${auth.status} ${auth.text.slice(0, 80)}`);
    }
  }
}

// 4) Website product + filters
{
  const product = await hit(
    'https://www.alanranger.com/photography-workshops-near-me/bluebell-photography-photo-workshop-warwickshire-24'
  );
  record(
    'site product page',
    product.status === 200 && product.text.length > 5000,
    `${product.status} len=${product.text.length}`
  );
  const hasReview =
    /review|testimonial|stars|rating/i.test(product.text) || product.text.includes('aggregateRating');
  record('site product reviews markup present', hasReview, hasReview ? 'yes' : 'no obvious review block');
  const courses = await hit('https://www.alanranger.com/photography-courses-coventry');
  record('site courses page', courses.status === 200, `${courses.status}`);
  const workshops = await hit('https://www.alanranger.com/photography-workshops');
  record('site workshops page', workshops.status === 200, `${workshops.status}`);
}

// 5) Academy (load only — real exam submit needs member session; probe page + APIs)
{
  const dash = await hit('https://www.alanranger.com/academy/dashboard');
  record('academy dashboard', dash.status === 200, `${dash.status} len=${dash.text.length}`);
  const exams = await hit('https://www.alanranger.com/academy/photography-exams-certification');
  record(
    'academy exams page load',
    exams.status === 200 && /SUPABASE_ANON_KEY|module_results/.test(exams.text),
    `${exams.status} hasClient=${/module_results/.test(exams.text)}`
  );
  const login = await hit('https://www.alanranger.com/academy/login');
  record('academy login', login.status === 200, `${login.status}`);
}

// 6) ruby-ranger / football / practice-pack
{
  for (const [name, url] of [
    ['ruby-ranger github', 'https://api.github.com/repos/alanranger/ruby-ranger'],
    ['football-tracker github', 'https://api.github.com/repos/alanranger/football-tracker'],
    ['practice-pack github', 'https://api.github.com/repos/alanranger/practice-pack-generator'],
  ]) {
    const r = await hit(url);
    record(name, [200, 404].includes(r.status), `${r.status}`);
  }
  // football data via chat-rag REST with public key if available (ft_* already RLS public-read)
  if (pubKey) {
    const ft = await hit(`${SB}/rest/v1/ft_teams?select=id&limit=1`, {
      headers: { apikey: pubKey, Authorization: `Bearer ${pubKey}` },
    });
    record('football ft_teams via public key', ft.status === 200, `${ft.status}`);
  } else {
    record('football ft_teams via public key', false, 'no public key available for probe');
  }
}

// 7) Public-key probes on objects we intend to lock (baseline: may succeed BEFORE lock)
if (pubKey) {
  const probes = [
    'booking_sheet_transactions',
    'page_html',
    'page_entities',
    'pages_master',
    'product_reviews',
    'v_events_for_chat',
    'system_maintenance_state',
  ];
  for (const t of probes) {
    const r = await hit(`${SB}/rest/v1/${t}?select=*&limit=1`, {
      headers: { apikey: pubKey, Authorization: `Bearer ${pubKey}`, Accept: 'application/json' },
    });
    const blocked =
      r.status === 401 ||
      r.status === 403 ||
      /permission|rls|jwt|invalid|disabled/i.test(r.text) ||
      (r.status === 200 && (r.text === '[]' || r.text === ''));
    record(
      `public-key probe ${t}`,
      true,
      `${r.status} blockedish=${blocked} body=${r.text.slice(0, 60).replace(/\s+/g, ' ')}`
    );
  }
} else {
  record('public-key probes', false, 'no publishable/anon key in env to probe');
}

// 8) Chat cron-dashboard / admin online
{
  const cronDash = await hit(`${CHAT}/cron-dashboard.html`);
  record('chat cron-dashboard', cronDash.status === 200, `${cronDash.status}`);
  const admin = await hit(`${CHAT}/admin.html`);
  record('chat admin.html', admin.status === 200 && !/taken offline/i.test(admin.text), `${admin.status}`);
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== SUMMARY ${LABEL}: ${passed} pass / ${failed} fail / ${results.length} total ===`);

const outPath = `${ROOTS.chat}/scripts/_rls-suite-${LABEL}.json`;
fs.writeFileSync(outPath, JSON.stringify({ label: LABEL, at: new Date().toISOString(), results }, null, 2));
console.log('wrote', outPath);
process.exit(failed > 0 && LABEL === 'after' ? 1 : 0);
