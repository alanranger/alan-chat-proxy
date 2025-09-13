export const config = { runtime: 'edge' };

// Small helpers
const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const buildBase = (req) => {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return host ? `https://${host}` : '';
};

const clean = (s = '') =>
  s.replace(/\s+/g, ' ').replace(/\[[^\]]*\]\([^)]+\)/g, '').trim();

const fallbackAnswer = (query, matches) => {
  const byUrl = new Map();
  for (const m of matches || []) {
    if (!m?.url) continue;
    const g = byUrl.get(m.url) || { url: m.url, score: 0, contents: [] };
    g.score = Math.max(g.score, Number(m.score || 0));
    if (m.content) g.contents.push(m.content);
    byUrl.set(m.url, g);
  }
  const grouped = [...byUrl.values()].sort((a, b) => b.score - a.score);
  const top = grouped.slice(0, 3);

  const bullets = top
    .map((g, i) => {
      const snippet = clean((g.contents[0] || '').slice(0, 200));
      return `- (${i + 1}) ${g.url}\n  ${snippet || 'Relevant page.'}`;
    })
    .join('\n');

  if (!top.length) {
    return `I couldn't find relevant pages yet for “${query}”. Try a more specific question (e.g., “landscape workshops in Coventry”, “what to bring to a workshop”, “tuition prices”).`;
  }

  return [
    `Here’s a concise, source-backed answer to: “${query}”`,
    ``,
    `**What I found on Alan’s site:**`,
    bullets,
    ``,
    `If you’d like, ask me to summarise any of those pages or to compare options.`,
  ].join('\n');
};

const followUpsFor = (query) => {
  const q = (query || '').toLowerCase();
  const base = [
    'Beginner workshop?',
    'What to bring?',
    'Bluebell tips',
    'Tuition options',
  ];
  if (q.includes('tripod')) {
    base.unshift('Best travel tripod?', 'Tripod height & load tips');
  }
  if (q.includes('workshop')) {
    base.unshift('Dates near Coventry?', 'Landscape vs. Bluebell workshops');
  }
  return [...new Set(base)].slice(0, 5);
};

async function askLLM({ system, user }) {
  const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const useOpenAI = !!process.env.OPENAI_API_KEY;

  const payload = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  };

  if (useOpenRouter) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({ ...payload, model: 'openai/gpt-4o-mini' }),
    });
    if (r.ok) {
      const j = await r.json();
      return j?.choices?.[0]?.message?.content || '';
    }
  }
  if (useOpenAI) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ ...payload, model: 'gpt-4o-mini' }),
    });
    if (r.ok) {
      const j = await r.json();
      return j?.choices?.[0]?.message?.content || '';
    }
  }
  return ''; // no keys or both failed
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: 'bad_request', detail: 'Invalid JSON' });
  }

  const query = (body?.query || '').toString().slice(0, 1000);
  const topK = Math.max(1, Math.min(16, parseInt(body?.topK || '8', 10)));
  if (!query) return json(400, { ok: false, error: 'bad_request', detail: 'Provide "query".' });

  const base = buildBase(req);

  // 1) Retrieve context from your existing /api/tools search
  let matches = [];
  try {
    const r = await fetch(`${base}/api/tools?action=search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, topK }),
    });
    const j = await r.json().catch(() => ({}));
    if (Array.isArray(j?.matches)) matches = j.matches;
  } catch {}

  const citations = [...new Set(matches.map((m) => m?.url).filter(Boolean))].slice(0, 6);
  const context = matches
    .map((m, i) => `--- doc #${i + 1} (${m?.url || 'unknown'}) ---\n${clean(m?.content || '')}`)
    .slice(0, topK)
    .join('\n\n');

  // 2) Build prompt and try LLM (if keys present)
  const SYS = `You are "Alan Ranger Assistant", a helpful photography guide.
Write clear, concise answers with short bullets for steps or gear.
Always be grounded in the provided CONTEXT and cite sources by URL list at the end.
If the context is insufficient, say so briefly and suggest a follow-up question.`;

  const USER = `Question: ${query}

CONTEXT (from the site; may be partial):
${context}

Return markdown only. Use short bullets where useful. Keep it tight.`;

  let answer = '';
  const useLLM = !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
  if (useLLM) {
    try { answer = await askLLM({ system: SYS, user: USER }); } catch { answer = ''; }
  }

  // 3) If no LLM or it failed, provide a useful fallback from search results
  if (!answer) answer = fallbackAnswer(query, matches);

  return json(200, {
    ok: true,
    answer,
    citations,
    followUps: followUpsFor(query),
  });
}
