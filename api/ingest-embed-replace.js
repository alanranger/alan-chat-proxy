// Minimal skeleton that returns 400 unless ?url=is provided.
// (No file-level runtime — vercel.json will set nodejs22.x)

export default async function handler(req, res) {
  try {
    const url = req.query.url || (req.method === 'POST' ? (req.body?.url || '') : '');
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'validate_input', detail: 'Missing or invalid url' });
    }
    // TODO: your ingest+embed+replace logic goes here
    return res.status(200).json({ ok: true, processed: url });
  } catch (err) {
    return res.status(500).json({
      error: 'server_error',
      detail: err?.message || String(err)
    });
  }
}
