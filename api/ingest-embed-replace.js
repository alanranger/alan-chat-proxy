// /api/ingest-embed-replace.js

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { htmlToText } from "html-to-text";

/** Read JSON body safely (works whether pre-parsed or stream). */
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

/** Fetch a page and return { html, finalUrl } */
async function fetchHtml(targetUrl) {
  const r = await fetch(targetUrl, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const html = await r.text();
  return { html, finalUrl: r.url || targetUrl };
}

/** Extract a reasonable title from HTML */
function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

/** Convert HTML -> plain text */
function extractText(html) {
  return htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "noscript", format: "skip" },
    ],
  });
}

/** Very simple paragraph-based chunking (~1200–1600 chars). */
function chunkText(text, { minChars = 800, maxChars = 1600 } = {}) {
  const paras = text
    .split(/\n{2,}/g)
    .map(s => s.trim())
    .filter(Boolean);

  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length <= maxChars) {
      cur = cur ? cur + "\n\n" + p : p;
    } else {
      if (cur) chunks.push(cur);
      cur = p.length > maxChars ? p.slice(0, maxChars) : p;
    }
  }
  if (cur) chunks.push(cur);

  if (chunks.length >= 2 && chunks[chunks.length - 1].length < minChars) {
    const last = chunks.pop();
    chunks[chunks.length - 1] = chunks[chunks.length - 1] + "\n\n" + last;
  }
  return chunks;
}

/** Create embeddings via OpenRouter (preferred) or OpenAI fallback. */
async function embedBatch(inputs) {
  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
  const openAIKey = process.env.OPENAI_API_KEY || "";
  const useOpenRouter = !!openRouterKey;
  const apiKey = useOpenRouter ? openRouterKey : openAIKey;

  if (!apiKey) {
    const err = new Error("no_embedding_provider_configured");
    err.status = 500;
    throw err;
  }

  const endpoint = useOpenRouter
    ? "https://openrouter.ai/api/v1/embeddings"
    : "https://api.openai.com/v1/embeddings";

  const model = "text-embedding-3-small";

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: inputs }),
  });

  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    const txt = await r.text();
    const err = new Error("embedding_non_json");
    err.status = 502;
    err.detail = (txt || "").slice(0, 600);
    throw err;
  }

  const json = await r.json();
  if (!json || !Array.isArray(json.data)) {
    const err = new Error("embedding_malformed_response");
    err.status = 502;
    err.detail = json;
    throw err;
  }

  return json.data.map(d => d.embedding);
}

/** Save chunks to Supabase (table: page_chunks). */
async function saveChunksToSupabase({ url, title, chunks, vectors }) {
  const supa = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const rows = chunks.map((content, i) => ({
    url,
    title,
    content,
    chunk_text: content,
    embedding: vectors[i],
    chunk_hash: createHash("sha256").update(`${url}|${i}|${content}`).digest("hex"),
  }));

  const { data, error } = await supa
    .from("page_chunks")
    .upsert(rows, { onConflict: "chunk_hash" })
    .select("id")
    .order("id", { ascending: true });

  if (error) {
    const err = new Error("supabase_upsert_failed");
    err.status = 500;
    err.detail = error;
    throw err;
  }

  return data || [];
}

/** Handler */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const expected = process.env.INGEST_TOKEN || "";
    const auth = req.headers.authorization || "";
    if (!expected || auth !== `Bearer ${expected}`) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const body = await readJsonBody(req);
    const url = body?.url?.trim?.();
    if (!url) return res.status(400).json({ error: "bad_request", detail: `Provide "url"` });

    const { html, finalUrl } = await fetchHtml(url);
    const title = extractTitle(html) || finalUrl;
    const text = extractText(html);

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(200).json({ ok: true, id: null, len: 0, chunks: 0 });
    }
    const vectors = await embedBatch(chunks);

    const inserted = await saveChunksToSupabase({
      url: finalUrl,
      title,
      chunks,
      vectors,
    });

    const firstId = inserted?.[0]?.id ?? null;

    return res.status(200).json({
      ok: true,
      id: firstId,
      len: text.length,
      chunks: chunks.length
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      error: "server_error",
      code: err.message || "unknown_error",
      detail: err.detail ?? String(err),
    });
  }
}
