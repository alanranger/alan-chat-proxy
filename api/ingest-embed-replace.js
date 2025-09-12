// /api/ingest-embed-replace.ts
export const runtime = 'nodejs';           // ensure Node runtime, not Edge
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

// ---- ENV ----
const SUPABASE_URL  = process.env.SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!; // required
const OPENROUTER_EMBED_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBED_MODEL = 'openai/text-embedding-3-small';         // works via OpenRouter

// ---- helpers ----
function errorRes(status: number, stage: string, detail: unknown) {
  return new Response(
    JSON.stringify({ error: 'server_error', status, stage, detail }),
    { status, headers: { 'content-type': 'application/json' } }
  );
}

function okRes(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

// very quick HTML -> text (good enough for workshop pages)
function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// naive chunker (tokens ≈ chars/4; keep it simple here)
function chunk(text: string, maxLen = 1200) {
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    parts.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return parts;
}

async function embedBatch(inputs: string[]) {
  const body = { model: EMBED_MODEL, input: inputs };
  const resp = await fetch(OPENROUTER_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  let data: any;
  try { data = JSON.parse(raw); } catch {
    throw new Error(`Embedding non-JSON body (status ${resp.status}): ${raw.slice(0,400)}`);
  }
  if (!resp.ok) {
    throw new Error(`Embedding error ${resp.status}: ${JSON.stringify(data)}`);
  }
  if (!data?.data?.length) {
    throw new Error(`Embedding empty result: ${JSON.stringify(data)}`);
  }
  // OpenAI-like shape via OpenRouter
  return data.data.map((d: any) => d.embedding as number[]);
}

// ---- handler ----
export async function POST(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return errorRes(400, 'parse_json', 'Body must be JSON { url, title? }');
    }

    const url = String(payload?.url || '').trim();
    const title = String(payload?.title || '').trim();

    if (!url || !/^https?:\/\//i.test(url)) {
      return errorRes(400, 'validate_input', 'Missing or invalid url');
    }

    // 1) Fetch page
    let html: string;
    try {
      const resp = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        return errorRes(502, 'fetch_page', { status: resp.status, body: body.slice(0,400) });
      }
      html = await resp.text();
    } catch (e) {
      return errorRes(502, 'fetch_page', String(e));
    }

    // 2) Extract text and chunk
    const text = htmlToText(html);
    if (text.length < 50) {
      return errorRes(422, 'extract_text', 'Page has too little text for embeddings');
    }
    const chunks = chunk(text, 1200).slice(0, 100); // cap
    if (!chunks.length) {
      return errorRes(422, 'chunk_text', 'No chunks produced');
    }

    // 3) Embeddings (batch)
    let vectors: number[][] = [];
    try {
      // batch in groups to keep payloads smaller
      const batchSize = 16;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const part = chunks.slice(i, i + batchSize);
        const embs = await embedBatch(part);
        vectors.push(...embs);
      }
    } catch (e) {
      return errorRes(502, 'embed', String(e));
    }

    if (vectors.length !== chunks.length) {
      return errorRes(500, 'embed_mismatch', { chunks: chunks.length, vectors: vectors.length });
    }

    // 4) Replace per URL: delete then insert
    try {
      const del = await supabase
        .from('page_chunks')
        .delete()
        .eq('url', url);
      if (del.error) throw del.error;
    } catch (e:any) {
      return errorRes(500, 'db_delete', e?.message || String(e));
    }

    let inserted = 0;
    try {
      // Prepare rows
      const rows = chunks.map((text, i) => ({
        url,
        title: title || null,
        chunk_text: text,
        embedding: vectors[i],        // vector column (e.g., vector(1536))
      }));

      // Insert in slices to avoid payload limits
      const slice = 100;
      for (let i = 0; i < rows.length; i += slice) {
        const part = rows.slice(i, i + slice);
        const ins = await supabase.from('page_chunks').insert(part);
        if (ins.error) throw ins.error;
        inserted += part.length;
      }
    } catch (e:any) {
      return errorRes(500, 'db_insert', e?.message || String(e));
    }

    return okRes({ ok: true, url, inserted, info: { chunks: chunks.length } });
  } catch (e:any) {
    return errorRes(500, 'unhandled', e?.message || String(e));
  }
}
