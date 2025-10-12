// /api/ingest.js
// Consolidated ingestion endpoint
// Handles both single URL ingestion and bulk NDJSON streaming
// Replaces: bulk-upload.js, ingest-embed-replace.js

export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';
import { htmlToText } from 'html-to-text';
import { createClient } from '@supabase/supabase-js';
import { extractStructuredDataFromHTML, enhanceDescriptionWithStructuredData, generateContentHash, cleanHTMLText } from '../lib/htmlExtractor.js';

const SELF_BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
const EXPECTED_TOKEN = process.env.INGEST_TOKEN || "";

/* ========== utils ========== */
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chunkText = (txt, size = 3500, overlap = 300) => {
  const out = [];
  for (let i = 0; i < txt.length; i += (size - overlap)) {
    out.push(txt.slice(i, Math.min(i + size, txt.length)).trim());
  }
  return out.filter(Boolean);
};

/* ========== multipart parsing ========== */
async function readRawBody(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  return Buffer.concat(chunks);
}

function parseMultipart(bodyBuf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) throw new Error("Multipart boundary not found.");
  const boundary = m[1] || m[2];
  const parts = bodyBuf.toString("utf8").split(`--${boundary}`);
  const out = {};
  for (const part of parts) {
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;
    const header = part.slice(0, idx);
    let data = part.slice(idx + 4);
    if (data.endsWith("\r\n")) data = data.slice(0, -2);
    if (data.endsWith("--")) data = data.slice(0, -2);
    const nameMatch = /name="([^"]+)"/i.exec(header);
    const filenameMatch = /filename="([^"]+)"/i.exec(header);
    const name = nameMatch ? nameMatch[1] : undefined;
    if (!name) continue;
    out[name] = filenameMatch ? data : data.trim();
  }
  return out;
}

