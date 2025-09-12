// /api/ingest.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { url, title, chunks } = req.body || {};
    if (!url || !title || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: "Provide url, title, and chunks: [{ text, embedding? }]" });
    }

    // Build rows; omit embedding if it's null/undefined to avoid pgvector type errors
    const rows = chunks.map((c) => {
      const row = { url, title, chunk_text: c.text };
      if (c.embedding && Array.isArray(c.embedding)) row.embedding = c.embedding;
      return row;
    });

    const { data, error } = await supabase.from("page_chunks").insert(rows).select("id");
    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: "insert-failed", detail: error.message });
    }

    return res.status(200).json({ success: true, inserted: data.length, ids: data.map((r) => r.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "ingest-failed", detail: String(err) });
  }
}
