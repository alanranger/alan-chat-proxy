// Simple API test for two queries directly against the backend (no frontend)
// Uses Node 18+ global fetch

const CHAT_URL = process.env.CHAT_URL || "https://alan-chat-proxy.vercel.app/api/chat";

async function ask(query, previousQuery) {
  const body = previousQuery ? { query, previousQuery } : { query };
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return json;
}

(async () => {
  const queries = [
    "How much is a residential photography workshop and does it include B&B?",
    "What tripod do you recommend?"
  ];

  for (const q of queries) {
    const r = await ask(q);
    const preview = String(r.answer_markdown || r.answer || "").slice(0, 160);
    console.log("\n=== Query ===\n", q);
    console.log("Type:", r.type, "Confidence:", r.confidence);
    if (r.structured?.debug || r.debug) {
      const dbg = r.structured?.debug || r.debug;
      console.log("Debug counts:", dbg.counts || {});
    }
    console.log("Preview:", preview.replace(/\n/g, " "));
  }
})();



