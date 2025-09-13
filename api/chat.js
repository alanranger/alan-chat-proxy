// /api/chat.js
export const config = { runtime: 'nodejs' };

/** Chat endpoint that:
 * 1) Calls our /api/tools?action=search to retrieve topK context snippets
 * 2) Asks the LLM to return STRICT JSON: { answer: string, citations: string[], followUps: string[] }
 * 3) Returns that JSON to the frontend
 *
 * It supports OpenRouter (preferred) or OpenAI — whichever key is present.
 * ENV required:  - OPENROUTER_API_KEY (preferred) OR OPENAI_API_KEY
 *                - VERCEL_URL (set automatically in prod) for calling /api/tools
 */

const need = (k) => {
  const v = process.env[k];
  if (!v || !v.trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const toJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj));
};

async function postJSON(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`llm_http_${r.status}:${text.slice(0, 2000)}`);
  }
  return r.json();
}

function getLLMConfig() {
  const orKey = process.env.OPENROUTER_API_KEY;
  const oaKey = process.env.OPENAI_API_KEY;
  if (!orKey && !oaKey) throw new Error('no_llm_provider_configured');

  if (orKey) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${orKey}` },
      model: 'openrouter/gpt-4o-mini', // light+cheap, tune to taste
    };
  }
  return {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: { Authorization: `Bearer ${oaKey}` },
    model: 'gpt-4o-mini',
  };
}

const SYS_PROMPT =
  `You are "Alan Ranger Assistant", a helpful photography guide and workshop assistant. ` +
  `Write concise, friendly answers. Use bullets for tips/steps/gear. Provide concrete next steps. ` +
  `Only use the provided context snippets. If you aren't sure, say so and suggest an action. ` +
  `Return STRICT JSON ONLY: {"answer": "...", "citations": ["..."], "followUps": ["..."]}`;

function cleaned(m) {
  return (m.content || '')
    .replace(/\s+/g, ' ')
    .slice(0, 1400); // keep the prompt small-ish
}

function buildUserPrompt(query, matches) {
  const lines = matches.map((m, i) =>
    `# Source ${i + 1} — ${m.url}\n${cleaned(m)}\n`);
  return [
    `User question: ${query}`,
    `Context snippets:\n${lines.join('\n')}`,
    `Return JSON ONLY. Keys: "answer" (markdown ok, no HTML, **bold** ok), "citations" (unique URLs), "followUps" (<=3 short suggestions).`,
  ].join('\n\n');
}

async function embedAndSearch(req, topK) {
  // Prefer absolute URL in prod
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

  // IMPORTANT: forward the Authorization header from the client
  const r = await fetch(`${base}/api/tools?action=search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization || '',
    },
    body: JSON.stringify({ query: req.body?.query || '', topK }),
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { error: text.slice(0, 1000) }; }

  if (!r.ok) throw new Error(`search_failed_${r.status}:${text.slice(0, 300)}`);
  return json;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return toJSON(res, 405, { error: 'method_not_allowed' });

    const query = (req.body?.query || '').trim();
    const topK = Math.max(1, Math.min(12, parseInt(req.body?.topK || '8', 10)));
    if (!query) return toJSON(res, 400, { error: 'bad_request', detail: 'Provide "query" string.' });

    // 1) retrieve context
    const matches = await embedAndSearch(req, topK);
    const seen = new Set();
    const context = (Array.isArray(matches?.matches) ? matches.matches : [])
      .slice(0, topK)
      .map(m => ({ url: m.url, content: m.content }))
      .filter(m => m.url && !seen.has(m.url) && seen.add(m.url));

    // 2) call LLM
    const { endpoint, headers, model } = getLLMConfig();
    const userPrompt = buildUserPrompt(query, context);

    const body = {
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYS_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };

    const j = await postJSON(endpoint, body, headers);
    const raw = j?.choices?.[0]?.message?.content || '';
    let out;
    try {
      out = JSON.parse(raw.trim());
    } catch (e) {
      // Try to salvage JSON if the model wrapped it in code fences
      const m = raw.match(/\{[\s\S]*\}/);
      out = m ? JSON.parse(m[0]) : null;
    }

    // Normalize
    const citations = Array.isArray(out?.citations) ? out.citations : [];
    const uniqCites = Array.from(new Set(citations.filter(Boolean))).slice(0, 6);
    const followUps = Array.isArray(out?.followUps) ? out.followUps : [];

    return toJSON(res, 200, {
      ok: true,
      answer: out?.answer || 'I could not produce an answer. Please try rephrasing your question.',
      citations: uniqCites,
      followUps: followUps.slice(0, 3),
    });
  } catch (err) {
    return toJSON(res, 500, { ok: false, error: 'server_error', detail: String(err) });
  }
}
