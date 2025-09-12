// api/proxy.js
export default async function handler(req, res) {
  // --- Simple CORS (so you can call this from your site) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Make sure the API key exists
  const apiKey = process.env.BOTSONIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing BOTSONIC_API_KEY on server.' });
  }

  try {
    // Expect whatever JSON you want to forward (e.g., { input: "...", ... })
    const payload = req.body || {};

    const r = await fetch('https://api-bot.writesonic.com/v1/botsonic/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Botsonic accepts Bearer in many SDKs; some docs show a `token` header.
        // We send both for compatibility.
        'Authorization': `Bearer ${apiKey}`,
        'token': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text(); // keep body as text to preserve any non-json edge cases
    // Try to pass through status and JSON if possible
    try {
      const json = JSON.parse(text);
      return res.status(r.status).json(json);
    } catch {
      return res.status(r.status).send(text);
    }
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Proxy request failed', details: String(err) });
  }
}
