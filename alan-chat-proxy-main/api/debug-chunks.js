// /api/debug-chunks.js  — count only
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { count, error } = await supabase
      .from("page_chunks")
      .select("*", { count: "exact", head: true }); // HEAD + count only

    if (error) return res.status(500).json({ error: "count-failed", detail: error.message });
    return res.status(200).json({ total_chunks: count });
  } catch (e) {
    return res.status(500).json({ error: "debug-count-failed", detail: String(e) });
  }
}
