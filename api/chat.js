// /api/chat.js
export const config = { runtime: 'nodejs' };

// -------- LLM provider config --------
function getLLMConfig() {
  const orKey = process.env.OPENROUTER_API_KEY;
  const oaKey = process.env.OPENAI_API_KEY;
  if (orKey) {
    return {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${orKey}` },
      model: 'gpt-4o-mini',
    };
  }
  if (oaKey) {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${oaKey}` },
      model: 'gpt-4o-mini',
    };
  }
  throw new Error('no_llm_provider_configured');
}

async function postJSON(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`http_${r.status}:${t.slice(0, 400)}`);
  }
  return r.json();
}

// Build absolute origin for server-side fetches
function getOrigin(req) {
  const proto =
    req.headers['x-forwarded-proto'] ||
    (process.env.VERCEL ? 'https' : 'http');
  const host =
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    process.env.VERCEL_URL;
  if (!host) throw new Error('cannot_resolve_origin');
  return `${proto}://${host}`;
}

// -------- Prompts / fallback --------
const SYS_PROMPT =
  `You are "Alan Ranger Assistant", a helpful photography guide and workshop assistant for alanranger.com. ` +
  `Write concise, friendly answers using only the supplied snippets. Use short bullet points for tips. ` +
  `Always include a "Sources: [1] [2] …" line referring to the snippets used.`;

function buildUserPrompt(query, matches) {
  const ctx = matches
    .map((m, i) => `### Doc ${i + 1}\nURL: ${m.url}\nText:\n${(m.content || '').replace(/\s+/g, ' ').trim()}\n`)
    .join('\n');
  return `User question: ${query}

Context snippets:
${ctx}

INSTRUCTIONS:
- Answer in markdown using only the context.
- Keep it concise, use bullets where helpful.
- Include "Sources: [k]" where k is the doc number(s) you used.`;
}

function fallbackFromMatches(matches, query) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      ok: true,
      answer:
        "I couldn't find enough information in the indexed pages to answer that. " +
        "Try rephrasing, or ask about workshops, tuition, or photography tips.",
      citations: [],
    };
  }
  const bullets = [];
  const urls = new Set();
  for (const m of matches.slice(0, 5)) {
    const txt = (m.content || '').replace(/\s+/g, ' ').trim();
    if (txt) bullets.push(`- ${txt.slice(0, 200)}…`);
    if (m.url) urls.add(m.url);
  }
  return {
    ok: true,
    answer: `**Here’s what I can gather for "${query}":**\n\n${bullets.join('\n')}\n\n_Sources: ${[...urls]
      .map((_, i) => `[${i + 1}]`)
      .join(' ')}_`,
    citations: [...urls],
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    // Body parsing (works whether Next parsed it or not)
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const query = (payload.query || '').toString();
    const topK = Math.max(1, Math.min(16, Number(payload.topK || 8)));

    if (!query) {
      return res.status(400).json({ ok: false, error: 'bad_request', detail: 'Provide "query".' });
    }

    // Resolve origin & bearer (so /api/search is authorized)
    const origin = getOrigin(req);
    const bearer =
      (req.headers.authorization && req.headers.authorization.split(' ')[1]) ||
      process.env.INGEST_BEARER || // set this on the server so public chat works
      '';

    // 1) Retrieve context from your search API (absolute URL + auth)
    const searchRes = await postJSON(
      `${origin}/api/search`,
      { query, topK },
      bearer ? { Authorization: `Bearer ${bearer}` } : {}
    );

    const matches = Array.isArray(searchRes?.matches) ? searchRes.matches : [];
    if (!matches.length) {
      return res.json(fallbackFromMatches([], query));
    }

    // 2) Ask the LLM with context
    const { endpoint, headers, model } = getLLMConfig();
    const llm = await postJSON(
      endpoint,
      {
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYS_PROMPT },
          { role: 'user', content: buildUserPrompt(query, matches) },
        ],
      },
      headers
    );

    const raw = (llm?.choices?.[0]?.message?.content || '').trim();
    const citations = [...new Set(matches.map(m => m.url).filter(Boolean))].slice(0, 6);

    if (!raw || raw.length < 30) {
      return res.json(fallbackFromMatches(matches, query));
    }

    return res.json({ ok: true, answer: raw, citations });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(err) });
  }
}
