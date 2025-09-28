// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: this file must only be imported by server code (API routes, server actions).
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // service role (server-only)
  { auth: { persistSession: false } }
)