function parseCSV(csvText) {
  const s = csvText.replace(/\r/g, "");
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ========== page fetch (HTML + plain text) ========== */
const PRIMARY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SECONDARY_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchOnce(url, ua, referer, method = 'GET', lang, cookie) {
  // Use Promise.race for timeout instead of AbortController for better compatibility
  const fetchPromise = fetch(url, {
    method,
    redirect: 'follow',
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': lang || 'en-GB,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Origin': 'https://www.alanranger.com',
      // Browser-like fetch hints
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not=A?Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      ...(cookie ? { 'Cookie': cookie } : {}),
      ...(referer ? { 'Referer': referer } : {})
    }
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    if (error.message === 'Request timeout after 30 seconds') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

async function fetchPage(url) {
  // Preflight HEAD with retry/backoff; then GET with UA fallbacks
  const maxAttempts = 3;
  const baseDelay = 400; // ms
  let lastError = null;
  const attempts = [];
  let warmedCookie = '';

  // Cookie warm-up: hit homepage to receive Set-Cookie and reuse
  try {
    const base = 'https://www.alanranger.com';
    const warm = await fetchOnce(base, PRIMARY_UA, base, 'GET');
    const setCookie = warm.headers.get('set-cookie') || '';
    if (setCookie) warmedCookie = setCookie.split('\n').map(s => s.split(';')[0]).join('; ');
    attempts.push({ method: 'GET', ua: 'primary', url: base, warmup: true, status: warm.status, hasCookie: !!warmedCookie });
  } catch (e) {
    attempts.push({ method: 'GET', ua: 'primary', url: 'https://www.alanranger.com', warmup: true, error: e.message });
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try with original URL and with trailing slash as fallback
      // Prefer blog listing referer for blog articles
      const isBlogArticle = /\/blog-on-photography\//.test(url);
      const isWorkshopEvent = /\/photographic-workshops-near-me(\/|$)/.test(url);
      const isCourseEvent = /\/beginners-photography-lessons(\/|$)/.test(url);
      const referer = isBlogArticle ? 'https://www.alanranger.com/blog-on-photography' : url;
      const eventReferer = isWorkshopEvent ? 'https://www.alanranger.com/photographic-workshops-near-me'
                          : isCourseEvent ? 'https://www.alanranger.com/beginners-photography-lessons'
                          : referer;

      // For events, skip HEAD (Squarespace sometimes 404s HEAD). Try GET primary first
      if (isWorkshopEvent || isCourseEvent) {
        let res = await fetchOnce(url, PRIMARY_UA, eventReferer, 'GET', undefined, warmedCookie);
        attempts.push({ method: 'GET', ua: 'primary', referer: eventReferer, status: res.status });
        if (!res.ok && (res.status === 404 || res.status === 429 || (res.status >= 500 && res.status <= 599))) {
          // Retry with secondary UA
          res = await fetchOnce(url, SECONDARY_UA, eventReferer, 'GET', undefined, warmedCookie);
          attempts.push({ method: 'GET', ua: 'secondary', referer: eventReferer, status: res.status });
          // If still failing 404, try with/without trailing slash and homepage referer
          if (!res.ok && res.status === 404) {
            const altUrl = url.endsWith('/') ? url.slice(0,-1) : (url + '/');
            const altReferer = url.split('/').slice(0,3).join('/');
            res = await fetchOnce(altUrl, SECONDARY_UA, altReferer, 'GET', undefined, warmedCookie);
            attempts.push({ method: 'GET', ua: 'secondary', referer: altReferer, urlVariant: 'slash_toggle', status: res.status });
            // Final language-tuned attempt if still 404
            if (!res.ok && res.status === 404) {
              await sleep(150);
              const lang = 'en-GB,en;q=0.8,en-US;q=0.7';
              res = await fetchOnce(url, SECONDARY_UA, eventReferer, 'GET', lang, warmedCookie);
              attempts.push({ method: 'GET', ua: 'secondary', referer: eventReferer, lang, status: res.status, note: 'final_lang_retry' });
            }
          }
        }
        if (res.ok) return res;
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
      } else {
        const head = await fetchOnce(url, PRIMARY_UA, referer, 'HEAD', undefined, warmedCookie);
        attempts.push({ method: 'HEAD', ua: 'primary', referer, status: head.status });
        if (head.ok || head.status === 405 /* method not allowed */) {
          // Proceed to GET with primary UA
          let res = await fetchOnce(url, PRIMARY_UA, referer, 'GET', undefined, warmedCookie);
          attempts.push({ method: 'GET', ua: 'primary', referer, status: res.status });
          if (!res.ok && (res.status === 404 || res.status === 429 || (res.status >= 500 && res.status <= 599))) {
            // Retry with secondary UA
            res = await fetchOnce(url, SECONDARY_UA, referer, 'GET', undefined, warmedCookie);
            attempts.push({ method: 'GET', ua: 'secondary', referer, status: res.status });
            // If still failing 404, try with/without trailing slash and homepage referer
            if (!res.ok && res.status === 404) {
              const altUrl = url.endsWith('/') ? url.slice(0,-1) : (url + '/');
              const altReferer = url.split('/').slice(0,3).join('/');
              res = await fetchOnce(altUrl, SECONDARY_UA, altReferer, 'GET', undefined, warmedCookie);
              attempts.push({ method: 'GET', ua: 'secondary', referer: altReferer, urlVariant: 'slash_toggle', status: res.status });
              // Final language-tuned attempt if still 404
              if (!res.ok && res.status === 404) {
                await sleep(150);
                const lang = 'en-GB,en;q=0.8,en-US;q=0.7';
                res = await fetchOnce(url, SECONDARY_UA, referer, 'GET', lang, warmedCookie);
                attempts.push({ method: 'GET', ua: 'secondary', referer, lang, status: res.status, note: 'final_lang_retry' });
              }
            }
          }
          if (res.ok) return res;
          lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        } else {
          lastError = new Error(`HEAD ${head.status}`);
        }
      }
    } catch (e) {
      lastError = e;
    }
    // Backoff with jitter
    const jitter = Math.floor(Math.random() * 250);
    await sleep(baseDelay * attempt + jitter);
  }
  const err = lastError || new Error('fetch_failed');
  err.attempts = attempts;
  throw err;
}

/* ========== JSON-LD extraction ========== */
function extractJSONLD(html) {
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gis);
  if (!jsonLdMatches) return null;
  
  const jsonLdObjects = [];
  for (const match of jsonLdMatches) {
    let jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    // Harden: strip HTML comments, CDATA, and try to repair common issues
    jsonContent = jsonContent
      .replace(/<!--([\s\S]*?)-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .trim();

    const attempts = [];
    attempts.push(jsonContent);
    // If raw content isn't valid JSON, try to isolate the main object/array
    const firstBrace = jsonContent.indexOf('{');
    const firstBracket = jsonContent.indexOf('[');
    const start = (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) ? firstBracket : firstBrace;
    if (start !== -1) {
      const lastBrace = jsonContent.lastIndexOf('}');
      const lastBracket = jsonContent.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);
      if (end > start) {
        let sliced = jsonContent.slice(start, end + 1);
        // Remove trailing commas before } or ]
        sliced = sliced.replace(/,\s*([}\]])/g, '$1');
        attempts.push(sliced);
      }
    }

    let parsedOk = false;
    for (const candidate of attempts) {
      try {
        const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        jsonLdObjects.push(...parsed);
      } else {
        jsonLdObjects.push(parsed);
      }
        parsedOk = true;
        break;
    } catch (e) {
        // keep trying next strategy
      }
    }
    if (!parsedOk) {
      console.warn('Failed to parse JSON-LD block after repairs. First 80 chars:', jsonContent.slice(0, 80));
    }
  }
  
  return jsonLdObjects.length > 0 ? jsonLdObjects : null;
}

