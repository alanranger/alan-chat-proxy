// /api/ask.js  — RAG-lite (keyword retrieval)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // read-only is enough for queries
);

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { input_text = "", chat_id = "default" } = req.body || {};
    if (!input_text.trim()) return res.status(400).json({ error: "input_text is required" });

    // --- KEYWORD RETRIEVAL (no embeddings needed)
    // grab 3–5 useful keywords (length >= 4) for ILIKE search
    const terms = Array.from(
      new Set(
        input_text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(w => w.length >= 4 && !["alan","ranger","please","about","which","what","with","from","this","that","your","work"].includes(w))
      )
    ).slice(0, 5);

    let retrieved = [];
    if (terms.length) {
      const orFilter = terms.map(t => `chunk_text.ilike.%${t}%`).join(",");
      const { data, error } = await supabase
        .from("page_chunks")
        .select("id,url,title,chunk_text")
        .or(orFilter)
        .limit(6);
      if (error) throw error;
      retrieved = data || [];
    } else {
      const { data, error } = await supabase
        .from("page_chunks")
        .select("id,url,title,chunk_text")
        .limit(6);
      if (error) throw error;
      retrieved = data || [];
    }

    // Build a compact context block
    const context = retrieved
      .map((r, i) => `#${i + 1} [${r.title}](${r.url})\n${r.chunk_text}`)
      .join("\n\n---\n\n");

    const systemPrompt =
      "You are Alan Ranger’s website assistant. Answer using ONLY the provided context. " +
      "Be concise, friendly, and link to the relevant page(s). If the answer is not in context, say you’re not sure and offer 'Email Alan'.";

    // --- LLM call via OpenRouter
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://alan-chat-proxy.vercel.app",
        "X-Title": "Alan Ranger Chatbox (RAG-lite)"
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1",   // or "anthropic/claude-3.5-sonnet"
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Question: ${input_text}\n\nContext:\n${context || "(no context found)"}` }
        ]
      })
    });

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? "Sorry, I couldn't get a response.";
    return res.status(200).json({
      chat_id,
      reply,
      retrieved_count: retrieved.length,
      terms
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "ask-rag-lite-failed", detail: String(err) });
  }
}
