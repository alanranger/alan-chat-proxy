async function getEmbeddings(inputs) {
  const orKey = process.env.OPENROUTER_API_KEY || '';
  const oaKey = process.env.OPENAI_API_KEY || '';
  if (!orKey && !oaKey) throw new Error('no_embedding_provider_configured');

  // helper to safely parse JSON or throw with HTML snippet
  const parseJSONorThrow = async (resp, providerTag) => {
    const ct = resp.headers.get('content-type') || '';
    const text = await resp.text(); // read once
    if (!ct.toLowerCase().includes('application/json')) {
      const snippet = text.slice(0, 300).replace(/\s+/g, ' ');
      throw new Error(`${providerTag}_bad_content_type:${ct || '(none)'}:${snippet}`);
    }
    let j;
    try { j = JSON.parse(text); } 
    catch (e) {
      const snippet = text.slice(0, 300).replace(/\s+/g, ' ');
      throw new Error(`${providerTag}_bad_json:${String(e.message || e)}:${snippet}`);
    }
    return j;
  };

  const body = JSON.stringify({ model: 'text-embedding-3-small', input: inputs });

  if (orKey) {
    const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${orKey}`,
        'Content-Type': 'application/json',
        // These two headers help some gateways return proper JSON instead of HTML
        'HTTP-Referer': 'https://alan-chat-proxy.vercel.app',
        'X-Title': 'alan-chat-proxy'
      },
      redirect: 'follow',
      body
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`openrouter_error:${resp.status}:${t.slice(0,300)}`);
    }
    const j = await parseJSONorThrow(resp, 'openrouter');
    const out = (j?.data || []).map(d => d?.embedding);
    if (!out.length) throw new Error('openrouter_empty_embeddings');
    if (!Array.isArray(out[0]) || out[0].length !== 1536) throw new Error('openrouter_bad_embedding_dim');
    return out;
  }

  // OpenAI path
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${oaKey}`, 'Content-Type': 'application/json' },
    redirect: 'follow',
    body
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`openai_error:${resp.status}:${t.slice(0,300)}`);
  }
  const j = await parseJSONorThrow(resp, 'openai');
  const out = (j?.data || []).map(d => d?.embedding);
  if (!out.length) throw new Error('openai_empty_embeddings');
  if (!Array.isArray(out[0]) || out[0].length !== 1536) throw new Error('openai_bad_embedding_dim');
  return out;
}
