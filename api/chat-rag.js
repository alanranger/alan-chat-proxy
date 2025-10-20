import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export const config = { runtime: "nodejs" };

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
function supabaseAdmin() {
  if (!SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// Hash IP for logging
const hashIP = (ip) => {
  if (!ip) return null;
  return createHash('sha256').update(ip + 'chat-log-salt').digest('hex').substring(0, 16);
};

// Extract keywords from query
function extractKeywords(query) {
  const lc = query.toLowerCase();
  const keywords = [];
  
  // Location keywords
  const locations = ['devon', 'wales', 'yorkshire', 'coventry', 'lake district', 'suffolk', 'exmoor'];
  locations.forEach(loc => {
    if (lc.includes(loc)) keywords.push(loc);
  });
  
  // Photography terms
  const photoTerms = ['iso', 'aperture', 'shutter', 'exposure', 'lightroom', 'photoshop', 'workshop', 'course', 'lesson', 'tripod'];
  photoTerms.forEach(term => {
    if (lc.includes(term)) keywords.push(term);
  });
  
  return keywords;
}

// RAG search function - searches database first
async function ragSearch(client, query) {
  console.log(`🔍 RAG Search for: "${query}"`);
  
  const results = {
    chunks: [],
    entities: [],
    totalMatches: 0,
    confidence: 0,
    answerType: 'none'
  };
  
  try {
    // Search page_chunks for content
    const { data: chunks, error: chunksError } = await client
      .from('page_chunks')
      .select('url, title, chunk_text')
      .ilike('chunk_text', `%${query}%`)
      .limit(5);
    
    if (chunksError) {
      console.error('Chunks search error:', chunksError);
    } else {
      results.chunks = chunks || [];
      console.log(`📄 Found ${results.chunks.length} relevant chunks`);
    }
    
    // Search page_entities for events/services
    const { data: entities, error: entitiesError } = await client
      .from('page_entities')
      .select('url, title, description, location, date_start, kind')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`)
      .limit(5);
    
    if (entitiesError) {
      console.error('Entities search error:', entitiesError);
    } else {
      results.entities = entities || [];
      console.log(`🎯 Found ${results.entities.length} relevant entities`);
    }
    
    // Calculate total matches and confidence
    results.totalMatches = results.chunks.length + results.entities.length;
    
    // Calculate confidence based on match quality
    if (results.totalMatches === 0) {
      results.confidence = 0.1;
      results.answerType = 'no_answer';
    } else if (results.chunks.length > 0 && results.entities.length > 0) {
      results.confidence = 0.9; // High confidence - found both content and events
      results.answerType = 'mixed';
    } else if (results.chunks.length > 0) {
      results.confidence = 0.8; // Good confidence - found content
      results.answerType = 'content';
    } else if (results.entities.length > 0) {
      results.confidence = 0.8; // Good confidence - found events
      results.answerType = 'events';
    } else {
      results.confidence = 0.3;
      results.answerType = 'low_confidence';
    }
    
    console.log(`✅ RAG Search complete: ${results.answerType} (confidence: ${results.confidence})`);
    
  } catch (error) {
    console.error('RAG search error:', error);
    results.confidence = 0.1;
    results.answerType = 'error';
  }
  
  return results;
}

// Generate answer from RAG results
function generateAnswer(ragResults, query) {
  const { chunks, entities, answerType, confidence } = ragResults;
  
  if (confidence < 0.6) {
    return {
      type: 'clarification',
      answer: `I'd be happy to help with that! Could you be more specific about what you're looking for? For example, are you asking about:
      
• Photography equipment recommendations?
• Workshop dates and locations?
• Technical photography questions?
• Pricing and services?

Please let me know which area interests you most.`,
      confidence: 0.3
    };
  }
  
  if (answerType === 'content' || answerType === 'mixed') {
    // Use the best chunk for content-based answers
    const bestChunk = chunks[0];
    if (bestChunk) {
      return {
        type: 'advice',
        answer: `Based on my knowledge, here's what I can tell you:

${bestChunk.chunk_text.substring(0, 500)}...

*Read more: ${bestChunk.url}*`,
        confidence: confidence,
        source: bestChunk.url
      };
    }
  }
  
  if (answerType === 'events' || answerType === 'mixed') {
    // Format events
    const eventList = entities.map(entity => ({
      title: entity.title,
      url: entity.url,
      location: entity.location,
      date: entity.date_start,
      type: entity.kind
    }));
    
    return {
      type: 'events',
      answer: eventList,
      confidence: confidence
    };
  }
  
  return {
    type: 'advice',
    answer: 'I found some relevant information, but I need to clarify what specific aspect you\'d like to know more about.',
    confidence: 0.5
  };
}

// Main handler
export default async function handler(req, res) {
  const started = Date.now();
  
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { query, previousQuery, pageContext } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`🚀 RAG-First API: "${query}"`);
    
    // Initialize Supabase client
    const client = supabaseAdmin();
    
    // Step 1: RAG Search First (Always)
    const ragResults = await ragSearch(client, query);
    
    // Step 2: Generate Answer Based on Confidence
    const response = generateAnswer(ragResults, query);
    
    // Step 3: Add debug information
    const debugInfo = {
      intent: 'rag_first',
      classification: ragResults.answerType,
      confidence: ragResults.confidence,
      totalMatches: ragResults.totalMatches,
      chunksFound: ragResults.chunks.length,
      entitiesFound: ragResults.entities.length,
      approach: 'rag_first_prototype'
    };
    
    // Step 4: Log the interaction
    const ipHash = hashIP(req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    const sessionId = req.headers['x-session-id'] || 'unknown';
    
    try {
      await client.from('chat_interactions').insert({
        session_id: sessionId,
        question: query,
        answer: typeof response.answer === 'string' ? response.answer : JSON.stringify(response.answer),
        intent: debugInfo.intent,
        confidence: response.confidence,
        response_time_ms: Date.now() - started,
        sources_used: response.source ? [response.source] : [],
        page_context: pageContext
      });
    } catch (logError) {
      console.error('Logging error:', logError);
    }
    
    // Step 5: Return response
    const finalResponse = {
      ok: true,
      type: response.type,
      answer: response.answer,
      confidence: response.confidence,
      debug: debugInfo,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - started
    };
    
    console.log(`✅ RAG-First Response: ${response.type} (${response.confidence}) - ${Date.now() - started}ms`);
    
    return res.status(200).json(finalResponse);
    
  } catch (error) {
    console.error('RAG-First API error:', error);
    
    return res.status(500).json({
      ok: false,
      error: "internal_server_error",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
