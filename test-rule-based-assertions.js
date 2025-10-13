/*
  Rules-based assertions for key queries.
  - No hard-coded URLs; use substring patterns representing canonical slugs.
  - Validate: required URL present, forbidden kinds excluded, answer quality, caps, confidence guardrails.
*/

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const API = process.env.CHAT_API_URL || 'https://alan-chat-proxy.vercel.app/api/chat';

const rules = [
  {
    name: 'Free online photography course',
    query: 'what is the free online photography course',
    requiredUrlContains: ['free-online-photography-course'],
    allowedKinds: ['landing','service'],
    forbiddenKinds: ['event','product'],
    requireWordsInTitle: ['free','online','course'],
    capEventsProducts: 3,
    minSentences: 2,
  },
  {
    name: 'Terms and conditions',
    query: 'where are your terms and conditions',
    requiredUrlContains: ['terms-and-conditions'],
    allowedKinds: ['landing','service'],
    forbiddenKinds: [],
    requireWordsInTitle: ['terms'],
    capEventsProducts: 0,
    minSentences: 1,
  },
  {
    name: 'About Alan Ranger',
    query: 'who is alan ranger',
    requiredUrlContains: ['about-alan-ranger'],
    allowedKinds: ['landing','service'],
    forbiddenKinds: ['event','product'],
    requireWordsInTitle: ['alan','ranger'],
    capEventsProducts: 0,
    minSentences: 1,
  }
];

function sentenceCount(text) {
  const s = String(text || '').trim();
  if (!s) return 0;
  return s.split(/(?<=[.!?])\s+/).filter(x => x.trim().length > 0).length;
}

function hasNoise(text) {
  const t = String(text || '').toLowerCase();
  return /(cart|sign in|my account|newsletter|subscribe|cookie)/.test(t);
}

function pickAllUrls(structured) {
  const out = [];
  const pushArr = arr => (arr||[]).forEach(e => out.push(e.page_url || e.url || e.href || ''));
  pushArr(structured?.landing);
  pushArr(structured?.services);
  pushArr(structured?.products);
  pushArr(structured?.events);
  pushArr(structured?.articles);
  return out.filter(Boolean);
}

async function runRule(rule) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: rule.query, pageContext: null })
  });
  const data = await res.json();

  const failures = [];

  // Required URL appears
  const urls = pickAllUrls(data.structured);
  const hasRequired = rule.requiredUrlContains.some(substr => urls.some(u => (u||'').includes(substr)) || String(data.answer_markdown||'').includes(substr));
  if (!hasRequired) failures.push(`missing required URL (${rule.requiredUrlContains.join(' OR ')})`);

  // Forbidden kinds
  for (const kind of rule.forbiddenKinds) {
    const arr = data.structured?.[kind+'s'] || data.structured?.[kind] || [];
    if (Array.isArray(arr) && arr.length > 0) failures.push(`forbidden kind present: ${kind}`);
  }

  // Caps
  if (rule.capEventsProducts === 0) {
    if ((data.structured?.events||[]).length) failures.push('events should be empty');
    if ((data.structured?.products||[]).length) failures.push('products should be empty');
  } else if (rule.capEventsProducts != null) {
    if ((data.structured?.events||[]).length > rule.capEventsProducts) failures.push(`too many events (> ${rule.capEventsProducts})`);
    if ((data.structured?.products||[]).length > rule.capEventsProducts) failures.push(`too many products (> ${rule.capEventsProducts})`);
  }

  // Title keywords (if we can find matching item)
  const head = (data.structured?.landing||[]).concat(data.structured?.services||[])[0] || null;
  if (rule.requireWordsInTitle?.length && head) {
    const title = String(head.title||'').toLowerCase();
    const ok = rule.requireWordsInTitle.every(w => title.includes(w));
    if (!ok) failures.push('title missing required words');
  }

  // Answer quality
  const answer = data.answer_markdown || '';
  if (rule.minSentences && sentenceCount(answer) < rule.minSentences) failures.push('answer too short');
  if (hasNoise(answer)) failures.push('answer contains navigation/noise');

  return { rule, failures, data };
}

(async () => {
  console.log(`Rules-based assertions against ${API}`);
  let failed = 0;
  for (const r of rules) {
    const { failures } = await runRule(r);
    if (failures.length) {
      failed++;
      console.log(`❌ ${r.name}: ${failures.join('; ')}`);
    } else {
      console.log(`✅ ${r.name}`);
    }
  }
  if (failed) {
    console.log(`\nFailures: ${failed}/${rules.length}`);
    process.exit(1);
  } else {
    console.log('\nAll rule-based assertions passed.');
  }
})();


