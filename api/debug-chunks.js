// /api/debug-chunks.js
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
    const { limit = 50 } = req.body || {};
    const { data, error } = await supabase
      .from("page_chunks")
      .select("id,url,title,chunk_text")
      .order("id", { ascending: true })
      .limit(Math.min(Number(limit) || 50, 200));

    if (error) return res.status(500).json({ error: "select-failed", detail: error.message });
    return res.status(200).json({ count: data.length, rows: data });
  } catch (e) {
    return res.status(500).json({ error: "debug-chunks-failed", detail: String(e) });
  }
}
