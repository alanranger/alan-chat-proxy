# Supabase client & key usage audit (`alan-chat-proxy`)

Read-only audit of **`G:/Dropbox/alan ranger photography/Website Code/Chat AI Bot`**, focused on `createClient` from `@supabase/supabase-js` and equivalent server usage. No key values from `.env*` are reproduced below—only **environment variable names** and patterns inferred from source.

---

## `/api/*` handlers (deployed backend)

| File | Approx. lines | Auth key fed to Supabase JS client | Route | Purpose (typical) | Shipped to browser? |
|------|----------------|-------------------------------------|-------|-------------------|---------------------|
| `api/chat.js` | 2077–2099 | `process.env.SUPABASE_SERVICE_ROLE_KEY \|\| process.env.SUPABASE_ANON_KEY` | `POST /api/chat` | Singleton `supabaseAdmin()` → sessions, chunks, entities, enrichment, logging helpers | **No** |
| `api/chat-improvement.js` | 10–14 | `SUPABASE_SERVICE_ROLE_KEY \|\| SUPABASE_ANON_KEY` | `/api/chat-improvement` | Improvement / tracking DB reads/writes | **No** |
| `api/light-refresh.js` | 18–22 | `SUPABASE_SERVICE_ROLE_KEY \|\| SUPABASE_ANON_KEY` | `/api/light-refresh` | Cron / light refresh ingest | **No** |
| `api/chat-log.js` | 62 | `need('SUPABASE_SERVICE_ROLE_KEY')` only | `/api/chat-log` | `chat_sessions` / `chat_interactions` / `chat_events` | **No** |
| `api/ingest.js` | 1594, 1696 | `need('SUPABASE_SERVICE_ROLE_KEY')` | `/api/ingest` | Re-ingestion pipeline | **No** |
| `api/analytics.js` | 75 | `need('SUPABASE_SERVICE_ROLE_KEY')` | `/api/analytics` | Analytics queries | **No** |
| `api/csv-import.js` | 1624 | `need('SUPABASE_SERVICE_ROLE_KEY')` | `/api/csv-import` | CSV import | **No** |
| `api/tools.js` | 71 | `need('SUPABASE_SERVICE_ROLE_KEY')` | `/api/tools` | Operational tools (e.g. parity) | **No** |
| `api/admin.js` | 67–98 | `SUPABASE_SERVICE_ROLE_KEY` (URL: `SUPABASE_URL` **or** `NEXT_PUBLIC_SUPABASE_URL`) | `/api/admin` | Two JS clients (`public`, `cron` schemas); plus direct Postgres via `pg` / `SUPABASE_DB_URL` (separate from `createClient`, same trust class as service role) | **No** |
| `api/db-health.js` | ~71 | Service role (`need`) for checks | `/api/db-health` | DB health | **No** |
| `api/db-health-extended.js` | ~41–49 | Service role on `fetch(…/rest/v1/rpc/…)` headers | `/api/db-health-extended` | Extended health RPC | **No** |
| `api/lib/search-core.js` | 49–51 | `process.env.SUPABASE_SERVICE_ROLE_KEY` only (no anon fallback on that branch) | Used by **`api/search/query.js`** → `/api/search/query` | Shared search aggregation | **No** |
| `api/extract.js` | — | No `createClient` in file | `/api/extract` | Extract pipeline | **No** |
| `api/image-proxy.js` | — | No `createClient` in file | `/api/image-proxy` | Image proxy | **No** |

---

## Fallback pattern (before RLS changes)

These call sites intentionally allow **`SUPABASE_ANON_KEY`** if **`SUPABASE_SERVICE_ROLE_KEY`** is absent:

| File | Lines (approx.) |
|------|-----------------|
| `api/chat.js` | 2084–2085 |
| `api/chat-improvement.js` | 12 |
| `api/light-refresh.js` | 19–20 |

For **production chat**, Vercel should set **`SUPABASE_SERVICE_ROLE_KEY`**. If only the anon key is set, **`api/chat`** (and improvement / light-refresh helpers) instantiate with anon and operate **subject to RLS**.

Stricter **`need('SUPABASE_SERVICE_ROLE_KEY')`** (no anon on that instantiation line): `chat-log.js`, `ingest.js`, `analytics.js`, `csv-import.js`, `tools.js`, `admin.js`, and `api/lib/search-core.js` (`search-core` has no anon fallback).

---

## `regression-test-suite.js`

| File | Approx. lines | Key env vars | Purpose | Browser? |
|------|----------------|--------------|---------|----------|
| `regression-test-suite.js` | 269–279 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (skips DB block if unset) | Updates `content_improvement_tracking` after HTTP regression | **No** (local Node CLI) |

---

## `public/` and embed behaviour

| Asset | Observation | Relation to backend env vars |
|-------|-------------|--------------------------------|
| `public/chat.html` | No in-file `supabase` / `createClient` detected; embed talks to **`/api/chat`**, not Supabase directly from this file | **N/A** |
| `public/regression-comparison.html`, `public/interactive-testing.html` | Browser `supabase.createClient(url, key)` from textarea / localStorage; lab UI may ship default JWT-shaped placeholders | **Uses pasted or embedded anon-style material**, not **Vercel `SUPABASE_SERVICE_ROLE_KEY`** |
| `public/bulk-simple.html` | `getToken()` returns a **fixed JWT string** intended for REST `Authorization` + `apikey` (coded as privileged admin tooling) | **Hard-coded in static HTML**, not from server env |

**`next.config.js`:** not present at repo root for this bundle; deployment is effectively **Vercel serverless `api/*.js`** plus **`public/`** static assets.

---

## Other `createClient` locations (non–`/api` production path)

| Area | Notes |
|------|--------|
| `lib/supabaseAdmin.js` | Uses **`SUPABASE_SERVICE_ROLE_KEY`**. Repo search suggests **nothing imports this module** besides the file itself—in practice likely **dead** for runtime unless an external bundle uses it. |
| `helpers/logJobRun.js` | Service-role client; consumed from **`api/admin.js`** (Node). |
| `debugs/`, `scripts/`, `testing-scripts/` | Mixed service role, anon, or hard-coded JWTs—**development / tooling only**; do not confuse with production **`POST /api/chat`**. |
| `supabase/functions/*.ts` | Edge functions read **`SUPABASE_SERVICE_ROLE_KEY`** via `Deno.env`; **Supabase-hosted**, **not browser**. |

---

## Summary for RLS planning

- **Production chat handler (`api/chat.js`)** uses **`SUPABASE_SERVICE_ROLE_KEY` when configured**, falling back to **`SUPABASE_ANON_KEY`** otherwise—so RLS tightening will **bite** immediately if prod is misconfigured to rely only on anon.
- **Risk flag:** **`api/lib/search-core.js`** relies on **`SUPABASE_SERVICE_ROLE_KEY` only** (no anon fallback on that instantiation); differing from **`chat.js`**, but acceptable if env is consistent.
- **Browser exposure:** **Robo‑Ranger `chat.html` does not instantiate Supabase** in the audited snippet; separate **`public/*` tools pages** expose or encourage pasting anon (or worse, hard-coded tokens in HTML)—treat those as operational security artefacts distinct from **`/api/chat` env**.

---

*Document generated from repository read-only source inspection; no credential values.*
