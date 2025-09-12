// /api/ingest.js
// Ingests page chunks and stores them idempotently.
// Uses (url, chunk_hash) uniqueness so re-runs do NOT duplicate rows.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function md5(text) {
  return crypto.createHash("md5").update(text || "", "utf8").digest("hex");
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Parse body (handles raw string or parsed JSON)
  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "invalid-json" });
  }

  const { url, title, chunks } = payload || {};
  if (!url || !Array.isArray(chunks))
    return res
      .status(400)
      .json({ error: "missing-fields", detail: "url + chunks[] required" });

  // Normalize into rows and compute chunk_hash
  const rows = chunks
    .map((c) => (typeof c === "string" ? { chunk_text: c } : c))
    .map(({ chunk_text, text }) => {
      const t = (chunk_text ?? text ?? "").toString();
      if (!t.trim()) return null;
      return {
        url,
        title: title ?? null,
        chunk_text: t,
        chunk_hash: md5(t),
        embedding: null, // will backfill later
      };
    })
    .filter(Boolean);

  if (!rows.length)
    return res.status(200).json({ inserted: 0, skipped: 0, note: "no rows" });

  // Idempotent write: DO NOTHING on conflict (url,chunk_hash)
  const { error } = await supabase
    .from("page_chunks")
    .upsert(rows, {
      onConflict: "url,chunk_hash",
      ignoreDuplicates: true, // avoids updating existing rows (e.g., keeps embeddings)
    });

  if (error)
    return res.status(500).json({ error: "upsert-failed", detail: error.message });

  return res.status(200).json({ inserted: rows.length });
}
