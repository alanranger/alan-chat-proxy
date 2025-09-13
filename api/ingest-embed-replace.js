// /api/ingest-embed-replace.js
// Complete, robust replacement (OpenRouter->OpenAI fallback if non-JSON)

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

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// Optional: either (or both) providers
const HAS_OPENROUTER = !!process.env.OPENROUTER_API_KEY;
const HAS_OPENAI     = !!process.env.OPENAI_API_KEY;

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "https://alan-chat-proxy.vercel.app";
const X_TITLE         = process.env.X_TITLE || "Alan Chat Proxy";

// Optional bearer for UI
const INGEST_BEARER = process.env.INGEST_BEARER || process.env.INGEST_TOKEN || "";

// Optional override for model id
const EMBED_MODEL = process.env.EMBED_MODEL || null;

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
  return res.status(code).end(JSON.stringify({ error: msg, detail: detail ?? null }));
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
    i = Math.max(0, end - overlap);
  }
  return out;
}
function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// -----------------------------
// Embeddings providers
// -----------------------------
async function callOpenRouterEmbedding(inputText) {
  if (!HAS_OPENROUTER) throw new Error("missing_openrouter_key");

  // Model name: OpenAI family routed via OpenRouter
  const model = EMBED_MODEL || "openai/text-embedding-3-small";

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      // OpenRouter prefers these:
      Referer: PUBLIC_SITE_URL,
      "HTTP-Referer": PUBLIC_SITE_URL,
      "X-Title": X_TITLE,
    },
    body: JSON.stringify({ model, input: inputText }),
  });

  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("application/json")) {
    const preview = await res.text().catch(() => "");
    // Important: bubble this up so the caller can decide to fallback
    const err = new Error(
      `openrouter_embedding_non_json (status ${res.status}) :: ${preview.slice(0, 300)}`
    );
    err.status = res.status;
    err.nonJson = true;
    throw err;
  }

  const json = await res.json();
  if (!json?.data?.[0]?.embedding) {
    throw new Error(`openrouter_embedding_bad_payload :: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data[0].embedding;
}

async function callOpenAIEmbedding(inputText) {
  if (!HAS_OPENAI) throw new Error("missing_openai_key");

  const model = EMBED_MODEL || "text-embedding-3-small";
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ model, input: inputText }),
  });

  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("application/json")) {
    const preview = await res.text().catch(() => "");
    const err = new Error(
      `openai_embedding_non_json (status ${res.status}) :: ${preview.slice(0, 300)}`
    );
    err.status = res.status;
    err.nonJson = true;
    throw err;
  }

  const json = await res.json();
  if (!json?.data?.[0]?.embedding) {
    throw new Error(`openai_embedding_bad_payload :: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data[0].embedding;
}

/**
 * Unified embedding call:
 * - Try OpenRouter first (if configured).
 * - If response is non-JSON (your exact failure), automatically fall back to OpenAI (if configured).
 */
async function getEmbedding(inputText) {
  let firstError = null;

  if (HAS_OPENROUTER) {
    try {
      return await callOpenRouterEmbedding(inputText);
    } catch (err) {
      firstError = err;
      // Only fallback on "non-json" (HTML page, Cloud/SaaS splash, etc.)
      if (!(err && err.nonJson) && !HAS_OPENAI) {
        throw new Error(`openrouter_failed_no_fallback :: ${String(err)}`);
      }
      // else try OpenAI
    }
  }

  if (HAS_OPENAI) {
    try {
      return await callOpenAIEmbedding(inputText);
    } catch (err) {
      // If we previously tried OpenRouter, include that detail too.
      if (firstError) {
        throw new Error(
          `openrouter_then_openai_failed :: first="${String(firstError)}" ; second="${String(err)}"`
        );
      }
      throw err;
    }
  }

  // No providers configured
  throw new Error("no_embedding_provider_configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)");
}

// -----------------------------
// Handler
// -----------------------------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return bad(res, 405, "method_not_allowed");

    if (INGEST_BEARER) {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token || token !== INGEST_BEARER) {
        return bad(res, 401, "unauthorized", "Invalid or missing bearer token.");
      }
    }

    // Parse body (works with JSON body or raw stream)
    let body = req.body;
    if (!body || typeof body !== "object") {
      body = JSON.parse(await streamToString(req));
    }

    const url = (body?.url || "").trim();
    const titleOverride = (body?.title || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return bad(res, 400, "invalid_url", "Provide a valid absolute URL.");
    }

    // 1) Fetch page HTML
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

    // 4) Replace per URL
    const del = await supa.from("page_chunks").delete().eq("url", url);
    if (del.error) return bad(res, 500, "delete_failed", del.error.message);

    // 5) Embed + insert
    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = await getEmbedding(chunkText);
      const chunk_hash = sha256(`${url}::${i}::${chunkText.slice(0, 64)}`);

      rows.push({
        url,
        title: pageTitle,
        content: chunkText,
        chunk_text: chunkText,
        embedding,
        chunk_hash,
      });
    }

    if (rows.length) {
      const ins = await supa.from("page_chunks").insert(rows);
      if (ins.error) return bad(res, 500, "insert_failed", ins.error.message);
    }

    return okJson(res, {
      ok: true,
      url,
      title: pageTitle,
      chunks_inserted: rows.length,
      provider: HAS_OPENROUTER ? (HAS_OPENAI ? "openrouter->maybe_fallback" : "openrouter") : "openai",
    });
  } catch (err) {
    return bad(res, 500, "server_error", String(err));
  }
}

async function streamToString(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}
