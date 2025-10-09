// /api/chat.js - Step 3: Add article search functionality
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
  
// Simple article search
async function findArticles(client, keywords, limit = 6) {
  if (!keywords || keywords.length === 0) return [];
  
  try {
    const { data, error } = await client
      .from('page_entities')
      .select('*')
      .eq('kind', 'article')
    .limit(limit);

  if (error) return [];
  return data || [];
  } catch (error) {
    return [];
  }
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
    
    // Query articles for advice intent
    let articles = [];
    if (intent === "advice") {
      articles = await findArticles(client, keywords, 6);
    }
    
    // Generate response based on intent
    let answerMarkdown = "";
    if (intent === "events" && events.length > 0) {
      answerMarkdown = `I found ${events.length} upcoming workshops. Here are the details:`;
    } else if (intent === "events") {
      answerMarkdown = "I couldn't find any upcoming workshops at the moment.";
    } else if (intent === "advice" && articles.length > 0) {
      answerMarkdown = `I found ${articles.length} relevant articles that might help with your question.`;
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
        articles: articles
      },
      confidence: events.length > 0 || articles.length > 0 ? 0.8 : 0.4,
        debug: {
        version: "v1.2.45-articles-test",
        query: query || "no query",
          keywords: keywords,
        intent: intent,
        eventCount: events.length,
        articleCount: articles.length
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