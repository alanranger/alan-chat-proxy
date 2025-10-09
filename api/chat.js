// /api/chat.js - Minimal test version
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const { query } = req.body || {};
    
    // Minimal response to test basic functionality
    res.json({
      ok: true,
      answer_markdown: "Test response - basic chat API is working",
      structured: {
        intent: "test",
        topic: query || "test",
        events: [],
        products: [],
        articles: []
      },
      confidence: 0.5,
      debug: {
        version: "v1.2.42-minimal-test",
        query: query || "no query"
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
