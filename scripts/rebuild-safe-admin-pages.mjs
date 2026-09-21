/**
 * Rebuild quarantined admin HTML into public/ with secrets stripped.
 * Usage: node scripts/rebuild-safe-admin-pages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'quarantine-leaked-html-2026-09-21');
const outDir = path.join(root, 'public');

const JWT_RE = /eyJ[A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+/g;
const PAGES = [
  'admin.html',
  'analytics.html',
  'bulk-simple.html',
  'chat.html',
  'cron-dashboard.html',
  'interactive-testing.html',
  'regression-comparison.html',
  'testbench-pro.html'
];

const AUTH_TAG = '<script src="/admin-auth.js"></script>\n';

function injectAuth(html) {
  if (html.includes('/admin-auth.js')) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, AUTH_TAG + '</head>');
  }
  return AUTH_TAG + html;
}

function stripJwts(html) {
  return html.replace(JWT_RE, '');
}

function patchAdmin(html) {
  return html
    .replace(
      /const adminToken = ['"][^'"]*['"];\s*\n\s*function getAdminToken\(\)\s*\{\s*return adminToken;\s*\}/m,
      `function getAdminToken() {\n      return window.AdminAuth.ensureToken();\n    }`
    )
    .replace(/'Authorization': 'Bearer ' \+ getAdminToken\(\)/g, `'Authorization': window.AdminAuth.bearer()`);
}

function patchAnalytics(html) {
  return html.replace(
    /'Authorization':\s*'Bearer\s*'?/g,
    (m) => m // noop guard
  ).replace(/'Authorization': 'Bearer '/g, `'Authorization': window.AdminAuth.bearer() || 'Bearer '`)
    // After JWT strip, Bearer lines look like: 'Authorization': 'Bearer '
    .replace(/'Authorization': 'Bearer '/g, `'Authorization': window.AdminAuth.bearer()`)
    .replace(/'Authorization': 'Bearer ',\s*/g, `'Authorization': window.AdminAuth.bearer(),\n`);
}

function patchBulk(html) {
  let out = html.replace(
    /function getToken\(\)\s*\{\s*\/\/[^\n]*\n\s*return ['"][^'"]*['"];\s*\}/m,
    `function getToken() {\n      return window.AdminAuth.ensureToken();\n    }`
  );
  out = out.replace(
    /<div class="status success">✅ Token: b6c3f0c9e6f44cce9e1a4f3f2d3a5c76 \(Hardcoded\)<\/div>/,
    '<div class="status info">Token: enter once when prompted (stored in this browser only)</div>'
  );
  // Block direct Supabase REST with admin token-as-apikey
  out = out.replace(
    /async function restCount\(path\) \{[\s\S]*?\n {4}\}/m,
    `async function restCount(path) {\n      console.warn('restCount disabled — use /api/tools (no direct Supabase keys in browser)', path);\n      return 0;\n    }`
  );
  return out;
}

function patchChat(html) {
  return html
    .replace(/'Authorization': 'Bearer '/g, `'Authorization': window.AdminAuth.bearer()`)
    .replace(/'Authorization': "Bearer "/g, `'Authorization': window.AdminAuth.bearer()`);
}

function patchCron(html) {
  let out = html.replace(
    /const DEFAULT_TOKEN = ['"][^'"]*['"];/g,
    `const DEFAULT_TOKEN = '';`
  );
  out = out.replace(
    /placeholder="Enter admin token \(default: b6c3f0c9e6f44cce9e1a4f3f2d3a5c76\)" value="b6c3f0c9e6f44cce9e1a4f3f2d3a5c76"/,
    'placeholder="Paste INGEST_TOKEN or admin token" value=""'
  );
  out = out.replace(
    /let authToken = localStorage\.getItem\('cron_dashboard_token'\) \|\| DEFAULT_TOKEN;/,
    `let authToken = localStorage.getItem('cron_dashboard_token') || window.AdminAuth.getToken() || DEFAULT_TOKEN;`
  );
  // After successful token entry, mirror into AdminAuth
  out = out.replace(
    /localStorage\.setItem\('cron_dashboard_token',\s*([^)]+)\);/g,
    (full, expr) =>
      `localStorage.setItem('cron_dashboard_token', ${expr});\n          if (window.AdminAuth) window.AdminAuth.setToken(${expr});`
  );
  return out;
}

function patchInteractive(html) {
  return html
    .replace(/keyInput\.value = ['"][^'"]*['"];/g, `keyInput.value = '';`)
    .replace(
      /urlInput\.value = 'https:\/\/igzvwbvgvmzvvzoclufx\.supabase\.co';/,
      `urlInput.value = '';`
    );
}

function patchRegression(html) {
  return html
    .replace(
      /<textarea id="supabaseKey"[^>]*>[^<]*<\/textarea>/,
      '<textarea id="supabaseKey" rows="3" style="resize:vertical;" placeholder="Paste publishable/anon key only if needed — prefer /api routes"></textarea>'
    )
    .replace(/keyInput\.value = ['"][^'"]*['"];/g, `keyInput.value = '';`)
    .replace(
      /urlInput\.value = 'https:\/\/igzvwbvgvmzvvzoclufx\.supabase\.co';/,
      `urlInput.value = localStorage.getItem('regression_supabase_url') || '';`
    );
}

function patchTestbench(html) {
  return html.replace(
    /async function callRpc\(query\)\{[^}]+\{ events:ev\.data\|\|\[\] \} \}/,
    `async function callRpc(query){ console.warn('Direct Supabase RPC removed from browser'); return { events: [], disabled: true }; }`
  );
}

const patchers = {
  'admin.html': patchAdmin,
  'analytics.html': patchAnalytics,
  'bulk-simple.html': patchBulk,
  'chat.html': patchChat,
  'cron-dashboard.html': patchCron,
  'interactive-testing.html': patchInteractive,
  'regression-comparison.html': patchRegression,
  'testbench-pro.html': patchTestbench
};

let failed = 0;
for (const name of PAGES) {
  const src = path.join(srcDir, name);
  const dest = path.join(outDir, name);
  if (!fs.existsSync(src)) {
    console.error('missing', src);
    failed++;
    continue;
  }
  let html = fs.readFileSync(src, 'utf8');
  html = stripJwts(html);
  html = injectAuth(html);
  const patch = patchers[name];
  if (patch) html = patch(html);
  const left = html.match(JWT_RE);
  if (left && left.length) {
    console.error(name, 'still has JWTs:', left.length);
    failed++;
  }
  // Safety: no service_role-looking hardcoded long secrets
  if (/W9tkTSYu6Wml0mUr|A9TCmnXKJhDRYBkr/.test(html)) {
    console.error(name, 'still has known leaked key fragments');
    failed++;
  }
  fs.writeFileSync(dest, html, 'utf8');
  console.log('wrote', name, 'bytes=', html.length);
}

if (failed) {
  console.error('FAILED checks:', failed);
  process.exit(1);
}
console.log('OK — all pages rebuilt');
