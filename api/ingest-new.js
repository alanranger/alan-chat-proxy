// /api/ingest-new.js
// CSV-driven ingestion system
// Uses CSV metadata as source of truth, HTML parsing only for content enrichment

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';
import { extractStructuredDataFromHTML, cleanHTMLText } from '../lib/htmlExtractor.js';

/* ========== utils ========== */
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const asString = (e) => {
  if (!e) return '(unknown)';
  if (typeof e === 'string') return e;
  if (e.message && typeof e.message === 'string') return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};

const sendJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (obj && 'detail' in obj) obj.detail = asString(obj.detail);
  res.status(status).send(JSON.stringify(obj));
};

/* ========== Fetch with timeout ========== */
async function fetchWithTimeout(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlanRangerBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/* ========== Get URLs from CSV tables ========== */
async function getUrlsFromCSVTables(supa, recent = false) {
  const urls = [];
  
  // Get URLs from all CSV tables
  const tables = [
    'blog_articles',
    'course_events', 
    'workshop_events',
    'course_products',
    'workshop_products',
    'site_urls'
  ];
  
  for (const table of tables) {
    let query = supa.from(table).select('*');
    
    if (recent) {
      // Get records created in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      query = query.gte('created_at', fiveMinutesAgo);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      continue;
    }
    
    if (data) {
      data.forEach(record => {
        let url = '';
        let title = '';
        let publishDate = null;
        let sourceType = table;
        
        // Extract URL and title based on table structure
        switch (table) {
          case 'blog_articles':
            url = record.full_url;
            title = record.title;
            publishDate = record.publish_date;
            break;
          case 'course_events':
            url = record.event_url;
            title = record.event_title;
            publishDate = record.published_date;
            break;
          case 'workshop_events':
            url = record.event_url;
            title = record.event_title;
            publishDate = record.published_date;
            break;
          case 'course_products':
            url = record.full_url;
            title = record.title;
            publishDate = record.publish_date;
            break;
          case 'workshop_products':
            url = record.full_url;
            title = record.title;
            publishDate = record.publish_date;
            break;
          case 'site_urls':
            url = record.url;
            title = record.title;
            break;
        }
        
        if (url) {
          urls.push({
            url,
            title,
            publishDate,
            sourceType,
            csvData: record
          });
        }
      });
    }
  }
  
  return urls;
}

/* ========== Process single URL ========== */
async function processUrl(supa, urlData) {
  const { url, title, publishDate, sourceType, csvData } = urlData;
  
  try {
    // Fetch HTML content
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          url,
          ok: true,
          skipped: true,
          reason: 'Product hidden/unpublished (404)'
        };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract structured data from HTML
    const structuredData = extractStructuredDataFromHTML(html);
    
    // Clean HTML content
    const cleanedDescription = cleanHTMLText(structuredData.description || '');
    
    // Create page_entities record using CSV data as source of truth
    const entityData = {
      page_url: url,
      title: title, // Use CSV title, not HTML title
      description: cleanedDescription,
      raw: structuredData.jsonLd || {},
      last_seen: new Date().toISOString(),
      kind: sourceType === 'blog_articles' ? 'article' : 'service',
      csv_type: sourceType,
      publish_date: publishDate, // Use CSV publish date
      csv_metadata: csvData // Store full CSV data for reference
    };
    
    // Upsert page_entities
    const { error: entityError } = await supa
      .from('page_entities')
      .upsert(entityData, { onConflict: 'page_url' });
    
    if (entityError) {
      console.error('Error upserting page_entities:', entityError);
    }
    
    // Store HTML content
    const { error: htmlError } = await supa
      .from('page_html')
      .upsert({
        url: url,
        html_content: html,
        last_updated: new Date().toISOString()
      }, { onConflict: 'url' });
    
    if (htmlError) {
      console.error('Error upserting page_html:', htmlError);
    }
    
    // Create content chunks
    if (cleanedDescription) {
      const chunks = cleanedDescription
        .split('\n\n')
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 50)
        .slice(0, 10); // Limit to 10 chunks per page
      
      if (chunks.length > 0) {
        const chunkData = chunks.map((chunk, index) => ({
          url: url,
          chunk_text: chunk,
          chunk_index: index,
          created_at: new Date().toISOString()
        }));
        
        const { error: chunkError } = await supa
          .from('page_chunks')
          .upsert(chunkData, { onConflict: 'url,chunk_index' });
        
        if (chunkError) {
          console.error('Error upserting page_chunks:', chunkError);
        }
      }
    }
    
    return {
      url,
      ok: true,
      processed: true,
      chunks: cleanedDescription ? cleanedDescription.split('\n\n').length : 0
    };
    
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return {
      url,
      ok: false,
      error: asString(error)
    };
  }
}

/* ========== Main handler ========== */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJSON(res, 405, { error: 'Method not allowed' });
    }

    const { recent = false, batchSize = 10 } = req.body;
    
    // Initialize Supabase client
    const supa = createClient(
      need('SUPABASE_URL'),
      need('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    // Get URLs from CSV tables
    const urls = await getUrlsFromCSVTables(supa, recent);
    
    if (urls.length === 0) {
      return sendJSON(res, 200, {
        success: true,
        message: 'No URLs to process',
        processed: 0,
        skipped: 0,
        failed: 0
      });
    }
    
    // Process URLs in batches
    const results = [];
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(urlData => processUrl(supa, urlData))
      );
      
      results.push(...batchResults);
      
      // Count results
      batchResults.forEach(result => {
        if (result.skipped) {
          skipped++;
        } else if (result.ok) {
          processed++;
        } else {
          failed++;
        }
      });
      
      // Add delay between batches
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return sendJSON(res, 200, {
      success: true,
      total: urls.length,
      processed,
      skipped,
      failed,
      results: results.slice(0, 100) // Limit results for response size
    });
    
  } catch (error) {
    console.error('Ingestion error:', error);
    return sendJSON(res, 500, { 
      error: 'Ingestion failed', 
      detail: asString(error) 
    });
  }
}
