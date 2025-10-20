// Minimal test version of chat.js to identify build issues
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!url) {
    console.error("Missing SUPABASE_URL environment variable");
    throw new Error("Missing SUPABASE_URL environment variable");
  }
  if (!key) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable");
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable");
  }
  
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }
    
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ ok: false, error: "missing_query" });
      return;
    }
    
    // Test Supabase connection
    const client = supabaseAdmin();
    const { data, error } = await client.from('page_entities').select('count').limit(1);
    
    if (error) {
      res.status(500).json({ 
        ok: false, 
        error: "database_error", 
        message: error.message 
      });
      return;
    }
    
    res.status(200).json({
      ok: true,
      type: "test",
      answer_markdown: `Test successful for query: "${query}"`,
      confidence: 100,
      debug: { 
        version: "v1.3.20-minimal-test", 
        timestamp: new Date().toISOString() 
      }
    });
    
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      ok: false, 
      error: "internal_server_error",
      message: error.message 
    });
  }
}
