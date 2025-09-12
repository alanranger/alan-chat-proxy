// /api/embed-missing.js  — robust error handling + flexible body parsing
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // 1536 dims

function readLimit(req) {
  try {
    if (typeof req.body === "string" && req.body.length) {
      const parsed = JSON.parse(req.body);
      return Math.min(Number(parsed?.limit) || 50, 200);
    }
    return Math.min(Number(req.body?.limit) || 50, 200);
  } catch {
    return 50;
  }
}

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
      "X-Title": "Alan Ranger Embedding Backfill",
      Accept: "application/json"
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts
    })
  });

  const raw = await resp.text(); // read raw first to avoid JSON parse surprises

  if (!resp.ok) {
    // surface the actual body for debugging (often HTML when blocked)
    throw new Error(
      `embedding-api-failed: ${resp.status} ${raw.slice(0, 500)}`
    );
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `embedding-parse-failed: ${String(e)} | body: ${raw.slice(0, 500)}`
    );
  }

  const embeddings = (json?.data || []).map((d) => d.embedding);
  if (!embeddings.length) {
    throw new Error(
      `embedding-empty-response: ${raw.slice(0, 500)}`
    );
  }
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
    const limit = readLimit(req);

    // 1) pull a batch needing embeddings
    const batch = await getBatch(limit);
    if (batch.length === 0) {
      return res.status(200).json({ processed: 0, note: "done" });
    }

    // 2) create embeddings
    const texts = batch.map((b) => b.chunk_text);
    const vectors = await embedBatch(texts); // number[1536][]

    // 3) update rows
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

    return res.status(200).json({ processed: batch.length, model: EMBEDDING_MODEL });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "embed-missing-failed", detail: String(e) });
  }
}
