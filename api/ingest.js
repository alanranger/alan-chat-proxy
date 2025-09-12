// /api/ingest.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url, title, chunks } = req.body;
    if (!url || !title || !chunks) {
      return res.status(400).json({ error: "url, title, and chunks[] required" });
    }

    // Insert chunks into Supabase
    const { data, error } = await supabase.from("page_chunks").insert(
      chunks.map((c) => ({
        url,
        title,
        chunk_text: c.text,
        embedding: c.embedding
      }))
    );

    if (error) throw error;
    return res.status(200).json({ success: true, inserted: data.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to insert chunks" });
  }
}
