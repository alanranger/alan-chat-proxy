// /api/ingest-embed-replace.js
// Node serverless API for: crawl => chunk => embed => replace rows in Supabase
// ESM (package.json has "type": "module")

import crypto from "node:crypto";
import { htmlToText } from "html-to-text";
import fetch from "node-fetch"; // fallback; Vercel Node has global fetch
import { createClient } from "@supabase/supabase-js";

// ---------- Config & guards ----------
const {
  INGEST_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  OPENROUTER_API_KEY,
  OPENAI_API_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Use OpenRouter if present; else OpenAI
const provider = OPENROUTER_API_KEY
  ? "openrouter"
  : OPENAI_API_KEY
  ? "openai"
  : null;

const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims (matches your DB)
const DIM = 1536;

// Small/robust chunker (no tokenizers needed)
function chunkText(txt, target = 1800, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < txt.length) {
    const end = Math.min(i + target, txt.length);
    const slice = txt.slice(i, end).trim();
    if (slice) chunks.push(slice);
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

// Try to be ultra-lenient in accepting URL from query/body
async function readUrlFromRequest(req) {
  let searchUrl;
  try {
    searchUrl = new URL(req.url, "http://local");
  } catch {
    searchUrl = null;
  }
  const q = searchUrl?.searchParams?.get("url");
  if (q) return q;

  let bodyText = "";
  if (typeof req.body === "string") {
    bodyText = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    bodyText = req.body.toString("utf8");
  } else if (req.body && typeof req.body === "object") {
    if (req.body.url) return String(req.body.url);
  } else {
    try {
      bodyText = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (c) => (data += c));
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });
    } catch {}
  }

  if (bodyText) {
    try {
      const j = JSON.parse(bodyText);
      if (j?.url) return String(j.url);
    } catch {
      const m = bodyText.match(/(?:^|&)url=([^&]+)/i);
      if (m) return decodeURIComponent(m[1]);
    }
  }
  return undefined;
}

// Fetch page, convert to text
async function fetchPageAsText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; AlanCrawler/1.0; +https://alanranger.com)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    const detail = `Fetch failed with status ${res.status}`;
    const body = await res.text().catch(() => "");
    throw {
      status: res.status,
      error: "fetch_failed",
      detail,
      snippet: body?.slice(0, 300),
    };
  }
  const html = await res.text();
  const text = htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "noscript", format: "skip" },
    ],
  });
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = m ? m[1].trim() : null;
  return { text: text.trim(), title };
}

async function getEmbeddings(inputTexts) {
  if (!provider) {
    throw {
      status: 500,
      error: "no_embedding_provider_configured",
      detail: "Set OPENROUTER_API_KEY or OPENAI_API_KEY.",
    };
  }

  if (provider === "openrouter") {
    const r = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "x-title": "AlanRanger-Indexer",
      },
      body: JSON.stringify({
        model: `openai/${EMBED_MODEL}`,
        input: inputTexts,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.data) {
      throw {
        status: r.status || 500,
        error: "embedding_non_json",
        detail:
          j?.error?.message ||
          j?.message ||
          "Unexpected embedding response from OpenRouter",
        raw: j,
      };
    }
    return j.data.map((d) => d.embedding);
  }

  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputTexts,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.data) {
    throw {
      status: r.status || 500,
      error: "embedding_non_json",
      detail:
        j?.error?.message ||
        j?.message ||
        "Unexpected embedding response from OpenAI",
      raw: j,
    };
  }
  return j.data.map((d) => d.embedding);
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

// ---------- Handler ----------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res
        .status(405)
        .json({ error: "method_not_allowed", detail: "Use POST." });
      return;
    }

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!INGEST_TOKEN || token !== INGEST_TOKEN) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const url = await readUrlFromRequest(req);
    if (!url) {
      res.status(400).json({ error: "bad_request", detail: 'Provide "url"' });
      return;
    }

    const { text, title } = await fetchPageAsText(url);
    if (!text || text.length < 40) {
      res.status(422).json({
        error: "empty_content",
        detail: "Fetched page has no extractable text.",
      });
      return;
    }

    const chunks = chunkText(text, 1800, 200);
    if (chunks.length === 0) {
      res.status(422).json({ error: "no_chunks" });
      return;
    }

    const embeddings = await getEmbeddings(chunks);
    if (embeddings.length !== chunks.length) {
      throw {
        status: 500,
        error: "embedding_mismatch",
        detail: "Embeddings length != chunks length",
      };
    }

    await supabase.from("page_chunks").delete().eq("url", url);

    const rows = chunks.map((content, i) => ({
      url,
      title,
      content,
      embedding: embeddings[i],
      chunk_hash: sha1(content),
    }));

    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("page_chunks").insert(batch);
      if (error) {
        throw {
          status: 500,
          error: "db_insert_failed",
          detail: error.message || String(error),
        };
      }
    }

    res.status(200).json({
      ok: true,
      url,
      title,
      chunks: rows.length,
      dims: DIM,
      provider,
    });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({
      error: err?.error || "server_error",
      detail: err?.detail || (err?.message ? String(err.message) : String(err)),
    });
  }
}

// Force Node runtime on Vercel (NOT edge)
export const config = { runtime: "nodejs" };
