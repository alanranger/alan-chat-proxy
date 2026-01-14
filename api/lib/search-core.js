// api/lib/search-core.js
// Extracted reusable search logic from api/chat.js
// This module provides the core search functionality that both chat and search endpoints can use

import { createClient } from "@supabase/supabase-js";
import {
  extractKeywords,
  findEvents,
  findServices,
  findArticles,
  formatEventsForUi,
  initializeConfidenceContext,
  analyzeDataAttributes,
  finalizeConfidence
} from '../chat.js';

/**
 * Main search function that orchestrates finding events, services, articles, etc.
 * Returns structured results with confidence score
 * 
 * @param {Object} params
 * @param {string} params.q - User query string (renamed from 'query' for consistency with endpoint)
 * @param {number} params.limit - Max results per type (default: 24)
 * @param {Object} params.pageContext - Optional page context for keyword enhancement
 * @param {Object} params.supa - Optional Supabase client (if not provided, creates one)
 * @returns {Promise<Object>} { ok: true, q, confidence, structured: { intent, events, services, articles, products, landing } }
 */
export async function runSearch({ q, limit = 24, pageContext = null, supa = null }) {
  // Support both 'q' and 'query' parameter names for backward compatibility
  const query = q?.trim() || '';
  
  if (!query) {
    return {
      ok: true,
      q: query,
      confidence: 0.1,
      structured: {
        intent: 'empty',
        topic: '',
        events: [],
        services: [],
        articles: [],
        products: [],
        landing: []
      }
    };
  }

  // Create Supabase client if not provided (for search endpoint usage)
  const client = supa || createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Extract keywords from query
  const keywords = extractKeywords(query);
  
  // Detect intent (simplified - chat.js has more complex logic)
  const queryLower = query?.toLowerCase() || '';
  let intent = 'advice';
  
  if (queryLower.includes('when') || queryLower.includes('next') || 
      queryLower.includes('workshop') || queryLower.includes('course') ||
      queryLower.includes('event') || queryLower.includes('schedule')) {
    intent = 'events';
  } else if (queryLower.includes('service') || queryLower.includes('offer') ||
             queryLower.includes('private lesson') || queryLower.includes('mentoring')) {
    intent = 'services';
  }

  // Search all content types in parallel
  const [events, services, articles] = await Promise.all([
    findEvents(client, { keywords, limit: Math.min(limit, 80), pageContext }),
    findServices(client, { keywords, limit: Math.min(limit, 24), pageContext }),
    findArticles(client, { keywords, limit: Math.min(limit, 12), pageContext })
  ]);

  // Format events for UI
  const formattedEvents = formatEventsForUi(events || []);

  // Calculate confidence using the same logic as chat
  const confidenceContext = initializeConfidenceContext(query);
  analyzeDataAttributes(formattedEvents, null, confidenceContext);
  const confidence = finalizeConfidence(query, confidenceContext);

  // Helper to extract publish date (same as chat.js uses)
  const extractPublishDate = (article) => {
    try {
      if (article.publish_date) {
        return new Date(article.publish_date).toLocaleDateString('en-GB', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
      if (article.last_seen) {
        return new Date(article.last_seen).toLocaleDateString('en-GB', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
      return null;
    } catch {
      return null;
    }
  };

  // Return structured results in the format expected by the endpoint
  return {
    ok: true,
    q: query,
    confidence,
    structured: {
      intent,
      topic: keywords.join(', '),
      events: formattedEvents,
      services: services || [],
      articles: (articles || []).map(a => ({
        ...a,
        display_date: extractPublishDate(a)
      })),
      products: [],
      landing: []
    }
  };
}