// Extract structured information from page text
function extractStructuredInfo(text) {
  const out = {
    equipmentNeeded: null,
    experienceLevel: null,
  };
  
  if (!text) return out;
  
  // Equipment Needed extraction - look for the pattern in the text
  const equipmentMatch = text.match(/\*\s*EQUIPMENT\s*NEEDED:\s*(.+?)(?=\s*\*[A-Z]|\s*Dates:|$)/i);
  if (equipmentMatch) {
    out.equipmentNeeded = equipmentMatch[1].trim();
  }
  
  // Experience Level extraction - look for the pattern in the text
  const experienceMatch = text.match(/\*\s*Experience\s*-\s*Level:\s*([^*]+?)(?:\*|$)/i);
  if (experienceMatch) {
    out.experienceLevel = experienceMatch[1].trim();
  }
  
  return out;
}

// Normalize JSON-LD @type to allowed page_entities.kind values
function normalizeKind(item, url) {
  const rawType = (item && (item['@type'] || item['@type[]'])) || '';
  const t = Array.isArray(rawType) ? String(rawType[0] || '').toLowerCase() : String(rawType || '').toLowerCase();
  const u = String(url || '').toLowerCase();
  
  // URL-based classification takes priority (overrides JSON-LD type)
  if (u.includes('/photographic-workshops-near-me') || u.includes('/photo-workshops-uk') || u.includes('/beginners-photography-lessons')) return 'event';
  if (u.includes('/blog') || u.includes('/blog-on-photography') || u.includes('/news')) return 'article';
  if (u.includes('/photography-services-near-me') || u.includes('/service') || u.includes('/mentoring')) return 'service';
  
  // Map common schema.org types to our compact set (only if URL doesn't override)
  if (t.includes('event') || t === 'course' || t === 'educationevent') return 'event';
  if (t === 'product' || t === 'offer' || t === 'aggregateoffer') return 'product';
  if (t === 'article' || t === 'blogposting' || t === 'newsarticle' || t === 'creativework') return 'article';
  if (t === 'service' || t === 'organization' || t === 'localbusiness' || t === 'person') return 'service';
  if (t === 'website' || t === 'webpage') return 'article';
  
  // Safe default to 'article' to satisfy DB constraint
  return 'article';
}

