// /api/chat.js
export const config = { runtime: 'nodejs' };

/**
 * Chat endpoint that:
 * 1) Calls your /api/search to retrieve topK context snippets
 * 2) Asks the LLM to return STRICT JSON:
 *    { answer: string[], citations: string[], followUps: string[] }
 * 3) Returns that JSON to the frontend
 *
 * It supports OpenRouter (preferred) or OpenAI — whichever key is present.
 * ENV required: ~ OPENROUTER_API_KEY (preferred) OR OPENAI_API_KEY ~
 * VERCEL_URL (set automatically in prod) for calling /api/search
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
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`llm_http_${r.status}:${text.slice(0, 200)}`);
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
      headers: { 'Authorization': `Bearer ${orKey}` },
      model: 'gpt-4o-mini',
    };
  }

  // Fallback to OpenAI
  return {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: { 'Authorization': `Bearer ${oaKey}` },
    model: 'gpt-4o-mini', // or 'gpt-4o-mini-2024-07-18' depending on your account
  };
}

const SYS_PROMPT = `You are "Alan Ranger Assistant", a helpful photography guide and workshop assistant.
Write concise, friendly answers. Use bullets for tips/steps/gear.
Provide concrete next steps. Only use the provided context snippets.
If there isn't enough info, say so and suggest an action. Return STRICT JSON ONLY:
{
  "answer": "markdown-friendly text (no HTML; **bold** ok; bullets ok)",
  "citations": ["https://..."],
  "followUps": ["short suggestion", "another suggestion"]
}
`;

function cleaned(m) {
  return (m.content || '')
    .replace(/\s+/g, ' ')
    .slice(0, 1400)               // Source ${i} Text: ${cleaned}
    .replace(/" /g, '\\"');
}

function buildUserPrompt(query, matches) {
  const lines = matches.map((m, i) =>
    `Source [${i + 1}] URL: ${m.url || 'N/A'} | Text: "${cleaned(m)}"`
  );
  return [
    `User question: ${query}`,
    `Context snippets:`,
    ...lines,
  ].join('\n');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return toJSON(res, 405, { error: 'method_not_allowed' });

    const { query, topK = 8 } = req.body || {};
    if (!query || typeof query !== 'string') {
      return toJSON(res, 400, { error: 'bad_request', detail: 'Provide "query" string.' });
    }

    // retrieve context
    const matches = await embedAndSearch(query, topK);
    // constrain citations to unique domains / first 4
    const citations = [...new Set(matches.map(m => m.url))].slice(0, 6);

    // 2) call LLM
    const cfg = getLLMConfig();
    const userPrompt = buildUserPrompt(query, matches);
    const body = {
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYS_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    };

    let raw = await postJSON(cfg.endpoint, body, cfg.headers);
    let out = { answer: 'I could not produce an answer. Please try rephrasing your question.', citations: citations, followUps: ["Show workshops near me", "Beginner camera settings", "Tuition and mentoring options"] };

    // OpenRouter & OpenAI both return .choices[].message.content
    const txt = (((raw || {}).choices || [])[0] || {}).message || {};
    const content = (txt.content || '').trim();

    // The model was asked to return JSON. Try to parse it; if fail, fall back to content.
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        out.answer = parsed.answer || out.answer;
        out.citations = (Array.isArray(parsed.citations) ? parsed.citations : out.citations).filter(u => citations.includes(u)).slice(0, 6);
        out.followUps = (Array.isArray(parsed.followUps) ? parsed.followUps : out.followUps).slice(0, 3);
      } else {
        out.answer = content;
      }
    } catch {
      out.answer = content || out.answer;
    }

    return toJSON(res, 200, { ok: true, ...out });

  } catch (err) {
    return toJSON(res, 500, { error: 'server_error', detail: String(err) });
  }
}

// --- helper: call your own /api/search to get topK matches ---
async function embedAndSearch(query, topK) {
  // Works both locally and on Vercel
  const base =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : '';

  const r = await fetch(`${base}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, topK })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`search_failed_${r.status}:${t.slice(0, 300)}`);
  }
  const j = await r.json();
  if (!Array.isArray(j.matches)) return [];
  const matches = (j.matches || []).map(m => ({
    url: m.url,
    content: m.content || ''
  }));
  return matches.slice(0, topK);
}
