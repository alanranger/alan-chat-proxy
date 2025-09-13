// /api/chat.js
export const config = { runtime: 'nodejs' };

/**
 * Chat endpoint that:
 * 1) Calls /api/search to retrieve topK context snippets
 * 2) Asks the LLM to return STRICT JSON:
 *    { answer: string[], citations: string[], followUps: string[] }
 * 3) Returns that JSON to the frontend
 *
 * Supports OpenRouter (preferred) or OpenAI — whichever key is present.
 *
 * Required env:
 * - OPENROUTER_API_KEY (preferred) OR OPENAI_API_KEY
 * - VERCEL_URL (set automatically in prod) for calling /api/search
 */

const need = (k) => {
  const v = process.env[k];
  if (!v || !v.trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const opt = (k) => process.env[k] || '';

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
  const orKey = opt('OPENROUTER_API_KEY');
  const oaKey = opt('OPENAI_API_KEY');
  if (!orKey && !oaKey) throw new Error('no_llm_provider_configured');

  if (orKey) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${orKey}` },
      model: 'openai/gpt-4o-mini', // inexpensive, concise
    };
  }
  return {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: { Authorization: `Bearer ${oaKey}` },
    model: 'gpt-4o-mini',
  };
}

const SYS_PROMPT = `
You are "Alan Ranger Assistant", a helpful photography guide and workshop assistant.
Write concise, friendly answers. Prefer short sections and bullet lists for tips/steps/gear.
Cite only from the provided context (with URLs). If insufficient context, say so and suggest the
best next step (e.g., "try a different question" or "share a specific page to ingest").
Return STRICT JSON ONLY (no prose) in this shape:

{
  "answer": "markdown-friendly text (no HTML)",
  "citations": ["https://...", "..."],
  "followUps": ["next suggestion", "another suggestion"]
}
`.trim();

function buildUserPrompt(query, matches) {
  const lines = matches.map((m, i) => {
    const clean = (m.content || '')
      .replace(/\s+/g, ' ')
      .slice(0, 1200); // keep context tidy but long enough
    return `#${i + 1} ${m.url}\n${clean}\n`;
  });
  return `
User question: ${query}

Context snippets:
${lines.join('\n')}
`.trim();
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return toJSON(res, 405, { error: 'method_not_allowed' });

    const { query, topK = 8 } = req.body || {};
    if (!query || typeof query !== 'string') {
      return toJSON(res, 400, { error: 'bad_request', detail: 'Provide "query" string.' });
    }

    // 1) retrieve context
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : '';
    const searchURL = base ? `${base}/api/search` : '/api/search';

    const searchRes = await postJSON(searchURL, { query, topK });
    const matches = Array.isArray(searchRes?.matches) ? searchRes.matches : [];

    // 2) call LLM
    const { endpoint, headers, model } = getLLMConfig();
    const userPrompt = buildUserPrompt(query, matches);

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

    // 3) parse JSON output
    const raw =
      j?.choices?.[0]?.message?.content?.trim?.() ||
      '';
    let out;
    try {
      out = JSON.parse(raw);
    } catch {
      // if model returns a JSON-ish string in a code block, try to rescue it
      const rescued = raw
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      out = JSON.parse(rescued);
    }

    // constrain citations to ingested URLs only
    const known = new Set(matches.map(m => m.url));
    out.citations = (Array.isArray(out.citations) ? out.citations : [])
      .filter(u => known.has(u))
      .slice(0, 6);

    // follow-ups are optional, keep short
    out.followUps = Array.isArray(out.followUps) ? out.followUps.slice(0, 3) : [];

    return toJSON(res, 200, {
      ok: true,
      query,
      answer: out.answer || '',
      citations: out.citations || [],
      followUps: out.followUps || [],
    });
  } catch (err) {
    return toJSON(res, 500, { error: 'server_error', detail: String(err) });
  }
}
