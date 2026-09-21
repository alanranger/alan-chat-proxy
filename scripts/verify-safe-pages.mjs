import fs from 'fs';
import path from 'path';

const pub = path.resolve('public');

// bulk message
{
  const f = path.join(pub, 'bulk-simple.html');
  let h = fs.readFileSync(f, 'utf8');
  const next = h.replace(
    /addResult\(['"][^'"]*Hardcoded token[^'"]*['"]\);/,
    "addResult('Token: paste when prompted (stored in this browser only)');"
  );
  fs.writeFileSync(f, next);
  console.log('bulk Hardcoded removed:', h.includes('Hardcoded token'), '->', next.includes('Hardcoded token'));
}

const files = [
  'admin.html', 'analytics.html', 'bulk-simple.html', 'chat.html',
  'cron-dashboard.html', 'interactive-testing.html', 'regression-comparison.html',
  'testbench-pro.html', 'admin-auth.js'
];

const bad = /eyJhbGci|W9tkTSYu|A9TCmnXK/;
for (const name of files) {
  const h = fs.readFileSync(path.join(pub, name), 'utf8');
  const hits = h.match(bad);
  const supabaseDirect = (h.match(/supabase\.co/g) || []).length;
  const createClient = (h.match(/createClient\(/g) || []).length;
  console.log(name, {
    leaked: !!hits,
    supabaseCo: supabaseDirect,
    createClient,
    bytes: h.length
  });
}
