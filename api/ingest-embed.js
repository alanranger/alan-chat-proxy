// /api/ingest-embed.js
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
      return res.status(400).json({ error: "Provide url, title, and chunks: string[]" });
    }

    // --- Call OpenRouter embeddings
    const embRes = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json", // force JSON (avoid HTML shell)
        "HTTP-Referer": "https://alan-chat-proxy.vercel.app",
        "X-Title": "Alan Ranger Chatbox RAG"
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small", // 1536-dim
        input: chunks
      })
    });

    const rawText = await embRes.text();
    let edata;
    try {
      edata = JSON.parse(rawText);
    } catch {
      return res.status(embRes.status || 500).json({
        error: "embedding-json-parse-failed",
        status: embRes.status,
        note: "OpenRouter returned non-JSON (likely HTML/app shell).",
        raw_preview: rawText.slice(0, 1000)
      });
    }
    if (!embRes.ok || !edata?.data) {
      return res.status(embRes.status || 500).json({
        error: "embedding-request-failed",
        status: embRes.status,
        detail: edata
      });
    }

    // --- Insert rows into Supabase
    const rows = edata.data.map((d, i) => ({
      url,
      title,
      chunk_text: chunks[i],
      embedding: d.embedding
    }));

    const { data, error } = await supabase.from("page_chunks").insert(rows).select("id");
    if (error) throw error;

    return res.status(200).json({ success: true, inserted: data.length, ids: data.map(r => r.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "ingest-embed failed", detail: String(err) });
  }
}
