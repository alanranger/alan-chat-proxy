// /api/chat.js
export const config = { runtime: 'nodejs' };

/**
 * Chat endpoint that:
 *  1) Calls our /api/tools?action=search to retrieve topK context snippets
 *  2) Asks the LLM to return STRICT JSON:
 *     { answer: string, citations: string[], followUps: string[] }
 *  3) Returns that JSON to the frontend
 *
 * It supports OpenRouter (preferred) or OpenAI — whichever key is present.
 * ENV required: OPENROUTER_API_KEY (preferred) OR OPENAI_API_KEY
 */

const need = (k) => {
  const v = process.env[k];
  if (!v || !v.trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const toJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).send(JSON.stringify(obj));
};

async function postJSON(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(()=>'');
    throw new Error(`llm_http_${r.status}:${text.slice(0,300)}`);
  }
  return r.json();
}

function getLLMConfig() {
  const orKey = process.env.OPENROUTER_API_KEY;
  const oaKey = process.env.OPENAI_API_KEY;
  if (orKey) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${orKey}` },
      model: 'openai/gpt-4o-mini', // good, fast, inexpensive
    };
  }
  if (oaKey) {
    return {
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${oaKey}` },
      model: 'gpt-4o-mini',
    };
  }
  throw new Error('no_llm_provider_configured');
}

const SYS_PROMPT =
  `You are "Alan Ranger Assistant", a helpful photography guide and workshop assistant.
Write concise, friendly answers. Use bullets for tips/steps/gear. Provide concrete next steps.
Only use the provided context snippets. If you aren't sure, say so and suggest an action.
Return STRICT JSON ONLY:
{
  "answer": "<markdown-friendly text (no HTML; **bold** allowed; lists OK)>",
  "citations": ["https://..."],
  "followUps": ["short suggestion", "another suggestion"]
}`;

function buildUserPrompt(query, matches) {
  const lines = matches.map((m, i) => {
    const url = m?.url || '';
    const text = (m?.content || '').replace(/\s+/g,' ').slice(0, 1200);
    const score = m?.score ?? '';
    return `### Source ${i+1} [score=${score}] [url=${url}]
${text}`;
  }).join('\n\n');

  return `# User question:
${query}

# Context snippets:
${lines}

# Instructions
1) Answer using only the context above. If unknown, say "I do not know" and suggest 1 action.
2) Be concise; prefer short paragraphs and bullet points.
3) Include 2–5 citations chosen from the provided URLs (don't invent).
4) Also include 1–3 follow-up suggestions.`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return toJSON(res, 405, { ok:false, error: 'method_not_allowed' });

    const { query, topK = 8 } = req.body || {};
    if (!query || typeof query !== 'string') {
      return toJSON(res, 400, { ok:false, error:'bad_request', detail:'Provide "query" string.' });
    }

    // 1) retrieve context
    const authHeader = req.headers.authorization || '';
    const searchResp = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/tools?action=search`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': authHeader,  // forward Bearer from client
      },
      body: JSON.stringify({ query, topK }),
    });

    if (!searchResp.ok) {
      const t = await searchResp.text().catch(()=> '');
      return toJSON(res, 500, { ok:false, error:'search_failed_'+searchResp.status, detail:t.slice(0,500) });
    }
    const { matches = [] } = await searchResp.json();

    // 2) call LLM
    const cfg = getLLMConfig();
    const userPrompt = buildUserPrompt(query, matches);

    const body = {
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role:'system', content: SYS_PROMPT },
        { role:'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };

    const llm = await postJSON(cfg.endpoint, body, cfg.headers);

    // OpenRouter/OpenAI both put content here:
    const raw = llm?.choices?.[0]?.message?.content || '';
    let out = {};
    try { out = JSON.parse(raw); } catch(e) {
      // try to strip code fences if any
      const cleaned = raw.replace(/```json\s*|\s*```/g,'').trim();
      try { out = JSON.parse(cleaned); } catch { out = {}; }
    }

    // constrain citations to known URLs
    const known = new Set(matches.map(m => m?.url).filter(Boolean));
    const citations = (Array.isArray(out.citations) ? out.citations : [])
      .filter(u => known.has(u))
      .slice(0, 6);

    const followUps = Array.isArray(out.followUps) ? out.followUps.slice(0,3) : [];

    return toJSON(res, 200, {
      ok: true,
      answer: out.answer || 'I do not know.',
      citations,
      followUps,
    });

  } catch (err) {
    return toJSON(res, 500, { ok:false, error:'server_error', detail: String(err) });
  }
}
