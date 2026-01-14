// api/search/query.js
// AR Site Search API (Monocle replacement backend) | v1.1
// Supports GET/POST, adds CORS headers, handles OPTIONS, returns JSON on all paths.
//
// Why: Squarespace pages call this from the browser, so the response must include CORS headers.
// Vercel functions do not set CORS automatically.

export const config = { runtime: 'nodejs' };

import { runSearch } from "../lib/search-core.js";

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allow = new Set([
    "https://alanranger.com",
    "https://www.alanranger.com",
  ]);

  // If the Origin matches allowlist, echo it back. Otherwise default to primary site.
  res.setHeader("Access-Control-Allow-Origin", allow.has(origin) ? origin : "https://alanranger.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function readQuery(req) {
  if (req.method === "GET") {
    const q = (req.query?.q || "").toString();
    const limitRaw = (req.query?.limit || "").toString();
    return { q, limitRaw };
  }

  // POST
  const q = (req.body?.q || "").toString();
  const limitRaw = (req.body?.limit || "").toString();
  return { q, limitRaw };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { q, limitRaw } = readQuery(req);
  const query = (q || "").trim();

  let limit = Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 24;
  limit = Math.max(1, Math.min(60, limit)); // keep it sane

  if (!query) {
    return res.status(400).json({ ok: false, error: "Missing query param 'q'." });
  }

  try {
    const result = await runSearch({ q: query, limit });
    // Expected shape:
    // { ok:true, q, confidence, structured:{ intent, events, services, articles, products, landing } }
    return res.status(200).json(result);
  } catch (err) {
    const message = err?.message ? err.message : String(err);
    console.error("[api/search/query] error:", err);

    // Always JSON (do not return HTML), so the Squarespace page can show the error message.
    return res.status(500).json({
      ok: false,
      error: "Search failed",
      message,
    });
  }
}
