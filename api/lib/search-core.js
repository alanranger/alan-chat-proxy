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
  
  // Step A: Filter stopwords for events only (don't affect chat.js behavior)
  // These temporal/availability words can kill event matches but are useful for other content types
  const EVENT_STOPWORDS = new Set(["next", "upcoming", "soon", "nearest", "closest", "near", "available", "availability", "dates"]);
  const eventKeywords = keywords.filter(k => k && !EVENT_STOPWORDS.has(String(k).toLowerCase()));
  // Use filtered keywords for events if non-empty, otherwise fall back to original
  const finalEventKeywords = eventKeywords.length > 0 ? eventKeywords : keywords;
  
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
    findEvents(client, { keywords: finalEventKeywords, limit: Math.min(limit, 80), pageContext }),
    findServices(client, { keywords, limit: Math.min(limit, 24), pageContext }),
    findArticles(client, { keywords, limit: Math.min(limit, 12), pageContext })
  ]);

  // Format events for UI
  let formattedEvents = formatEventsForUi(events || []);

  // Step B: Post-process events to merge image_url from page_entities
  if (formattedEvents && formattedEvents.length > 0) {
    formattedEvents = await enrichEventsWithImages(client, formattedEvents);
  }

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
  // Contract: { ok: true, q, confidence, structured: { intent, events, services, articles, products, landing } }
  return {
    ok: true,
    q: query,
    confidence,
    structured: {
      intent,
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

/**
 * Step B: Enrich events with image_url from page_entities
 * Queries page_entities for event and product pages to get image URLs
 * 
 * @param {Object} client - Supabase client
 * @param {Array} events - Array of event objects
 * @returns {Promise<Array>} Events with image_url merged in
 */
async function enrichEventsWithImages(client, events) {
  if (!events || events.length === 0) return events;

  try {
    const { eventUrls, productUrls } = collectEventUrls(events);
    const imageMap = await fetchImageUrls(client, eventUrls, productUrls);
    return mergeImageUrls(events, imageMap);
  } catch (error) {
    console.error('[search-core] Error enriching events with images:', error);
    return events;
  }
}

/**
 * Collect unique event and product URLs from events array
 */
function collectEventUrls(events) {
  const eventUrls = new Set();
  const productUrls = new Set();

  events.forEach(event => {
    const eventUrl = event.event_url || event.href || event.page_url;
    if (eventUrl) eventUrls.add(eventUrl);
    
    const productUrl = event.product_url;
    if (productUrl) productUrls.add(productUrl);
  });

  return { eventUrls, productUrls };
}

/**
 * Fetch image URLs from page_entities in batches
 */
async function fetchImageUrls(client, eventUrls, productUrls) {
  const imageMap = new Map();
  
  if (eventUrls.size > 0) {
    await fetchImagesByKind(client, Array.from(eventUrls), 'event', imageMap);
  }
  
  if (productUrls.size > 0) {
    await fetchImagesByKind(client, Array.from(productUrls), 'product', imageMap);
  }
  
  return imageMap;
}

/**
 * Fetch images for a specific kind (event or product) in batches
 */
async function fetchImagesByKind(client, urlArray, kind, imageMap) {
  const batchSize = 100;
  for (let i = 0; i < urlArray.length; i += batchSize) {
    const batch = urlArray.slice(i, i + batchSize);
    const { data: entities, error } = await client
      .from('page_entities')
      .select('page_url, image_url')
      .in('page_url', batch)
      .eq('kind', kind)
      .not('image_url', 'is', null);
    
    if (!error && entities) {
      entities.forEach(entity => {
        if (entity.image_url && (kind === 'event' || !imageMap.has(entity.page_url))) {
          imageMap.set(entity.page_url, entity.image_url);
        }
      });
    }
  }
}

/**
 * Merge image URLs into event objects
 */
function mergeImageUrls(events, imageMap) {
  return events.map(event => {
    const eventUrl = event.event_url || event.href || event.page_url;
    const productUrl = event.product_url;
    
    const imageUrl = event.image_url || 
                    (eventUrl ? imageMap.get(eventUrl) : null) ||
                    (productUrl ? imageMap.get(productUrl) : null) ||
                    '';
    
    return {
      ...event,
      image_url: imageUrl
    };
  });
}
