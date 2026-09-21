/**
 * Shared server-side admin bearer check.
 * Accepts INGEST_TOKEN, ADMIN_UI_TOKEN, or legacy shared admin token.
 * Never falls back to a Supabase JWT.
 */
const LEGACY_ADMIN = 'b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';

function normalizeBearer(authHeader) {
  const h = String(authHeader || '').trim();
  if (!h) return '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : h;
}

function allowedTokens() {
  const out = new Set();
  const ingest = (process.env.INGEST_TOKEN || '').trim();
  const adminUi = (process.env.ADMIN_UI_TOKEN || '').trim();
  if (ingest) out.add(ingest);
  if (adminUi) out.add(adminUi);
  out.add(LEGACY_ADMIN);
  return out;
}

export function isAuthorizedAdmin(authHeader) {
  const token = normalizeBearer(authHeader);
  if (!token) return false;
  return allowedTokens().has(token);
}

export function unauthorized(res, stage) {
  const body = stage ? { error: 'unauthorized', stage } : { error: 'unauthorized' };
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
