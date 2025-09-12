// /api/embed-missing.js
// Fills embeddings for rows where `embedding IS NULL` in batches.
// Call it repeatedly until it returns processed: 0.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // 1536 dims (matches your table)

async function getBatch(limit = 50) {
  const { data, error } = await supabase
    .from("page_chunks")
    .select("id, chunk_text")
    .is("embedding", null)
    .order("id", { ascending: true })
    .limit(limit);

  if (error) throw new Error("select-missing-failed: " + error.message);
  return data || [];
}

async function embedBatch(texts) {
  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://alan-chat-proxy.vercel.app",
      "X-Title": "Alan Ranger Embedding Backfill"
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts
    })
  });

  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(
      `embedding-api-failed: ${resp.status} ${JSON.stringify(json)}`
    );
  }

  const embeddings = (json?.data || []).map((d) => d.embedding);
  return embeddings;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const limit = Math.min(Number(req.body?.limit) || 50, 200);

    // 1) Fetch a batch with null embeddings
    const batch = await getBatch(limit);
    if (batch.length === 0) {
      return res.status(200).json({ processed: 0, note: "done" });
    }

    // 2) Create embeddings (keep order)
    const texts = batch.map((b) => b.chunk_text);
    const vectors = await embedBatch(texts); // array of float[1536]

    // 3) Update rows
    // Supabase vector type accepts JS number arrays directly.
    // Do serial updates to keep things simple & avoid row-level conflicts.
    for (let i = 0; i < batch.length; i++) {
      const id = batch[i].id;
      const vec = vectors[i];
      const { error } = await supabase
        .from("page_chunks")
        .update({ embedding: vec })
        .eq("id", id);
      if (error) {
        throw new Error(`update-failed id=${id}: ${error.message}`);
      }
    }

    return res
      .status(200)
      .json({ processed: batch.length, model: EMBEDDING_MODEL });
  } catch (e) {
    return res.status(500).json({ error: "embed-missing-failed", detail: String(e) });
  }
}
