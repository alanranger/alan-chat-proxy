// /api/ask.js
export default async function handler(req, res) {
  // CORS for Squarespace or local tests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { input_text = "", chat_id = "default" } = req.body || {};
    if (!input_text.trim()) return res.status(400).json({ error: "input_text is required" });

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://alan-chat-proxy.vercel.app", // optional but recommended
        "X-Title": "Alan Ranger Chatbox"
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1", // or "anthropic/claude-3.5-sonnet"
        messages: [
          {
            role: "system",
            content:
              "You are Alan Ranger’s website assistant. Be concise, friendly, and helpful. " +
              "Prefer giving direct links to relevant pages on alanranger.com. If unsure, say so and offer 'Email Alan'."
          },
          { role: "user", content: input_text }
        ]
      })
    });

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? "Sorry, I couldn't get a response.";
    return res.status(200).json({ chat_id, reply, raw: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "OpenRouter request failed" });
  }
}
