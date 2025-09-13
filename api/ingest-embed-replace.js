// /api/ingest-embed-replace.js
// Complete replacement file

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { htmlToText } from "html-to-text";

// -----------------------------
// RUNTIME (Vercel: Node runtime)
// -----------------------------
export const config = { runtime: "nodejs" };

// -----------------------------
// ENV validation
// -----------------------------
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// These must be present in your Vercel env
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// Optional:
// - OPENROUTER_API_KEY  (preferred)  or OPENAI_API_KEY (either provider works)
// - PUBLIC_SITE_URL (for OpenRouter header)  e.g. https://alan-chat-proxy.vercel.app
// - X_TITLE (for OpenRouter header)          e.g. Alan Chat Proxy
// - EMBED_MODEL  (optional override)

// Optional bearer token the UI sends (Authorization: Bearer <token>)
const INGEST_BEARER = process.env.INGEST_BEARER || process.env.INGEST_TOKEN || "";

// -----------------------------
// Supabase
// -----------------------------
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// -----------------------------
// Utility
// -----------------------------
function okJson(res, data) {
  res.setHeader("Content-Type", "application/json");
  return res.status(200).end(JSON.stringify(data));
}
function bad(res, code, msg, detail) {
  res.setHeader("Content-Type", "application/json");
  return res
    .status(code)
    .end(JSON.stringify({ error: msg, detail: detail ?? null }));
}

function getTitleFromHtml(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function normalizeWhitespace(s) {
  return s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

function chunkText(text, maxLen = 1800, overlap = 200) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxLen);
    out.push(text.slice(i, end));
    if (end >= text.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return out;
}

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// -----------------------------
// Embeddings (OpenRouter or OpenAI)
// -----------------------------
async function getEmbedding(inputText) {
  const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const baseUrl = useOpenRouter
    ? "https://openrouter.ai/api/v1/embeddings"
    : "https://api.openai.com/v1/embeddings";

  // Correct model id per provider
  const model =
    process.env.EMBED_MODEL ||
    (useOpenRouter ? "openai/text-embedding-3-small" : "text-embedding-3-small");

  const headers = {
    Authorization: `Bearer ${
      useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY
    }`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (useOpenRouter) {
    headers["HTTP-Referer"] =
      process.env.PUBLIC_SITE_URL || "https://alan-chat-proxy.vercel.app";
    headers["X-Title"] = process.env.X_TITLE || "Alan Chat Proxy";
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, input: inputText }),
  });

  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("application/json")) {
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(
      `embedding_non_json (status ${res.status}) :: ${bodyPreview.slice(0, 200)}`
    );
  }

  const json = await res.json();
  if (!json?.data?.[0]?.embedding) {
    throw new Error(
      `embedding_bad_payload :: ${JSON.stringify(json).slice(0, 200)}`
    );
  }
  return json.data[0].embedding;
}

// -----------------------------
// Main handler
// -----------------------------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return bad(res, 405, "method_not_allowed");
    }

    // Bearer auth (optional)
    if (INGEST_BEARER) {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token || token !== INGEST_BEARER) {
        return bad(res, 401, "unauthorized", "Invalid or missing bearer token.");
      }
    }

    let body;
    try {
      body = req.body ?? JSON.parse(await streamToString(req));
    } catch {
      return bad(res, 400, "invalid_json");
    }

    const url = (body?.url || "").trim();
    const titleOverride = (body?.title || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return bad(res, 400, "invalid_url", "Provide a valid absolute URL.");
    }

    // 1) Fetch page
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AlanCrawler/1.0; +https://alan-chat-proxy.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!pageRes.ok) {
      return bad(res, 502, "fetch_failed", `status=${pageRes.status}`);
    }

    const html = await pageRes.text();
    const pageTitle =
      titleOverride || getTitleFromHtml(html) || new URL(url).hostname;

    // 2) Extract text
    const text = normalizeWhitespace(
      htmlToText(html, {
        wordwrap: false,
        selectors: [
          // remove nav/footer/script/style by default rules
          { selector: "script", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "noscript", format: "skip" },
        ],
      })
    );

    if (!text || text.length < 20) {
      return bad(res, 422, "no_text_extracted");
    }

    // 3) Chunk
    const chunks = chunkText(text, 1800, 200);

    // 4) Replace strategy: delete previous chunks for this URL
    const del = await supa.from("page_chunks").delete().eq("url", url);
    if (del.error) {
      return bad(res, 500, "delete_failed", del.error.message);
    }

    // 5) Embed + insert
    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = await getEmbedding(chunkText);

      // hash per chunk for dedupe/debug
      const chunk_hash = sha256(`${url}::${i}::${chunkText.slice(0, 64)}`);

      rows.push({
        url,
        title: pageTitle,
        // table has both "content" and "chunk_text"; keep both consistent
        content: chunkText,
        chunk_text: chunkText,
        embedding, // pgvector (vector) column
        chunk_hash,
        // created_at defaults to now() on the table
      });
    }

    if (rows.length > 0) {
      const ins = await supa.from("page_chunks").insert(rows);
      if (ins.error) {
        return bad(res, 500, "insert_failed", ins.error.message);
      }
    }

    return okJson(res, {
      ok: true,
      url,
      title: pageTitle,
      chunks_inserted: rows.length,
    });
  } catch (err) {
    return bad(res, 500, "server_error", String(err));
  }
}

// For older runtimes that don’t auto-parse body
async function streamToString(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