/* ========== single URL ingestion ========== */
async function ingestSingleUrl(url, supa, options = {}) {
  let stage = 'fetch';
  try {
    const res = await fetchPage(url);
    const html = await res.text();
    
    stage = 'extract_text';
    const text = htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'nav', format: 'skip' },
        { selector: 'footer', format: 'skip' },
        { selector: 'header', format: 'skip' }
      ]
    });
    
    stage = 'store_raw_html';
    const contentHash = generateContentHash(html);
    try {
      const { error } = await supa.from('page_html').upsert({
        url: url,
        html_content: html,
        content_hash: contentHash,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'url,content_hash'
      });
      
      if (error) {
        console.error('Failed to store raw HTML:', error);
        // Continue processing even if raw HTML storage fails
      } else {
        console.log(`✅ Stored raw HTML for ${url} (${html.length} chars, hash: ${contentHash})`);
      }
    } catch (e) {
      console.error('Exception storing raw HTML:', e);
      // Continue processing even if raw HTML storage fails
    }
    
    stage = 'extract_jsonld';
    const jsonLd = extractJSONLD(html);
    
    // Prioritize JSON-LD objects for better entity selection
    if (jsonLd && jsonLd.length > 1) {
      const urlLower = url.toLowerCase();
      
      // For blog articles, prioritize FAQPage over Organization
      if (urlLower.includes('/blog') || urlLower.includes('/blog-on-photography')) {
        jsonLd.sort((a, b) => {
          const aType = (a['@type'] || '').toLowerCase();
          const bType = (b['@type'] || '').toLowerCase();
          
          // FAQPage gets highest priority for blog articles
          if (aType === 'faqpage' && bType !== 'faqpage') return -1;
          if (bType === 'faqpage' && aType !== 'faqpage') return 1;
          
          // Article gets second priority
          if (aType === 'article' && bType !== 'article') return -1;
          if (bType === 'article' && aType !== 'article') return 1;
          
          // WebSite gets third priority
          if (aType === 'website' && bType !== 'website') return -1;
          if (bType === 'website' && aType !== 'website') return 1;
          
          // Organization gets lowest priority for blog articles
          if (aType === 'organization' && bType !== 'organization') return 1;
          if (bType === 'organization' && aType !== 'organization') return -1;
          
          return 0;
        });
      }
    }
    
    // Extract HTML title as fallback
    const htmlTitleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const htmlTitle = htmlTitleMatch ? htmlTitleMatch[1].trim() : null;
    
    // Extract H1 as another fallback
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const h1Title = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : null;
    
    stage = 'chunk_text';
    const chunks = chunkText(text);
    
    // Find and merge CSV metadata for this URL (handle multiple records intelligently)
    let csvMetadata = null;
    try {
      const { data: metadataList } = await supa
        .from('csv_metadata')
        .select('*')
        .eq('url', url);
      
      if (metadataList && metadataList.length > 0) {
        // Merge all CSV metadata records intelligently - ALL FIELDS
        csvMetadata = {
          id: metadataList[0].id, // Use first ID as primary
          csv_type: metadataList[0].csv_type, // Use first csv_type as primary
          url: url,
          // Merge ALL fields: keep non-null values, prefer more specific data
          title: metadataList.find(m => m.title && m.title.trim())?.title || null,
          categories: metadataList.find(m => m.categories && m.categories.length > 0)?.categories || null,
          tags: metadataList.find(m => m.tags && m.tags.length > 0)?.tags || null,
          publish_date: metadataList.find(m => m.publish_date)?.publish_date || null,
          start_date: metadataList.find(m => m.start_date)?.start_date || null,
          end_date: metadataList.find(m => m.end_date)?.end_date || null,
          start_time: metadataList.find(m => m.start_time)?.start_time || null,
          end_time: metadataList.find(m => m.end_time)?.end_time || null,
          location_name: metadataList.find(m => m.location_name && m.location_name.trim())?.location_name || null,
          location_address: metadataList.find(m => m.location_address && m.location_address.trim())?.location_address || null,
          location_city_state_zip: metadataList.find(m => m.location_city_state_zip && m.location_city_state_zip.trim())?.location_city_state_zip || null,
          excerpt: metadataList.find(m => m.excerpt && m.excerpt.trim())?.excerpt || null,
          image_url: metadataList.find(m => m.image_url && m.image_url.trim())?.image_url || null,
          json_ld_data: metadataList.find(m => m.json_ld_data)?.json_ld_data || null,
          workflow_state: metadataList.find(m => m.workflow_state && m.workflow_state.trim())?.workflow_state || null,
          created_at: metadataList.find(m => m.created_at)?.created_at || null,
          updated_at: metadataList.find(m => m.updated_at)?.updated_at || null,
          import_session: metadataList.find(m => m.import_session)?.import_session || null
        };
      }
    } catch (e) {
      // No CSV metadata found for this URL - that's okay
    }
    
    // Debug: Log if Equipment Needed is in the text
    try {
      await supa.from('debug_logs').insert({
        url: url,
        stage: 'text_analysis',
        data: { 
          textLength: text.length, 
          hasEquipmentNeeded: text.includes('EQUIPMENT NEEDED'),
          textSample: text.substring(0, 1000),
          hasCsvMetadata: !!csvMetadata
        }
      });
    } catch (e) {} // Ignore errors
    
    stage = 'store_chunks';
    const chunkInserts = chunks.map(chunkText => {
      // Clean chunk content to prevent JSON syntax errors
      const cleanChunk = chunkText
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\u0000/g, '') // Remove null bytes
        .trim();
      
      return {
      url: url,
      title: null,
        chunk_text: cleanChunk,
        // CSV metadata fields
        csv_type: csvMetadata?.csv_type || null,
        csv_metadata_id: csvMetadata?.id || null,
      embedding: null,
        chunk_hash: sha1(cleanChunk),
        content: cleanChunk,
        hash: sha1(url + cleanChunk),
        tokens: Math.ceil(cleanChunk.length / 4)
      };
    });
    
    if (!options.dryRun) {
      try {
    // Delete existing chunks for this URL
    await supa.from('page_chunks').delete().eq('url', url);
    // Insert new chunks
    if (chunkInserts.length > 0) {
      const { error: chunkError } = await supa.from('page_chunks').insert(chunkInserts);
          if (chunkError) {
            console.error(`Chunk insert failed for ${url}:`, chunkError);
            // Continue processing even if chunk insertion fails
          } else {
            console.log(`✅ Stored ${chunkInserts.length} chunks for ${url}`);
          }
        }
      } catch (e) {
        console.error(`Exception during chunk processing for ${url}:`, e);
        // Continue processing even if chunk insertion fails
      }
    }
    
    stage = 'store_entities';
    if (jsonLd) {
      // Log JSON-LD objects found directly to database
      try {
        await supa.from('debug_logs').insert({
          url: url,
          stage: 'jsonld_objects',
          data: { count: jsonLd.length, objects: jsonLd.map((item, idx) => ({ idx, type: item['@type'], kind: normalizeKind(item, url) })) }
        });
      } catch (e) {} // Ignore errors
      
      // Extract structured information from raw HTML for products
      let enhancedDescriptions = {};
      const structuredData = extractStructuredDataFromHTML(html);
      
      // Log structured data extraction
      try {
        await supa.from('debug_logs').insert({
          url: url,
          stage: 'structured_data_extracted',
          data: structuredData
        });
      } catch (e) {} // Ignore errors

      // Store enhanced descriptions for ALL entity types
      for (let idx = 0; idx < jsonLd.length; idx++) {
        const item = jsonLd[idx];
        const entityKind = normalizeKind(item, url);
        
        // Clean descriptions for all entity types, but enhance with structured data only for products
        if (entityKind === 'product') {
          const enhancedDescription = enhanceDescriptionWithStructuredData(item.description || '', structuredData);
          enhancedDescriptions[idx] = enhancedDescription;
        } else {
          // For non-products, just clean the HTML without adding structured data
          const cleanedDescription = cleanHTMLText(item.description || '');
          enhancedDescriptions[idx] = cleanedDescription;
        }
        
        // Log enhanced description creation directly to database (fire and forget)
        try {
          await supa.from('debug_logs').insert({
            url: url,
            stage: 'enhanced_description',
            data: { idx: idx, kind: entityKind, description: enhancedDescriptions[idx].substring(0, 300) }
          });
        } catch (e) {} // Ignore errors
      }
      
      // Log enhanced descriptions object directly to database
      try {
        await supa.from('debug_logs').insert({
          url: url,
          stage: 'enhanced_descriptions',
          data: enhancedDescriptions
        });
      } catch (e) {} // Ignore errors
      
      // Select the best JSON-LD object for this URL (prioritized by the sort above)
      const bestJsonLd = jsonLd[0]; // First item after prioritization
      const bestIdx = 0;
      
      // Generate description from FAQPage content if no description exists
      let enhancedDescription = enhancedDescriptions[bestIdx] || bestJsonLd.description || null;
      
      if (!enhancedDescription && bestJsonLd['@type'] === 'FAQPage' && bestJsonLd.mainEntity && Array.isArray(bestJsonLd.mainEntity)) {
        // Generate description from the first FAQ question and answer
        const firstFAQ = bestJsonLd.mainEntity[0];
        if (firstFAQ && firstFAQ.acceptedAnswer && firstFAQ.acceptedAnswer.text) {
          let faqText = firstFAQ.acceptedAnswer.text;
          // Clean HTML tags
          faqText = faqText.replace(/<[^>]*>/g, '').trim();
          // Take first sentence or first 200 characters
          const firstSentence = faqText.split('.')[0] + '.';
          enhancedDescription = firstSentence.length > 200 ? faqText.substring(0, 200) + '...' : firstSentence;
        }
      }
      
      // Log entity creation directly to database (fire and forget)
      supa.from('debug_logs').insert({
        url: url,
        stage: 'entity_creation',
        data: { idx: bestIdx, kind: normalizeKind(bestJsonLd, url), hasEnhanced: !!enhancedDescriptions[bestIdx], descriptionLength: enhancedDescription ? enhancedDescription.length : 0, hasCsvMetadata: !!csvMetadata, structuredData: structuredData }
      }).then(() => {}).catch(() => {}); // Ignore errors
      
      const entities = [{
        url: url,
        kind: normalizeKind(bestJsonLd, url),
        title: bestJsonLd.headline || bestJsonLd.title || bestJsonLd.name || htmlTitle || h1Title || null,
        description: enhancedDescription,
        date_start: bestJsonLd.datePublished || bestJsonLd.startDate || null,
        date_end: bestJsonLd.endDate || null,
        location: bestJsonLd.location?.name || bestJsonLd.location?.address || null,
        price: bestJsonLd.offers?.price || null,
        price_currency: bestJsonLd.offers?.priceCurrency || null,
        availability: bestJsonLd.offers?.availability || null,
        sku: bestJsonLd.sku || null,
        provider: bestJsonLd.provider?.name || bestJsonLd.publisher?.name || 'Alan Ranger Photography',
        source_url: url,
        raw: bestJsonLd,
        entity_hash: sha1(url + JSON.stringify(bestJsonLd) + bestIdx),
          last_seen: new Date().toISOString(),
          // CSV metadata fields - CLEANED - ALL FIELDS NOW EXIST IN PAGE_ENTITIES
          csv_type: csvMetadata?.csv_type || null,
          csv_metadata_id: csvMetadata?.id || null,
          categories: csvMetadata?.categories ? csvMetadata.categories.map(c => cleanHTMLText(c)) : null,
          tags: csvMetadata?.tags ? csvMetadata.tags.map(t => cleanHTMLText(t)) : null,
          publish_date: csvMetadata?.publish_date || null,
          start_date: csvMetadata?.start_date || null,
          end_date: csvMetadata?.end_date || null,
          start_time: csvMetadata?.start_time || null,
          end_time: csvMetadata?.end_time || null,
          location_name: csvMetadata?.location_name ? cleanHTMLText(csvMetadata.location_name) : null,
          location_address: csvMetadata?.location_address ? cleanHTMLText(csvMetadata.location_address) : null,
          location_city_state_zip: csvMetadata?.location_city_state_zip ? cleanHTMLText(csvMetadata.location_city_state_zip) : null,
          excerpt: csvMetadata?.excerpt ? cleanHTMLText(csvMetadata.excerpt) : null,
          image_url: csvMetadata?.image_url ? cleanHTMLText(csvMetadata.image_url) : null,
          json_ld_data: csvMetadata?.json_ld_data || null,
          workflow_state: csvMetadata?.workflow_state ? cleanHTMLText(csvMetadata.workflow_state) : null,
          // NEW STRUCTURED DATA FIELDS - Extract from page content
          participants: structuredData?.participants || null,
          experience_level: structuredData?.experience_level || null,
          equipment_needed: structuredData?.equipment_needed || null,
          location_address: structuredData?.location_address || null,
          time_schedule: structuredData?.time_schedule || null,
          fitness_level: structuredData?.fitness_level || null,
          what_to_bring: structuredData?.what_to_bring || null,
          course_duration: structuredData?.course_duration || null,
          instructor_info: structuredData?.instructor_info || null,
          availability_status: structuredData?.availability_status || null
        }];
      
      if (!options.dryRun) {
        // Merge strategy: always update existing entity for same (url, kind)
        // Rationale: event pages get rescheduled with same URL; dates/times must refresh
        for (const e of entities) {
          // Fetch by natural key (url + kind); assume one primary entity per page
          let existing = null;
          try {
            const resSel = await supa
              .from('page_entities')
              .select('*')
              .eq('url', e.url)
              .eq('kind', e.kind)
              .limit(1)
              .maybeSingle();
            existing = resSel?.data || null;
          } catch {}

          if (existing) {
            const merged = { ...existing };
            
            // Always update CSV metadata fields if available - ALL FIELDS NOW EXIST IN PAGE_ENTITIES
            if (e.csv_metadata_id) {
              merged.csv_type = e.csv_type ?? merged.csv_type;
              merged.csv_metadata_id = e.csv_metadata_id ?? merged.csv_metadata_id;
              merged.categories = e.categories ?? merged.categories;
              merged.tags = e.tags ?? merged.tags;
              merged.publish_date = e.publish_date ?? merged.publish_date;
              merged.start_date = e.start_date ?? merged.start_date;
              merged.end_date = e.end_date ?? merged.end_date;
              merged.start_time = e.start_time ?? merged.start_time;
              merged.end_time = e.end_time ?? merged.end_time;
              merged.location_name = e.location_name ?? merged.location_name;
              merged.location_address = e.location_address ?? merged.location_address;
              merged.location_city_state_zip = e.location_city_state_zip ?? merged.location_city_state_zip;
              merged.excerpt = e.excerpt ?? merged.excerpt;
              merged.image_url = e.image_url ?? merged.image_url;
              merged.json_ld_data = e.json_ld_data ?? merged.json_ld_data;
              merged.workflow_state = e.workflow_state ?? merged.workflow_state;
            }
            
            // Always update structured data fields if available
            merged.participants = e.participants ?? merged.participants;
            merged.experience_level = e.experience_level ?? merged.experience_level;
            merged.equipment_needed = e.equipment_needed ?? merged.equipment_needed;
            merged.location_address = e.location_address ?? merged.location_address;
            merged.time_schedule = e.time_schedule ?? merged.time_schedule;
            merged.fitness_level = e.fitness_level ?? merged.fitness_level;
            merged.what_to_bring = e.what_to_bring ?? merged.what_to_bring;
            merged.course_duration = e.course_duration ?? merged.course_duration;
            merged.instructor_info = e.instructor_info ?? merged.instructor_info;
            merged.availability_status = e.availability_status ?? merged.availability_status;
            
            // Event preservation: keep CSV-derived schedule if present; merge RAW to retain CSV hints
            if (e.kind === 'event') {
              merged.title = e.title ?? merged.title;
              merged.description = e.description ?? merged.description;
              merged.location = e.location ?? merged.location;
              merged.price = e.price ?? merged.price;
              merged.price_currency = e.price_currency ?? merged.price_currency;
              merged.availability = e.availability ?? merged.availability;
              merged.sku = e.sku ?? merged.sku;
              merged.provider = e.provider ?? merged.provider;

              const prevRaw = existing.raw || {};
              const nextRaw = e.raw || {};

              // Strong safeguard: never drop CSV time hints; prefer previous values
              const preservedCsvStart = (prevRaw._csv_start_time != null && prevRaw._csv_start_time !== '') ? prevRaw._csv_start_time : (nextRaw._csv_start_time ?? null);
              const preservedCsvEnd   = (prevRaw._csv_end_time   != null && prevRaw._csv_end_time   !== '') ? prevRaw._csv_end_time   : (nextRaw._csv_end_time   ?? null);

              // Build merged.raw with prev-first, then next, then explicitly re-assert CSV fields
              merged.raw = { ...prevRaw, ...nextRaw };
              merged.raw._csv_start_time = preservedCsvStart;
              merged.raw._csv_end_time   = preservedCsvEnd;

              // Guard schedule: if CSV hints exist, keep existing timestamps; otherwise allow scrape to set
              const hasCsvHints = !!(preservedCsvStart || preservedCsvEnd);
              if (hasCsvHints) {
                merged.date_start = existing.date_start;
                merged.date_end   = existing.date_end;
              } else {
                merged.date_start = e.date_start ?? existing.date_start;
                merged.date_end   = e.date_end ?? existing.date_end;
              }
            } else {
              // Non-event: update with fresh fields
              const overwriteFields = ['title','description','location','price','price_currency','availability','sku','provider','raw'];
              for (const k of overwriteFields) {
                if (e[k] !== undefined && e[k] !== null && e[k] !== '') merged[k] = e[k];
              }
            }
            merged.last_seen = e.last_seen;
            const { error: updErr } = await supa.from('page_entities').update(merged).eq('id', existing.id);
            if (updErr) throw new Error(`Entity update failed: ${updErr.message}`);
          } else {
            // Try insert; if unique constraint blocks, fallback to update existing natural key
            const { error: insErr } = await supa.from('page_entities').insert([e]);
            if (insErr) {
              // Fallback: update by (url, kind)
              const { error: updErr } = await supa
                .from('page_entities')
                .update({
                  title: e.title,
                  description: e.description,
                  date_start: e.date_start,
                  date_end: e.date_end,
                  location: e.location,
                  price: e.price,
                  price_currency: e.price_currency,
                  availability: e.availability,
                  sku: e.sku,
                  provider: e.provider,
                  raw: e.raw,
                  last_seen: e.last_seen,
                  // CSV metadata fields - ALL FIELDS NOW EXIST IN PAGE_ENTITIES
                  csv_type: e.csv_type,
                  csv_metadata_id: e.csv_metadata_id,
                  categories: e.categories,
                  tags: e.tags,
                  publish_date: e.publish_date,
                  start_date: e.start_date,
                  end_date: e.end_date,
                  start_time: e.start_time,
                  end_time: e.end_time,
                  location_name: e.location_name,
                  location_address: e.location_address,
                  location_city_state_zip: e.location_city_state_zip,
                  excerpt: e.excerpt,
                  image_url: e.image_url,
                  json_ld_data: e.json_ld_data,
                  workflow_state: e.workflow_state,
                  // NEW STRUCTURED DATA FIELDS
                  participants: e.participants,
                  experience_level: e.experience_level,
                  equipment_needed: e.equipment_needed,
                  location_address: e.location_address,
                  time_schedule: e.time_schedule,
                  fitness_level: e.fitness_level,
                  what_to_bring: e.what_to_bring,
                  course_duration: e.course_duration,
                  instructor_info: e.instructor_info,
                  availability_status: e.availability_status
                })
                .eq('url', e.url)
                .eq('kind', e.kind);
              if (updErr) throw new Error(`Entity upsert failed: ${updErr.message}`);
            }
          }
        }
      }
      
      // Sync pricing to display table after entity updates
      await supa.rpc('upsert_display_price_all');
    }
    
    return {
      url,
      chunks: chunkInserts.length,
      entities: jsonLd ? jsonLd.length : 0,
      jsonLdFound: !!jsonLd
    };
    
  } catch (err) {
    const diag = (err && err.attempts) ? ` attempts=${JSON.stringify(err.attempts)}` : '';
    throw new Error(`${stage}: ${err.message}${diag}`);
  }
}

