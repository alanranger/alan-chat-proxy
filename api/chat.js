// /api/chat.js - Step 2: Add intent detection and keyword extraction
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseAdmin() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing SUPABASE_URL or KEY");
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

// Simple keyword extraction
function extractKeywords(query) {
  if (!query) return [];
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['the', 'and', 'or', 'but', 'for', 'with', 'when', 'where', 'what', 'how', 'why'].includes(w));
  return [...new Set(words)];
}

// Simple intent detection
function detectIntent(query) {
  if (!query) return "advice";
  const lc = query.toLowerCase();
  
  if (lc.includes('workshop') || lc.includes('course') || lc.includes('class') || 
      lc.includes('when') || lc.includes('next') || lc.includes('book') || 
      lc.includes('batsford') || lc.includes('chesterton')) {
    return "events";
  }
  
  return "advice";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const { query } = req.body || {};
    const client = supabaseAdmin();
    
    // Extract keywords and detect intent
    const keywords = extractKeywords(query);
    const intent = detectIntent(query);
    
    // Query events with keywords
    let events = [];
    if (intent === "events") {
      const { data, error } = await client
        .from('v_events_for_chat')
        .select('*')
        .limit(5);
      
      if (!error && data) {
        events = data;
      }
    }
    
    // Generate response based on intent
    let answerMarkdown = "";
    if (intent === "events" && events.length > 0) {
      answerMarkdown = `I found ${events.length} upcoming workshops. Here are the details:`;
    } else if (intent === "events") {
      answerMarkdown = "I couldn't find any upcoming workshops at the moment.";
    } else {
      answerMarkdown = "I can help with photography advice and equipment recommendations.";
    }
    
    res.json({
      ok: true,
      answer_markdown: answerMarkdown,
      structured: {
        intent: intent,
        topic: keywords.join(' '),
        events: events,
        products: [],
        articles: []
      },
      confidence: events.length > 0 ? 0.8 : 0.4,
      debug: {
        version: "v1.2.44-intent-test",
        query: query || "no query",
        keywords: keywords,
        intent: intent,
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