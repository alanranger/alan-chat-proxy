// /api/chat.js
export const config = { runtime: 'nodejs' }; // Vercel Hobby expects 'nodejs'

import { createHash } from 'node:crypto';

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

function hostBase(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString();
  const host  = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  return `${proto}://${host}`;
}

async function searchMatches(req, query, topK) {
  const base = hostBase(req);
  const r = await fetch(`${base}/api/tools?action=search`, {
    method: 'POST',
    headers: {
      'Authorization': req.headers['authorization'] || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, topK })
  });
  if (!r.ok) {
    return { ok: false, error: `search_failed:${r.status}` };
  }
  const j = await r.json();
  return { ok: true, data: j };
}

function buildPrompt(query, matches) {
  const uniqueByUrl = [];
  const seen = new Set();
  (matches || []).forEach((m) => {
    if (!m?.url) return;
    if (seen.has(m.url)) return;
    seen.add(m.url);
    uniqueByUrl.push(m);
  });

  const contextBlocks = uniqueByUrl.map((m, i) => {
    // cap context size per chunk to keep prompt small
    const content = (m.content || '').slice(0, 1200);
    return `[[${i+1}]] URL: ${m.url}\nCONTENT:\n${content}`;
  }).join('\n\n');

  const system = [
    'You are the helpful assistant for alanranger.com.',
    'Answer the user using ONLY the provided context blocks.',
    'If the answer is not in the context, say you do not know.',
    'Prefer concise, direct answers. Use bullet points if helpful.',
    'At the end, list the sources as [1], [2], ... referencing the blocks.'
  ].join(' ');

  const user = [
    `User question: ${query}`,
    '',
    'Context blocks:',
    contextBlocks || '(no context available)'
  ].join('\n');

  const citations = uniqueByUrl.map((m) => m.url);

  return { system, user, citations };
}

async function callLLM({ model, system, user }) {
  const oaKey = opt('OPENAI_API_KEY');
  const orKey = opt('OPENROUTER_API_KEY');

  if (!oaKey && !orKey) {
    throw new Error('no_llm_provider_configured');
  }

  if (oaKey) {
    // OpenAI
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${oaKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!r.ok) throw new Error(`openai_error:${r.status} ${await r.text()}`);
    const j = await r.json();
    const answer = j?.choices?.[0]?.message?.content?.trim() || '';
    return answer;
  }

  // OpenRouter
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${orKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // OpenRouter uses vendor-prefixed names for OpenAI models
      model: 'openai/gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  if (!r.ok) throw new Error(`openrouter_error:${r.status} ${await r.text()}`);
  const j = await r.json();
  const answer = j?.choices?.[0]?.message?.content?.trim() || '';
  return answer;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return toJSON(res, 405, { error: 'method_not_allowed' });

    const token = req.headers['authorization']?.toString().trim() || '';
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) return toJSON(res, 401, { error: 'unauthorized' });

    const { query, topK } = req.body || {};
    if (!query || typeof query !== 'string') return toJSON(res, 400, { error: 'bad_request', detail: 'Provide "query"' });

    const k = Math.max(1, Math.min(16, parseInt(topK || 8, 10)));

    const sr = await searchMatches(req, query, k);
    if (!sr.ok) return toJSON(res, 500, { error: sr.error || 'search_failed' });

    const matches = (sr.data && sr.data.matches) || [];
    const { system, user, citations } = buildPrompt(query, matches);

    const answer = await callLLM({ model: 'gpt-4o-mini', system, user });

    return toJSON(res, 200, { ok: true, answer, citations });
  } catch (err) {
    return toJSON(res, 500, { error: 'server_error', detail: err?.message || String(err) });
  }
}