/* ========== bulk processing ========== */
async function processBulkUpload(req, res) {
  let stage = 'parse_multipart';
  try {
    const bodyBuf = await readRawBody(req);
    const parts = parseMultipart(bodyBuf, req.headers['content-type']);
    
    const token = parts.token;
    if (token !== EXPECTED_TOKEN) {
      return sendJSON(res, 401, { error: 'unauthorized' });
    }
    
    const csvData = parts.csv;
    if (!csvData) {
      return sendJSON(res, 400, { error: 'bad_request', detail: 'No CSV data provided' });
    }
    
    stage = 'parse_csv';
    const rows = parseCSV(csvData);
    if (rows.length < 2) {
      return sendJSON(res, 400, { error: 'bad_request', detail: 'CSV must have at least header + 1 row' });
    }
    
    const headers = rows[0].map(h => h.toLowerCase());
    const urlIdx = headers.findIndex(h => h.includes('url'));
    if (urlIdx === -1) {
      return sendJSON(res, 400, { error: 'bad_request', detail: 'CSV must have a URL column' });
    }
    
    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));
    
    stage = 'process_urls';
    const results = [];
    const urls = rows.slice(1).map(row => row[urlIdx]).filter(Boolean);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const result = await ingestSingleUrl(url, supa);
        results.push({ url, success: true, ...result });
        
        // Rate limiting
        if (i < urls.length - 1) {
          await sleep(1000);
        }
      } catch (err) {
        // Check if this is a 404 error (hidden/unpublished product)
        const is404 = err.message && (
          err.message.includes('404') || 
          err.message.includes('HEAD 404') ||
          err.message.includes('GET 404')
        );
        
        if (is404) {
          results.push({ url, success: true, skipped: true, reason: 'Product hidden/unpublished (404)', error: err.message });
        } else {
        results.push({ url, success: false, error: err.message });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalChunks = results.reduce((sum, r) => sum + (r.chunks || 0), 0);
    const totalEntities = results.reduce((sum, r) => sum + (r.entities || 0), 0);
    
    return sendJSON(res, 200, {
      ok: true,
      processed: urls.length,
      successful: successCount,
      failed: urls.length - successCount,
      total_chunks: totalChunks,
      total_entities: totalEntities,
      results: results
    });
    
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}

/* ========== main handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });
  
  // Check for bulk upload (multipart form data)
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return processBulkUpload(req, res);
  }
  
  // Single URL ingestion
  let stage = 'auth';
  try {
    const token = req.headers['authorization']?.trim();
    const ingest = `Bearer ${need('INGEST_TOKEN')}`;
    const legacyAdmin = 'Bearer b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';
    
    // Debug logging for authentication
    console.log('DEBUG: Incoming token:', token);
    console.log('DEBUG: Expected ingest token:', ingest);
    console.log('DEBUG: Expected legacy admin token:', legacyAdmin);
    console.log('DEBUG: Token matches ingest:', token === ingest);
    console.log('DEBUG: Token matches legacy admin:', token === legacyAdmin);
    
    if (token !== ingest && token !== legacyAdmin) {
      return sendJSON(res, 401, { error: 'unauthorized', stage, received: token, expected: [ingest, legacyAdmin] });
    }
    
    stage = 'parse_body';
    const { url, csvUrls, dryRun } = req.body || {};
    if (!url && !csvUrls) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "url" or "csvUrls"', stage });
    
    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));
    
    // New mode: ingest multiple URLs from CSV files (array of URL strings)
    if (Array.isArray(csvUrls) && csvUrls.length) {
      stage = 'ingest_bulk_urls';
      const results = [];
      for (let i = 0; i < csvUrls.length; i++) {
        const u = csvUrls[i];
        try {
          const r = await ingestSingleUrl(u, supa, { dryRun: !!dryRun });
          results.push({ url: u, ok: true, ...r });
          // small delay to be polite
          await sleep(500);
        } catch (e) {
          results.push({ url: u, ok: false, error: asString(e) });
        }
      }
      const ok = results.filter(r=>r.ok).length;
      return sendJSON(res, 200, { ok: true, ingested: ok, total: results.length, results });
    }
    
    stage = 'ingest_single';
    const result = await ingestSingleUrl(url, supa, { dryRun: !!dryRun });
    return sendJSON(res, 200, { ok: true, ...result });
    
  } catch (err) {
    // Handle specific error types more gracefully
    if (err.message && err.message.includes('timeout')) {
      return sendJSON(res, 408, { error: 'timeout', detail: 'Request timed out after 30 seconds', stage });
    } else if (err.message && err.message.includes('aborted')) {
      return sendJSON(res, 408, { error: 'timeout', detail: 'Request was aborted due to timeout', stage });
    } else if (err.message && (err.message.includes('404') || err.message.includes('HEAD 404') || err.message.includes('GET 404'))) {
      return sendJSON(res, 200, { ok: true, skipped: true, reason: 'Product hidden/unpublished (404)', detail: asString(err), stage });
    } else {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
    }
  }
}
