# Supabase Row Level Security (RLS) on the AI Chat project (`igzvwbvgvmzvvzoclufx`)

Many `public.*` tables still have **RLS disabled**. With the **anon key** shipped to browsers (or leaked), PostgREST can expose read/write paths unless you lock them down.

## What fixing RLS actually means

1. **`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`** — anonymous and authenticated JWTs are blocked for that table until you add policies.
2. **Service role** (`SUPABASE_SERVICE_ROLE_KEY`) **bypasses RLS** server-side — your Vercel API routes using the service role keep working regardless of policies, as long as you do not regress to anon-only callers for those mutations.
3. **Do not bulk-enable RLS on production** until each table has correct policies — clients using the anon key will break outright.

## Recommended approach (safe order)

1. **Inventory callers** — list every browser / Edge Function / cron job that hits Supabase directly with the **anon** key vs only through your **chat proxy** using the **service role**.
2. Start with tables that already show `rls_enabled = true` in the dashboard (**e.g. `chat_sessions`, `chat_interactions`**) — review policies there as the template.
3. For each `rls_enabled = false` table, choose one of:
   - **Server-only data** (`page_chunks`, internal audit tables): enable RLS; default **deny anon/authenticated**; allow service role implicitly (always bypass).
   - **Optional anon reads** — add explicit `FOR SELECT USING (...)` policies as narrow as possible.
   - **`GRANT`** hygiene — revoke `USAGE`/`ALL` from `anon` on schemas/tables not needed from the browser.
4. **Test in staging** — run smoke tests (`npm run test:regression`, ingest cron, dashboard) **before** deploying policy changes.

## MCP / tooling note

Automated MCP “enable RLS on everything” remediation is risky without per-table policies. Treat RLS rollout as **a phased migration series** (tracked in Git), not one fat SQL dash.
