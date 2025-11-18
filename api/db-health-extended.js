// /api/db-health-extended.js
// Extended database health metrics API endpoint with risk scoring
// Returns comprehensive metrics including risk scores for traffic-light visualization

export const config = { runtime: 'nodejs' };

/* ========== utils ========== */
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const asString = (e) => {
  if (!e) return '(unknown)';
  if (typeof e === 'string') return e;
  if (e.message && typeof e.message === 'string') return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};

const sendJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (obj && 'detail' in obj) obj.detail = asString(obj.detail);
  res.status(status).send(JSON.stringify(obj));
};

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    const expectedToken = process.env.INGEST_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (token !== `Bearer ${expectedToken}`) {
      return sendJSON(res, 401, { error: 'unauthorized', stage });
    }

    stage = 'fetch_health';
    const SUPABASE_URL = need('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = need('SUPABASE_SERVICE_ROLE_KEY');

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/db_health_extended`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    if (!rpcRes.ok) {
      const text = await rpcRes.text();
      console.error('db_health_extended failed', rpcRes.status, text);
      throw new Error(`db_health_extended failed with ${rpcRes.status}: ${text}`);
    }

    const data = await rpcRes.json();
    // RPC returns the jsonb directly
    return sendJSON(res, 200, data);

  } catch (err) {
    console.error(`[db-health-extended] Error at stage ${stage}:`, err);
    return sendJSON(res, 500, {
      error: 'internal_error',
      stage,
      detail: asString(err)
    });
  }
}

