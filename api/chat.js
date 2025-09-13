// /api/chat.js
export const config = { runtime: 'nodejs' };

/**
 * RAG Chat endpoint:
 * 1) Calls /api/search to retrieve topK context snippets
 * 2) Asks the LLM to answer with markdown (+ citations)
 * 3) If the LLM returns nothing, fall back to a summary of the search matches
 *
 * Requires either:
 * - OPENROUTER_API_KEY (preferred)
 * - or OPENAI_API_KEY (and uses OpenAI directly)
 */

const base = (k) => {
  const v = process.env[k];
  if (!v || !v.trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const postJSON = async (url, body, headers = {}) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`llm_http_${r.status}:${t.slice(0, 400)}`);
  }
  return r.json();
};

function getLLMConfig() {
  const orKey = process.env.OPENROUTER_API_KEY;
  const oaKey = process.env.OPENAI_API_KEY;
  if (orKey) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${orKey}` },
      model: 'gpt-4o-mini', // change if you want another OpenRouter model
    };
  }
  if (oaKey) {
    return {
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${oaKey}` },
      model: 'gpt-4o-mini', // change to something you have access to
    };
  }
  throw new Error('no_llm_provider_configured');
}

// Prompt used for the assistant
const SYS_PROMPT =
  `You are "Alan Ranger Assistant", a helpful photography guide and workshop assistant for alanranger.com.
Write concise, friendly answers. Use bullet points for tips/steps/gear.
Provide context but *only* from the supplied page snippets.
Always include a short "Sources:" list with numeric markers [1], [2], … and return the actual URLs separately in "citations".
If the user is vague, ask 1 follow-up question at the end to clarify.`;

function buildUserPrompt(query, matches) {
  const items = matches.map((m, i) => {
    const u = m.url || '';
    const content = (m.content || '').replace(/\s+/g, ' ').trim();
    return `### Doc ${i + 1}\nURL: ${u}\nText:\n${content}\n`;
  }).join('\n');

  return `User question: ${query}

Context snippets:
${items}

INSTRUCTIONS:
- If the answer is present in the context, answer succinctly in markdown (bold, bullets ok).
- Include "Sources: [k]" markers inline, where k refers to the doc number(s) you used.
- Do not invent URLs. Do not cite anything not in the snippets.
- Then stop.`;
}

function fallbackFromMatches(matches, query) {
  if (!Array.isArray(matches) || !matches.length) {
    return {
      answer: "I couldn't find enough information in the indexed pages to answer that. Try rephrasing your question, or ask something about workshops, tuition, or photography tips.",
      citations: [],
      followUps: [],
      ok: true,
    };
  }

  // Make a terse answer by extracting 3–5 bullet lines from top matches
  const bullets = [];
  const urls = new Set();
  for (const m of matches.slice(0, 5)) {
    const text = (m.content || '').replace(/\s+/g, ' ').trim();
    if (text) {
      bullets.push(`- ${text.slice(0, 200)}…`);
    }
    if (m.url) urls.add(m.url);
  }

  const answer =
`**Here’s what I can gather from the site for "${query}":**

${bullets.join('\n')}

_Sources: ${[...urls].map((_, i) => `[${i + 1}]`).join(' ')}_`;
  return {
    answer,
    citations: [...urls],
    followUps: [],
    ok: true,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    const { query, topK = 8 } = (await req.json?.().catch(() => req.body)) || req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, error: 'bad_request', detail: 'Provide "query" string.' });
    }

    // 1) Retrieve context via your search API
    const searchUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''}/api/search`;
    const searchRes = await postJSON(searchUrl, { query, topK: Math.max(1, Math.min(16, Number(topK) || 8)) });
    const matches = Array.isArray(searchRes?.matches) ? searchRes.matches : [];

    if (!matches.length) {
      // Nothing found -> safe fallback
      return res.json(fallbackFromMatches([], query));
    }

    // 2) Try LLM with context
    const { endpoint, headers, model } = getLLMConfig();
    const userPrompt = buildUserPrompt(query, matches);
    const body = {
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYS_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    };
    const j = await postJSON(endpoint, body, headers);
    const raw = (j?.choices?.[0]?.message?.content || '').trim();

    // Extract answer + collect citations from URLs present in matches we used
    const known = new Set(matches.map(m => m.url).filter(Boolean));
    const citations = [...known].slice(0, 6);

    // If the LLM gave basically nothing, use fallback summary so we never say "I do not know."
    if (!raw || raw.length < 30) {
      return res.json(fallbackFromMatches(matches, query));
    }

    return res.json({
      ok: true,
      answer: raw,
      citations,
      followUps: [], // you can add generated follow-ups later
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(err) });
  }
}
