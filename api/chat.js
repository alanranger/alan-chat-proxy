// /api/chat.js - Step 1: Add basic Supabase connection
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseAdmin() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing SUPABASE_URL or KEY");
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const { query } = req.body || {};
    const client = supabaseAdmin();
    
    // Simple test: try to query events
    const { data: events, error } = await client
      .from('v_events_for_chat')
      .select('*')
      .limit(3);
    
    if (error) {
      res.json({
        ok: true,
        answer_markdown: "Test response - Supabase connection failed",
        structured: {
          intent: "test",
          topic: query || "test",
          events: [],
          products: [],
          articles: []
        },
        confidence: 0.3,
        debug: {
          version: "v1.2.43-supabase-test",
          query: query || "no query",
          error: error.message
        }
      });
      return;
    }
    
    // Success - return events
    res.json({
      ok: true,
      answer_markdown: `Found ${events.length} events in database`,
      structured: {
        intent: "events",
        topic: query || "test",
        events: events || [],
        products: [],
        articles: []
      },
      confidence: 0.7,
      debug: {
        version: "v1.2.43-supabase-test",
        query: query || "no query",
        eventCount: events.length
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: "server_error", 
      message: error.message
    });
  }
}