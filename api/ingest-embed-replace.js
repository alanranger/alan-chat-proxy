export default async function handler(req, res) {
  // tiny helper to guarantee string details
  const asString = (e) => {
    if (!e) return '(unknown)';
    if (typeof e === 'string') return e;
    if (e.message && typeof e.message === 'string') return e.message;
    try { return JSON.stringify(e); } catch { return String(e); }
  };

  const toJSON = (status, obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // force detail to string and include stage if present
    if (obj && 'detail' in obj) obj.detail = asString(obj.detail);
    res.status(status).send(JSON.stringify(obj));
  };

  if (req.method !== 'POST') return toJSON(405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    const need = (k) => {
      const v = process.env[k];
      if (!v || !v.trim()) throw new Error(`missing_env:${k}`);
      return v;
    };

    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return toJSON(401, { error: 'unauthorized', stage });
    }

    stage = 'parse_body';
    const { url } = req.body || {};
    if (!url) return toJSON(400, { error: 'bad_request', detail: 'Provide "url"', stage });

    stage = 'db_client';
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    stage = 'fetch_page';
    const { text } = await fetchPage(url);
    if (!text || text.length < 10) {
      return toJSON(422, { error: 'empty_content', stage });
    }

    stage = 'chunk';
    const chunks = chunkText(text);
    if (!chunks.length) return toJSON(422, { error: 'no_chunks', stage });

    stage = 'embed';
    const embeds = await getEmbeddings(chunks);

    stage = 'prepare_rows';
    const rows = chunks.map((content, i) => ({
      url,
      title: null,
      content,
      embedding: embeds[i],
      tokens: Math.ceil(content.length / 4),
      hash: sha1(`${url}#${i}:${content.slice(0, 128)}`),
    }));

    stage = 'upsert';
    const { data, error } = await supa
      .from('page_chunks')
      .upsert(rows, { onConflict: 'hash' })
      .select('id')
      .order('id', { ascending: false });

    if (error) return toJSON(500, { error: 'supabase_upsert_failed', detail: error.message || error, stage });

    const firstId = data?.[0]?.id ?? null;
    stage = 'done';
    return toJSON(200, { ok: true, id: firstId, len: text.length, chunks: rows.length, stage });
  } catch (err) {
    return toJSON(500, { error: 'server_error', detail: asString(err), stage });
  }
}
