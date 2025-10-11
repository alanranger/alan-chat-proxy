// /api/csv-import.js
// Consolidated CSV import for all content types
// Handles: blog, workshop, service, product, and event imports
// Replaces: csv-bulk-import.js, csv-multi-import.js, csv-events-import.js

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { cleanHTMLText } from '../lib/htmlExtractor.js';

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

/* ========== CSV parsing ========== */
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // Proper CSV parser that handles multi-line content within quoted fields
  function parseCSVLine(line, startIndex = 0) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = startIndex;
    
    while (i < line.length) {
      const ch = line[i];
      if (ch === '"') {
        // Handle escaped quotes
        if (inQuotes && line[i + 1] === '"') { 
          current += '"'; 
          i += 2; 
          continue; 
        }
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
        i++;
        continue;
      } else {
        current += ch;
      }
      i++;
    }
    result.push(current);
    return result.map(s => s.replace(/^\s+|\s+$/g, '').replace(/^"|"$/g, ''));
  }

  // Find the header line
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase());
  
  const rows = [];
  let i = 1;
  
  while (i < lines.length) {
    let line = lines[i];
    
    // If line is empty, skip
    if (!line.trim()) {
      i++;
      continue;
    }
    
    // Check if we're in the middle of a multi-line quoted field
    let quoteCount = (line.match(/"/g) || []).length;
    let j = i + 1;
    
    // If odd number of quotes, we're in a multi-line field - keep concatenating
    while (quoteCount % 2 !== 0 && j < lines.length) {
      line += '\n' + lines[j];
      quoteCount = (line.match(/"/g) || []).length;
      j++;
    }
    
    const values = parseCSVLine(line);
    
    // Only process if we have the right number of columns
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    } else {
      // Log problematic rows for debugging
      console.warn(`CSV row ${i} has ${values.length} columns, expected ${headers.length}:`, values.slice(0, 3));
    }
    
    i = j;
  }
  
  return rows;
}

// Normalize a date string that may be in UK day-first format (DD/MM/YYYY)
// to ISO date (YYYY-MM-DD). Leaves ISO-like inputs unchanged.
function normalizeDateDayFirst(input) {
  if (!input) return null;
  const s = String(input).trim();
  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or D/M/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // If it contains a 'T' already like DD/MM/YYYYTHH:mm[:ss]
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})T(.+)$/);
  if (m2) {
    const dd = m2[1].padStart(2, '0');
    const mm = m2[2].padStart(2, '0');
    const yyyy = m2[3];
    const rest = m2[4];
    // Return just the date part; caller will re-attach time
    return `${yyyy}-${mm}-${dd}`;
  }
  // Fallback: return as-is; DB will validate
  return s;
}

/* ========== Debug Helper Functions ========== */
function logFieldTrackingStats(csvType, fieldStats, metadataLength, totalRows) {
  console.log(`DEBUG: ${csvType} import completed:`);
  console.log(`  • Total rows: ${fieldStats.total_rows}`);
  console.log(`  • Records imported: ${metadataLength}`);
  console.log(`  • Success rate: ${(metadataLength / totalRows * 100).toFixed(1)}%`);
  console.log(`  • Field statistics:`);
  fieldStats.fields_expected.forEach(field => {
    const found = fieldStats.fields_found[field] || 0;
    const success = fieldStats.fields_success[field] || 0;
    const foundRate = fieldStats.total_rows > 0 ? (found / fieldStats.total_rows * 100).toFixed(1) : 0;
    const successRate = found > 0 ? (success / found * 100).toFixed(1) : 0;
    console.log(`    - ${field}: ${found}/${fieldStats.total_rows} found (${foundRate}%), ${success}/${found} success (${successRate}%)`);
  });
}

/* ========== CSV Metadata Import Functions ========== */

// Import CSV metadata for blog articles (BOM fix applied)
async function importBlogMetadata(rows, supa) {
  const fieldStats = {
    total_rows: rows.length,
    fields_expected: ['url', 'title', 'categories', 'tags', 'publish_date', 'image_url'],
    fields_found: {},
    fields_success: {},
    sample_row: rows[0] || {}
  };
  
  const metadata = rows.map(row => {
    // Debug logging for first few rows - BOM FIX VERSION 2
    if (rows.indexOf(row) < 3) {
      console.log(`DEBUG V2: Row ${rows.indexOf(row)} - Categories: "${row.Categories}", Tags: "${row.Tags}"`);
      console.log(`DEBUG V2: Title field: "${row['﻿Title']}", Regular Title: "${row.Title}"`);
    }
    
    const item = {
      csv_type: 'blog',
      url: row['full url'] || row['Full Url'] || row.url,
      title: row['﻿Title'] || row.Title || row.title ? cleanHTMLText(row['﻿Title'] || row.Title || row.title) : null,
      categories: (row.Categories && row.Categories.trim()) ? row.Categories.split(';').map(c => cleanHTMLText(c.trim())).filter(Boolean) : [],
      tags: (row.Tags && row.Tags.trim()) ? row.Tags.split(',').map(t => cleanHTMLText(t.trim())).filter(Boolean) : [],
      publish_date: normalizeDateDayFirst(row['Publish On'] || row['publish on']),
      image_url: row.Image || row.image ? cleanHTMLText(row.Image || row.image) : null,
      excerpt: null,
      import_session: new Date().toISOString()
    };
    
    // Debug logging for processed item
    if (rows.indexOf(row) < 3) {
      console.log(`DEBUG: Processed item - categories:`, item.categories, `tags:`, item.tags);
    }
    
    // Track field success
    fieldStats.fields_found.url = (fieldStats.fields_found.url || 0) + (item.url ? 1 : 0);
    fieldStats.fields_found.title = (fieldStats.fields_found.title || 0) + (item.title ? 1 : 0);
    fieldStats.fields_found.categories = (fieldStats.fields_found.categories || 0) + (item.categories.length > 0 ? 1 : 0);
    fieldStats.fields_found.tags = (fieldStats.fields_found.tags || 0) + (item.tags.length > 0 ? 1 : 0);
    fieldStats.fields_found.publish_date = (fieldStats.fields_found.publish_date || 0) + (item.publish_date ? 1 : 0);
    fieldStats.fields_found.image_url = (fieldStats.fields_found.image_url || 0) + (item.image_url ? 1 : 0);
    
    return item;
  }).filter(item => item.url);

  if (metadata.length > 0) {
    const { error } = await supa.from('csv_metadata').upsert(metadata, { onConflict: 'csv_type,url' });
    if (error) throw error;
    
    // Track successful imports
    fieldStats.fields_success = { ...fieldStats.fields_found };
  }
  
  // Debug logging for field tracking
  logFieldTrackingStats('blog', fieldStats, metadata.length, rows.length);
  
  return { 
    count: metadata.length, 
    field_stats: fieldStats,
    success_rate: metadata.length / rows.length * 100
  };
}

// Import CSV metadata for course events
async function importCourseEventMetadata(rows, supa) {
  const fieldStats = {
    total_rows: rows.length,
    fields_expected: ['url', 'title', 'categories', 'tags', 'start_date', 'end_date', 'start_time', 'end_time', 'location_name', 'location_address', 'excerpt', 'image_url'],
    fields_found: {},
    fields_success: {},
    sample_row: rows[0] || {}
  };
  
  const metadata = rows.map(row => {
    const item = {
      csv_type: 'course_events',
      url: row.event_url || row.Event_URL || row['Event URL'] || row.url,
      title: row.event_title || row.Event_Title || row['Event Title'] || row.title ? cleanHTMLText(row.event_title || row.Event_Title || row['Event Title'] || row.title) : null,
      categories: row.Category ? row.Category.split(',').map(c => cleanHTMLText(c.trim())).filter(Boolean) : [],
      tags: row.Tags ? row.Tags.split(',').map(t => cleanHTMLText(t.trim())).filter(Boolean) : [],
      start_date: normalizeDateDayFirst(row.Start_Date || row['Start Date']),
      end_date: normalizeDateDayFirst(row.End_Date || row['End Date']),
      start_time: row.Start_Time || row['Start Time'],
      end_time: row.End_Time || row['End Time'],
      location_name: row.Location_Business_Name || row['Location Business Name'] ? cleanHTMLText(row.Location_Business_Name || row['Location Business Name']) : null,
      location_address: row.Location_Address || row['Location Address'] ? cleanHTMLText(row.Location_Address || row['Location Address']) : null,
      location_city_state_zip: row.Location_City_State_ZIP || row['Location City State ZIP'] ? cleanHTMLText(row.Location_City_State_ZIP || row['Location City State ZIP']) : null,
      excerpt: row.Excerpt || row.excerpt ? cleanHTMLText(row.Excerpt || row.excerpt) : null,
      image_url: row.Event_Image || row['Event Image'] ? cleanHTMLText(row.Event_Image || row['Event Image']) : null,
      workflow_state: row.Workflow_State || row['Workflow State'] ? cleanHTMLText(row.Workflow_State || row['Workflow State']) : null,
      import_session: new Date().toISOString()
    };
    
    // Track field success
    fieldStats.fields_found.url = (fieldStats.fields_found.url || 0) + (item.url ? 1 : 0);
    fieldStats.fields_found.title = (fieldStats.fields_found.title || 0) + (item.title ? 1 : 0);
    fieldStats.fields_found.categories = (fieldStats.fields_found.categories || 0) + (item.categories.length > 0 ? 1 : 0);
    fieldStats.fields_found.tags = (fieldStats.fields_found.tags || 0) + (item.tags.length > 0 ? 1 : 0);
    fieldStats.fields_found.start_date = (fieldStats.fields_found.start_date || 0) + (item.start_date ? 1 : 0);
    fieldStats.fields_found.end_date = (fieldStats.fields_found.end_date || 0) + (item.end_date ? 1 : 0);
    fieldStats.fields_found.start_time = (fieldStats.fields_found.start_time || 0) + (item.start_time ? 1 : 0);
    fieldStats.fields_found.end_time = (fieldStats.fields_found.end_time || 0) + (item.end_time ? 1 : 0);
    fieldStats.fields_found.location_name = (fieldStats.fields_found.location_name || 0) + (item.location_name ? 1 : 0);
    fieldStats.fields_found.location_address = (fieldStats.fields_found.location_address || 0) + (item.location_address ? 1 : 0);
    fieldStats.fields_found.excerpt = (fieldStats.fields_found.excerpt || 0) + (item.excerpt ? 1 : 0);
    fieldStats.fields_found.image_url = (fieldStats.fields_found.image_url || 0) + (item.image_url ? 1 : 0);
    
    return item;
  }).filter(item => item.url);

  if (metadata.length > 0) {
    const { error } = await supa.from('csv_metadata').upsert(metadata, { onConflict: 'csv_type,url' });
    if (error) throw error;
    
    // Track successful imports
    fieldStats.fields_success = { ...fieldStats.fields_found };
  }
  
  // Debug logging for field tracking
  logFieldTrackingStats('course_events', fieldStats, metadata.length, rows.length);
  
  return { 
    count: metadata.length, 
    field_stats: fieldStats,
    success_rate: metadata.length / rows.length * 100
  };
}

// Import CSV metadata for workshop events
async function importWorkshopEventMetadata(rows, supa) {
  const fieldStats = {
    total_rows: rows.length,
    fields_expected: ['url', 'title', 'categories', 'tags', 'start_date', 'end_date', 'start_time', 'end_time', 'location_name', 'location_address', 'excerpt', 'image_url'],
    fields_found: {},
    fields_success: {},
    sample_row: rows[0] || {}
  };
  
  const metadata = rows.map(row => {
    const item = {
      csv_type: 'workshop_events',
      url: row.event_url || row.Event_URL || row['Event URL'] || row.url,
      title: row.event_title || row.Event_Title || row['Event Title'] || row.title ? cleanHTMLText(row.event_title || row.Event_Title || row['Event Title'] || row.title) : null,
      categories: row.Category ? row.Category.split(',').map(c => cleanHTMLText(c.trim())).filter(Boolean) : [],
      tags: row.Tags ? row.Tags.split(',').map(t => cleanHTMLText(t.trim())).filter(Boolean) : [],
      start_date: normalizeDateDayFirst(row.Start_Date || row['Start Date']),
      end_date: normalizeDateDayFirst(row.End_Date || row['End Date']),
      start_time: row.Start_Time || row['Start Time'],
      end_time: row.End_Time || row['End Time'],
      location_name: row.Location_Business_Name || row['Location Business Name'] ? cleanHTMLText(row.Location_Business_Name || row['Location Business Name']) : null,
      location_address: row.Location_Address || row['Location Address'] ? cleanHTMLText(row.Location_Address || row['Location Address']) : null,
      location_city_state_zip: row.Location_City_State_ZIP || row['Location City State ZIP'] ? cleanHTMLText(row.Location_City_State_ZIP || row['Location City State ZIP']) : null,
      excerpt: row.Excerpt || row.excerpt ? cleanHTMLText(row.Excerpt || row.excerpt) : null,
      image_url: row.Event_Image || row['Event Image'] ? cleanHTMLText(row.Event_Image || row['Event Image']) : null,
      workflow_state: row.Workflow_State || row['Workflow State'] ? cleanHTMLText(row.Workflow_State || row['Workflow State']) : null,
      import_session: new Date().toISOString()
    };
    
    // Track field success
    fieldStats.fields_found.url = (fieldStats.fields_found.url || 0) + (item.url ? 1 : 0);
    fieldStats.fields_found.title = (fieldStats.fields_found.title || 0) + (item.title ? 1 : 0);
    fieldStats.fields_found.categories = (fieldStats.fields_found.categories || 0) + (item.categories.length > 0 ? 1 : 0);
    fieldStats.fields_found.tags = (fieldStats.fields_found.tags || 0) + (item.tags.length > 0 ? 1 : 0);
    fieldStats.fields_found.start_date = (fieldStats.fields_found.start_date || 0) + (item.start_date ? 1 : 0);
    fieldStats.fields_found.end_date = (fieldStats.fields_found.end_date || 0) + (item.end_date ? 1 : 0);
    fieldStats.fields_found.start_time = (fieldStats.fields_found.start_time || 0) + (item.start_time ? 1 : 0);
    fieldStats.fields_found.end_time = (fieldStats.fields_found.end_time || 0) + (item.end_time ? 1 : 0);
    fieldStats.fields_found.location_name = (fieldStats.fields_found.location_name || 0) + (item.location_name ? 1 : 0);
    fieldStats.fields_found.location_address = (fieldStats.fields_found.location_address || 0) + (item.location_address ? 1 : 0);
    fieldStats.fields_found.excerpt = (fieldStats.fields_found.excerpt || 0) + (item.excerpt ? 1 : 0);
    fieldStats.fields_found.image_url = (fieldStats.fields_found.image_url || 0) + (item.image_url ? 1 : 0);
    
    return item;
  }).filter(item => item.url);

  if (metadata.length > 0) {
    const { error } = await supa.from('csv_metadata').upsert(metadata, { onConflict: 'csv_type,url' });
    if (error) throw error;
    
    // Track successful imports
    fieldStats.fields_success = { ...fieldStats.fields_found };
  }
  
  // Debug logging for field tracking
  logFieldTrackingStats('workshop_events', fieldStats, metadata.length, rows.length);
  
  return { 
    count: metadata.length, 
    field_stats: fieldStats,
    success_rate: metadata.length / rows.length * 100
  };
}

// Import CSV metadata for course products
async function importCourseProductMetadata(rows, supa) {
  const fieldStats = {
    total_rows: rows.length,
    fields_expected: ['url', 'title', 'categories', 'tags', 'publish_date', 'image_url'],
    fields_found: {},
    fields_success: {},
    sample_row: rows[0] || {}
  };
  
  const metadata = rows.map(row => {
    const item = {
      csv_type: 'course_products',
      url: row['full url'] || row['Full Url'] || row.url,
      title: row.Title || row.title ? cleanHTMLText(row.Title || row.title) : null,
      categories: row.Categories ? row.Categories.split(';').map(c => cleanHTMLText(c.trim())).filter(Boolean) : [],
      tags: row.Tags ? row.Tags.split(',').map(t => cleanHTMLText(t.trim())).filter(Boolean) : [],
      publish_date: normalizeDateDayFirst(row['Publish On'] || row['publish on']),
      image_url: row.Image || row.image ? cleanHTMLText(row.Image || row.image) : null,
      excerpt: null,
      import_session: new Date().toISOString()
    };
    
    // Track field success
    fieldStats.fields_found.url = (fieldStats.fields_found.url || 0) + (item.url ? 1 : 0);
    fieldStats.fields_found.title = (fieldStats.fields_found.title || 0) + (item.title ? 1 : 0);
    fieldStats.fields_found.categories = (fieldStats.fields_found.categories || 0) + (item.categories.length > 0 ? 1 : 0);
    fieldStats.fields_found.tags = (fieldStats.fields_found.tags || 0) + (item.tags.length > 0 ? 1 : 0);
    fieldStats.fields_found.publish_date = (fieldStats.fields_found.publish_date || 0) + (item.publish_date ? 1 : 0);
    fieldStats.fields_found.image_url = (fieldStats.fields_found.image_url || 0) + (item.image_url ? 1 : 0);
    
    return item;
  }).filter(item => item.url);

  if (metadata.length > 0) {
    const { error } = await supa.from('csv_metadata').upsert(metadata, { onConflict: 'csv_type,url' });
    if (error) throw error;
    
    // Track successful imports
    fieldStats.fields_success = { ...fieldStats.fields_found };
  }
  
  // Debug logging for field tracking
  logFieldTrackingStats('course_products', fieldStats, metadata.length, rows.length);
  
  return { 
    count: metadata.length, 
    field_stats: fieldStats,
    success_rate: metadata.length / rows.length * 100
  };
}

// Import CSV metadata for workshop products
async function importWorkshopProductMetadata(rows, supa) {
  const fieldStats = {
    total_rows: rows.length,
    fields_expected: ['url', 'title', 'categories', 'tags', 'publish_date', 'image_url'],
    fields_found: {},
    fields_success: {},
    sample_row: rows[0] || {}
  };
  
  const metadata = rows.map(row => {
    const item = {
      csv_type: 'workshop_products',
      url: row['Full Url'] || row['full url'] || row.url,
      title: row.Title || row.title ? cleanHTMLText(row.Title || row.title) : null,
      categories: row.Categories ? row.Categories.split(';').map(c => cleanHTMLText(c.trim())).filter(Boolean) : (row.categories ? row.categories.split(';').map(c => cleanHTMLText(c.trim())).filter(Boolean) : []),
      tags: row.Tags ? row.Tags.split(',').map(t => cleanHTMLText(t.trim())).filter(Boolean) : (row.tags ? row.tags.split(',').map(t => cleanHTMLText(t.trim())).filter(Boolean) : []),
      publish_date: normalizeDateDayFirst(row['Publish On'] || row['publish on']),
      image_url: row.Image || row.image ? cleanHTMLText(row.Image || row.image) : null,
      excerpt: null,
      import_session: new Date().toISOString()
    };
    
    // Track field success
    fieldStats.fields_found.url = (fieldStats.fields_found.url || 0) + (item.url ? 1 : 0);
    fieldStats.fields_found.title = (fieldStats.fields_found.title || 0) + (item.title ? 1 : 0);
    fieldStats.fields_found.categories = (fieldStats.fields_found.categories || 0) + (item.categories.length > 0 ? 1 : 0);
    fieldStats.fields_found.tags = (fieldStats.fields_found.tags || 0) + (item.tags.length > 0 ? 1 : 0);
    fieldStats.fields_found.publish_date = (fieldStats.fields_found.publish_date || 0) + (item.publish_date ? 1 : 0);
    fieldStats.fields_found.image_url = (fieldStats.fields_found.image_url || 0) + (item.image_url ? 1 : 0);
    
    return item;
  }).filter(item => item.url);

  if (metadata.length > 0) {
    const { error } = await supa.from('csv_metadata').upsert(metadata, { onConflict: 'csv_type,url' });
    if (error) throw error;
    
    // Track successful imports
    fieldStats.fields_success = { ...fieldStats.fields_found };
  }
  
  // Debug logging for field tracking
  logFieldTrackingStats('workshop_products', fieldStats, metadata.length, rows.length);
  
  return { 
    count: metadata.length, 
    field_stats: fieldStats,
    success_rate: metadata.length / rows.length * 100
  };
}

// Import CSV metadata for site URLs
async function importSiteUrlMetadata(rows, supa) {
  const metadata = rows.map(row => ({
    csv_type: 'site_urls',
    url: row.url,
    title: row.title ? cleanHTMLText(row.title) : null,
    categories: [],
    tags: [],
    publish_date: null,
    image_url: null,
    excerpt: null,
    import_session: new Date().toISOString() // Track when this was imported
  })).filter(item => item.url);

  if (metadata.length > 0) {
    const { error } = await supa.from('csv_metadata').upsert(metadata, { onConflict: 'csv_type,url' });
    if (error) throw error;
  }
  return { count: metadata.length };
}

// Import CSV metadata for product schema
async function importProductSchemaMetadata(rows, supa) {
  const metadata = rows.map(row => {
    let jsonLdData = null;
    try {
      // Extract JSON-LD from the structured data field
      const jsonLdText = row['JSON-LD Structured Data'] || row['json-ld structured data'];
      if (jsonLdText) {
        // Remove script tags and extract JSON
        const jsonMatch = jsonLdText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonLdData = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to parse JSON-LD for:', row.Title);
    }

    return {
      csv_type: 'product_schema',
      url: jsonLdData?.url || null,
      title: row.Title || row.title ? cleanHTMLText(row.Title || row.title) : null,
      categories: [],
      tags: [],
      publish_date: null,
      image_url: jsonLdData?.image ? cleanHTMLText(jsonLdData.image) : null,
      excerpt: jsonLdData?.description ? cleanHTMLText(jsonLdData.description) : null,
      json_ld_data: jsonLdData,
      import_session: new Date().toISOString() // Track when this was imported
    };
  }).filter(item => item.url);

  if (metadata.length > 0) {
    const { error } = await supa.from('csv_metadata').upsert(metadata, { onConflict: 'csv_type,url' });
    if (error) throw error;
  }
  return { count: metadata.length };
}

/* ========== CSV-Enhanced Blog data transformation ========== */
async function transformBlogDataWithCSV(row, supa) {
  const title = row.title;
  const url = row['full url'] || row['url id'] || row.url;
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()).filter(Boolean) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const imageUrl = row.image;
  // Accept UK-style dates like 23/07/2018 and normalize to YYYY-MM-DD
  const rawDate = row['publish on'] || row.publish_on;
  let publishDate = rawDate;
  if (rawDate && /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
    const [dd, mm, yyyy] = rawDate.split('/');
    publishDate = `${yyyy}-${mm}-${dd}`;
  }
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "url": url,
    "datePublished": publishDate,
    "author": { "@type": "Person", "name": "Alan Ranger" },
    "publisher": { "@type": "Organization", "name": "Alan Ranger Photography" },
    "image": imageUrl,
    "keywords": tags.join(', '),
    "articleSection": categories.join(', ')
  };
  
  return {
    url: url,
    page_url: url, // Add page_url field for compatibility
    kind: 'article',
    title: title,
    description: null,
    date_start: publishDate,
    date_end: null,
    location: null,
    price: null,
    price_currency: null,
    availability: null,
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::article::${title}::${publishDate}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString(),
    // CSV metadata fields
    csv_type: 'blog_articles',
    categories: categories,
    tags: tags,
    publish_date: publishDate,
    image_url: imageUrl,
    excerpt: null
  };
}

/* ========== Legacy Blog data transformation ========== */
function transformBlogData(row) {
  const title = row.title;
  const url = row['full url'] || row['url id'] || row.url;
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()).filter(Boolean) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const imageUrl = row.image;
  // Accept UK-style dates like 23/07/2018 and normalize to YYYY-MM-DD
  const rawDate = row['publish on'] || row.publish_on;
  let publishDate = rawDate;
  if (rawDate && /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
    const [dd, mm, yyyy] = rawDate.split('/');
    publishDate = `${yyyy}-${mm}-${dd}`;
  }
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "url": url,
    "datePublished": publishDate,
    "author": { "@type": "Person", "name": "Alan Ranger" },
    "publisher": { "@type": "Organization", "name": "Alan Ranger Photography" },
    "image": imageUrl,
    "keywords": tags.join(', '),
    "articleSection": categories.join(', ')
  };
  
  return {
    url: url,
    kind: 'article',
    title: title,
    description: null,
    date_start: publishDate,
    date_end: null,
    location: null,
    price: null,
    price_currency: null,
    availability: null,
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::article::${title}::${publishDate}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString()
  };
}

/* ========== Workshop data transformation ========== */
function transformWorkshopData(row) {
  const title = row.title || row['event title'] || row['event_title'];
  const url = row['full url'] || row['url id'] || row['event url'] || row['event_url'] || row.url;
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()).filter(Boolean) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const imageUrl = row.image || row['event image'] || row['event_image'];
  
  // Map date/time/location fields from CSV
  // Normalize dates (accept DD/MM/YYYY and YYYY-MM-DD)
  const startDateRaw = row.Start_Date || row.start_date;
  const endDateRaw = row.End_Date || row.end_date;
  const startDate = normalizeDateDayFirst(startDateRaw);
  const endDate = normalizeDateDayFirst(endDateRaw);
  // Normalize times to HH:MM:SS without timezone shifts
  const normalizeTime = (t) => {
    if (!t) return null;
    const tt = String(t).trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(tt)) return tt;
    if (/^\d{2}:\d{2}$/.test(tt)) return `${tt}:00`;
    return tt;
  };
  const startTime = normalizeTime(row.Start_Time || row.start_time);
  const endTime = normalizeTime(row.End_Time || row.end_time);
  const location = row.Location_Business_Name || row.location_business_name || row.location;
  
  // Combine date and time for database storage
  const dateStart = startDate && startTime ? `${startDate}T${startTime}` : (startDate || null);
  const dateEnd = endDate && endTime ? `${endDate}T${endTime}` : (endDate || null);
  
  // Extract location hints from tags
  const locationHints = [];
  if (tags.includes('warwickshire')) locationHints.push('Warwickshire');
  if (tags.includes('suffolk')) locationHints.push('Suffolk');
  if (tags.includes('derbyshire')) locationHints.push('Derbyshire');
  if (tags.includes('devon')) locationHints.push('Devon');
  if (tags.includes('northumbria')) locationHints.push('Northumberland');
  if (tags.includes('coventry')) locationHints.push('Coventry');
  if (tags.includes('cumbria')) locationHints.push('Cumbria');
  
  // Determine workshop type from categories
  let workshopType = 'workshop';
  if (categories.includes('half-day photo workshops')) workshopType = 'half-day';
  else if (categories.includes('one day photo workshops')) workshopType = 'one-day';
  else if (categories.includes('weekend residential photo workshops')) workshopType = 'weekend';
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": title,
    "url": url,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "organizer": { "@type": "Organization", "name": "Alan Ranger Photography" },
    "image": imageUrl,
    "keywords": tags.join(', '),
    "eventType": workshopType,
    "location": locationHints.length > 0 ? { "@type": "Place", "name": locationHints.join(', ') } : undefined,
    // Preserve CSV-local times to avoid timezone drift in exports
    "_csv_start_time": startTime || null,
    "_csv_end_time": endTime || null
  };
  
  // Remove undefined values
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });
  
  return {
    url: url,
    kind: 'event',
    title: title,
    description: null,
    date_start: dateStart,
    date_end: dateEnd,
    location: location || locationHints.join(', ') || null,
    price: null,
    price_currency: null,
    availability: 'https://schema.org/EventScheduled',
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::event::${title}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString()
  };
}

/* ========== Service data transformation ========== */
function transformServiceData(row) {
  const title = row.title;
  const url = row['full url'] || row['url id'] || row.url;
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()).filter(Boolean) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const imageUrl = row.image;
  
  // Determine service type from categories
  let serviceType = 'service';
  if (categories.includes('photography-classes')) serviceType = 'course';
  else if (categories.includes('photography-courses')) serviceType = 'course';
  else if (categories.includes('1-2-1-private-lessons')) serviceType = 'private-lesson';
  else if (categories.includes('photography-tuition')) serviceType = 'tuition';
  else if (categories.includes('print')) serviceType = 'product';
  
  // Extract location from tags
  const locations = [];
  if (tags.includes('coventry')) locations.push('Coventry');
  if (tags.includes('kenilworth')) locations.push('Kenilworth');
  if (tags.includes('solihull')) locations.push('Solihull');
  if (tags.includes('or-online')) locations.push('Online');
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": title,
    "url": url,
    "provider": { "@type": "Organization", "name": "Alan Ranger Photography" },
    "image": imageUrl,
    "keywords": tags.join(', '),
    "serviceType": serviceType,
    "areaServed": locations.length > 0 ? locations : undefined,
    "offers": { "@type": "Offer", "availability": "https://schema.org/InStock" }
  };
  
  // Remove undefined values
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });
  
  return {
    url: url,
    kind: 'service',
    title: title,
    description: null,
    date_start: null,
    date_end: null,
    location: locations.join(', ') || null,
    price: null,
    price_currency: null,
    availability: 'InStock',
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::service::${title}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString()
  };
}

/* ========== Product data transformation ========== */
function transformProductData(row) {
  // Path A: CSV supplies a JSON-LD blob column (e.g. "JSON-LD Structured Data")
  const jsonLdRaw = row['json-ld structured data'] || row['jsonld'] || row['structured_data'] || row['structured data'];
  if (jsonLdRaw) {
    // Strip <script> tags and attempt to parse
    const stripped = String(jsonLdRaw)
      .replace(/<script[^>]*>/gi, '')
      .replace(/<\/script>/gi, '')
      .trim();
    let parsed;
    try {
      // Some cells may include leading/trailing quotes or whitespace
      const candidate = stripped.replace(/^\s*"|"\s*$/g, '').trim();
      // Attempt direct parse, otherwise try to find first JSON object/array
      try {
        parsed = JSON.parse(candidate);
      } catch {
        const start = candidate.indexOf('{');
        const startArr = candidate.indexOf('[');
        const s = (startArr !== -1 && (startArr < start || start === -1)) ? startArr : start;
        const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']')) + 1;
        parsed = JSON.parse(candidate.slice(s, end));
      }
    } catch (e) {
      // If JSON-LD cannot be parsed, skip this row
      return null;
    }
    // If array, use first Product-like object
    const obj = Array.isArray(parsed) ? (parsed.find(o => (o && (o['@type']==='Product' || (o['@type']||'').includes('Product')))) || parsed[0]) : parsed;
    if (!obj) return null;
    const offers = obj.offers || {};
    const title = obj.name || row.title || '';
    const url = obj.url || row.url || row['page url'] || row.page_url || '';
    const sku = obj.sku || row.sku || null;
    const price = Number(offers.price || row.price || row['low price'] || row.low_price || 0) || 0;
    const availability = (offers.availability && /InStock/i.test(offers.availability)) ? 'InStock' : 'OutOfStock';
    const images = Array.isArray(obj.image) ? obj.image : (obj.image ? [obj.image] : []);
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": title,
      "url": url,
      "sku": sku,
      "image": images,
      "offers": { "@type": "Offer", "price": price, "priceCurrency": "GBP", "availability": `https://schema.org/${availability}` }
    };
    return {
      url: url,
      kind: 'product',
      title: title,
      description: obj.description || null,
      date_start: null,
      date_end: null,
      location: null,
      price: price,
      price_currency: 'GBP',
      availability: availability,
      sku: sku,
      provider: 'Alan Ranger Photography',
      source_url: url,
      raw: obj,
      entity_hash: crypto.createHash('sha1').update(`${url}::product::${title}::${sku}::${price}::${JSON.stringify(obj)}`).digest('hex'),
      last_seen: new Date().toISOString()
    };
  }

  // Path B: Column-mapped products
  const title = row.title || row['product title'] || row.name;
  const url = row['product url'] || row.product_url || row.url || row['page url'] || row.page_url;
  const description = row.description;
  const sku = row.sku;
  const price = parseFloat(row.price || row['low price'] || row.low_price) || 0;
  const salePrice = parseFloat(row['sale price'] || row.sale_price) || 0;
  const onSale = (row['on sale'] || row.on_sale) === 'Yes' || (row['on sale'] || row.on_sale) === 'TRUE';
  const stock = row.stock;
  const categories = row.categories ? row.categories.split(',').map(c => c.trim()) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
  const imageUrls = row['hosted image urls'] ? row['hosted image urls'].split(' ').filter(u => u.trim()) : (row.hosted_image_urls ? row.hosted_image_urls.split(' ').filter(u => u.trim()) : (row.image ? [row.image] : []));
  
  let availability = 'OutOfStock';
  if (stock === 'Unlimited' || (parseInt(stock) || 0) > 0) {
    availability = 'InStock';
  }
  const finalPrice = onSale && salePrice > 0 ? salePrice : price;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": title,
    "url": url,
    "description": description,
    "sku": sku,
    "image": imageUrls,
    "brand": { "@type": "Brand", "name": "Alan Ranger Photography" },
    "offers": {
      "@type": "Offer",
      "price": finalPrice,
      "priceCurrency": "GBP",
      "availability": `https://schema.org/${availability}`,
      "seller": { "@type": "Organization", "name": "Alan Ranger Photography" }
    },
    "category": categories.join(', '),
    "keywords": tags.join(', ')
  };
  return {
    url: url,
    kind: 'product',
    title: title,
    description: description,
    date_start: null,
    date_end: null,
    location: null,
    price: finalPrice,
    price_currency: 'GBP',
    availability: availability,
    sku: sku,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::product::${title}::${sku}::${finalPrice}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString()
  };
}

/* ========== Event data transformation ========== */
function transformEventData(row) {
  const eventUrl = row.event_url || row['event url'] || row.url;
  const eventTitle = row.event_title || row['event title'] || row.title;
  const startDate = normalizeDateDayFirst(row.start_date || row['start date']);
  const startTime = row.start_time || row['start time'];
  const endDate = normalizeDateDayFirst(row.end_date || row['end date']);
  const endTime = row.end_time || row['end time'];
  const location = row.location_business_name || row['location business name'] || row.location_address || row['location address'] || row.location;
  const category = row.category || '';
  
  // Determine event type
  let subtype = 'event';
  if (eventUrl && eventUrl.includes('beginners-photography-lessons')) {
    subtype = 'course';
  } else if (eventUrl && eventUrl.includes('photographic-workshops-near-me')) {
    subtype = 'workshop';
  }
  
  // Normalize HH:MM vs HH:MM:SS and create combined datetime
  const normalizeTime = (t) => {
    if (!t) return null;
    const tt = String(t).trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(tt)) return tt;
    if (/^\d{2}:\d{2}$/.test(tt)) return `${tt}:00`;
    return tt; // leave as-is, DB will validate
  };
  const sTime = normalizeTime(startTime);
  const eTime = normalizeTime(endTime);
  const dateStart = startDate && sTime ? `${startDate}T${sTime}` : null;
  const dateEnd = endDate && eTime ? `${endDate}T${eTime}` : null;
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": eventTitle,
    "url": eventUrl,
    "startDate": dateStart,
    "endDate": dateEnd,
    "location": location ? { "@type": "Place", "name": location } : undefined,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    // Preserve CSV-local times to avoid timezone drift in exports
    "_csv_start_time": sTime || null,
    "_csv_end_time": eTime || null
  };
  
  // Remove undefined values
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });
  
  return {
    url: eventUrl,
    kind: 'event',
    title: eventTitle,
    description: null,
    date_start: dateStart,
    date_end: dateEnd,
    location: location,
    price: null,
    price_currency: null,
    availability: null,
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: eventUrl,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${eventUrl}::event::${eventTitle}::${dateStart}::${dateEnd}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString()
  };
}

/* ========== CSV-Enhanced Workshop data transformation ========== */
async function transformWorkshopDataWithCSV(row, supa) {
  const title = row.title || row['event title'] || row['event_title'];
  const url = row['full url'] || row['url id'] || row['event url'] || row['event_url'] || row.url;
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()).filter(Boolean) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const imageUrl = row.image || row['event image'] || row['event_image'];
  
  // Map date/time/location fields from CSV
  const startDateRaw = row.Start_Date || row.start_date;
  const endDateRaw = row.End_Date || row.end_date;
  const startDate = normalizeDateDayFirst(startDateRaw);
  const endDate = normalizeDateDayFirst(endDateRaw);
  const normalizeTime = (t) => {
    if (!t) return null;
    const tt = String(t).trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(tt)) return tt;
    if (/^\d{2}:\d{2}$/.test(tt)) return `${tt}:00`;
    return tt;
  };
  const startTime = normalizeTime(row.Start_Time || row.start_time);
  const endTime = normalizeTime(row.End_Time || row.end_time);
  const location = row.Location_Business_Name || row.location_business_name || row.location;
  
  const dateStart = startDate && startTime ? `${startDate}T${startTime}` : (startDate || null);
  const dateEnd = endDate && endTime ? `${endDate}T${endTime}` : (endDate || null);
  
  const locationHints = [];
  if (tags.includes('warwickshire')) locationHints.push('Warwickshire');
  if (tags.includes('suffolk')) locationHints.push('Suffolk');
  if (tags.includes('derbyshire')) locationHints.push('Derbyshire');
  if (tags.includes('devon')) locationHints.push('Devon');
  if (tags.includes('northumbria')) locationHints.push('Northumberland');
  if (tags.includes('coventry')) locationHints.push('Coventry');
  if (tags.includes('cumbria')) locationHints.push('Cumbria');
  
  let workshopType = 'workshop';
  if (categories.includes('half-day photo workshops')) workshopType = 'half-day';
  else if (categories.includes('one day photo workshops')) workshopType = 'one-day';
  else if (categories.includes('weekend residential photo workshops')) workshopType = 'weekend';
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": title,
    "url": url,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "organizer": { "@type": "Organization", "name": "Alan Ranger Photography" },
    "image": imageUrl,
    "keywords": tags.join(', '),
    "eventType": workshopType,
    "location": locationHints.length > 0 ? { "@type": "Place", "name": locationHints.join(', ') } : undefined,
    "_csv_start_time": startTime || null,
    "_csv_end_time": endTime || null
  };
  
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });
  
  return {
    url: url,
    page_url: url,
    kind: 'event',
    title: title,
    description: null,
    date_start: dateStart,
    date_end: dateEnd,
    location: location || locationHints.join(', ') || null,
    price: null,
    price_currency: null,
    availability: 'https://schema.org/EventScheduled',
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::event::${title}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString(),
    // CSV metadata fields
    csv_type: 'workshop_events',
    categories: categories,
    tags: tags,
    publish_date: null,
    location_name: location,
    location_address: row.Location_Address || row['Location Address'],
    excerpt: row.Excerpt || row.excerpt
  };
}

/* ========== CSV-Enhanced Service data transformation ========== */
async function transformServiceDataWithCSV(row, supa) {
  const title = row.title;
  const url = row['full url'] || row['url id'] || row.url;
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()).filter(Boolean) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const imageUrl = row.image;
  
  let serviceType = 'service';
  if (categories.includes('photography-classes')) serviceType = 'course';
  else if (categories.includes('photography-courses')) serviceType = 'course';
  else if (categories.includes('1-2-1-private-lessons')) serviceType = 'private-lesson';
  else if (categories.includes('photography-tuition')) serviceType = 'tuition';
  else if (categories.includes('print')) serviceType = 'product';
  
  const locations = [];
  if (tags.includes('coventry')) locations.push('Coventry');
  if (tags.includes('kenilworth')) locations.push('Kenilworth');
  if (tags.includes('solihull')) locations.push('Solihull');
  if (tags.includes('or-online')) locations.push('Online');
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": title,
    "url": url,
    "provider": { "@type": "Organization", "name": "Alan Ranger Photography" },
    "image": imageUrl,
    "keywords": tags.join(', '),
    "serviceType": serviceType,
    "areaServed": locations.length > 0 ? locations : undefined,
    "offers": { "@type": "Offer", "availability": "https://schema.org/InStock" }
  };
  
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });
  
  return {
    url: url,
    page_url: url,
    kind: 'service',
    title: title,
    description: null,
    date_start: null,
    date_end: null,
    location: locations.join(', ') || null,
    price: null,
    price_currency: null,
    availability: 'InStock',
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::service::${title}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString(),
    // CSV metadata fields
    csv_type: 'course_products',
    categories: categories,
    tags: tags,
    publish_date: null,
    image_url: imageUrl,
    excerpt: null
  };
}

/* ========== CSV-Enhanced Product data transformation ========== */
async function transformProductDataWithCSV(row, supa) {
  // Path A: CSV supplies a JSON-LD blob column
  const jsonLdRaw = row['json-ld structured data'] || row['jsonld'] || row['structured_data'] || row['structured data'];
  if (jsonLdRaw) {
    const stripped = String(jsonLdRaw)
      .replace(/<script[^>]*>/gi, '')
      .replace(/<\/script>/gi, '')
      .trim();
    let parsed;
    try {
      const candidate = stripped.replace(/^\s*"|"\s*$/g, '').trim();
      try {
        parsed = JSON.parse(candidate);
      } catch {
        const start = candidate.indexOf('{');
        const startArr = candidate.indexOf('[');
        const s = (startArr !== -1 && (startArr < start || start === -1)) ? startArr : start;
        const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']')) + 1;
        parsed = JSON.parse(candidate.slice(s, end));
      }
    } catch (e) {
      return null;
    }
    const obj = Array.isArray(parsed) ? (parsed.find(o => (o && (o['@type']==='Product' || (o['@type']||'').includes('Product')))) || parsed[0]) : parsed;
    if (!obj) return null;
    const offers = obj.offers || {};
    const title = obj.name || row.title || '';
    const url = obj.url || row.url || row['page url'] || row.page_url || '';
    const sku = obj.sku || row.sku || null;
    const price = Number(offers.price || row.price || row['low price'] || row.low_price || 0) || 0;
    const availability = (offers.availability && /InStock/i.test(offers.availability)) ? 'InStock' : 'OutOfStock';
    const images = Array.isArray(obj.image) ? obj.image : (obj.image ? [obj.image] : []);
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": title,
      "url": url,
      "sku": sku,
      "image": images,
      "offers": { "@type": "Offer", "price": price, "priceCurrency": "GBP", "availability": `https://schema.org/${availability}` }
    };
    return {
      url: url,
      page_url: url,
      kind: 'product',
      title: title,
      description: obj.description || null,
      date_start: null,
      date_end: null,
      location: null,
      price: price,
      price_currency: 'GBP',
      availability: availability,
      sku: sku,
      provider: 'Alan Ranger Photography',
      source_url: url,
      raw: obj,
      entity_hash: crypto.createHash('sha1').update(`${url}::product::${title}::${sku}::${price}::${JSON.stringify(obj)}`).digest('hex'),
      last_seen: new Date().toISOString(),
      // CSV metadata fields
      csv_type: 'workshop_products',
      categories: [],
      tags: [],
      publish_date: null,
      image_url: images[0] || null,
      excerpt: obj.description || null
    };
  }

  // Path B: Column-mapped products
  const title = row.title || row['product title'] || row.name;
  const url = row['product url'] || row.product_url || row.url || row['page url'] || row.page_url;
  const description = row.description;
  const sku = row.sku;
  const price = parseFloat(row.price || row['low price'] || row.low_price) || 0;
  const salePrice = parseFloat(row['sale price'] || row.sale_price) || 0;
  const onSale = (row['on sale'] || row.on_sale) === 'Yes' || (row['on sale'] || row.on_sale) === 'TRUE';
  const stock = row.stock;
  const categories = row.categories ? row.categories.split(',').map(c => c.trim()) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
  const imageUrls = row['hosted image urls'] ? row['hosted image urls'].split(' ').filter(u => u.trim()) : (row.hosted_image_urls ? row.hosted_image_urls.split(' ').filter(u => u.trim()) : (row.image ? [row.image] : []));
  
  let availability = 'OutOfStock';
  if (stock === 'Unlimited' || (parseInt(stock) || 0) > 0) {
    availability = 'InStock';
  }
  const finalPrice = onSale && salePrice > 0 ? salePrice : price;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": title,
    "url": url,
    "description": description,
    "sku": sku,
    "image": imageUrls,
    "brand": { "@type": "Brand", "name": "Alan Ranger Photography" },
    "offers": {
      "@type": "Offer",
      "price": finalPrice,
      "priceCurrency": "GBP",
      "availability": `https://schema.org/${availability}`,
      "seller": { "@type": "Organization", "name": "Alan Ranger Photography" }
    },
    "category": categories.join(', '),
    "keywords": tags.join(', ')
  };
  return {
    url: url,
    page_url: url,
    kind: 'product',
    title: title,
    description: description,
    date_start: null,
    date_end: null,
    location: null,
    price: finalPrice,
    price_currency: 'GBP',
    availability: availability,
    sku: sku,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::product::${title}::${sku}::${finalPrice}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString(),
    // CSV metadata fields
    csv_type: 'workshop_products',
    categories: categories,
    tags: tags,
    publish_date: null,
    image_url: imageUrls[0] || null,
    excerpt: description
  };
}

/* ========== CSV-Enhanced Event data transformation ========== */
async function transformEventDataWithCSV(row, supa) {
  const eventUrl = row.event_url || row['event url'] || row.url;
  const eventTitle = row.event_title || row['event title'] || row.title;
  const startDate = normalizeDateDayFirst(row.start_date || row['start date']);
  const startTime = row.start_time || row['start time'];
  const endDate = normalizeDateDayFirst(row.end_date || row['end date']);
  const endTime = row.end_time || row['end time'];
  const location = row.location_business_name || row['location business name'] || row.location_address || row['location address'] || row.location;
  const category = row.category || '';
  
  let subtype = 'event';
  if (eventUrl && eventUrl.includes('beginners-photography-lessons')) {
    subtype = 'course';
  } else if (eventUrl && eventUrl.includes('photographic-workshops-near-me')) {
    subtype = 'workshop';
  }
  
  const normalizeTime = (t) => {
    if (!t) return null;
    const tt = String(t).trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(tt)) return tt;
    if (/^\d{2}:\d{2}$/.test(tt)) return `${tt}:00`;
    return tt;
  };
  const sTime = normalizeTime(startTime);
  const eTime = normalizeTime(endTime);
  const dateStart = startDate && sTime ? `${startDate}T${sTime}` : null;
  const dateEnd = endDate && eTime ? `${endDate}T${eTime}` : null;
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": eventTitle,
    "url": eventUrl,
    "startDate": dateStart,
    "endDate": dateEnd,
    "location": location ? { "@type": "Place", "name": location } : undefined,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "_csv_start_time": sTime || null,
    "_csv_end_time": eTime || null
  };
  
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });
  
  return {
    url: eventUrl,
    page_url: eventUrl,
    kind: 'event',
    title: eventTitle,
    description: null,
    date_start: dateStart,
    date_end: dateEnd,
    location: location,
    price: null,
    price_currency: null,
    availability: null,
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: eventUrl,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${eventUrl}::event::${eventTitle}::${dateStart}::${dateEnd}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString(),
    // CSV metadata fields
    csv_type: 'course_events',
    categories: [category].filter(Boolean),
    tags: [],
    publish_date: null,
    location_name: location,
    location_address: row.location_address || row['location address'],
    excerpt: null
  };
}

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    const ingest = `Bearer ${need('INGEST_TOKEN')}`;
    const legacyAdmin = 'Bearer b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';
    if (token !== ingest && token !== legacyAdmin) return sendJSON(res, 401, { error: 'unauthorized', stage });

    stage = 'parse_body';
    const { csvData, contentType } = req.body || {};
    if (!csvData) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "csvData"', stage });
    if (!contentType) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "contentType" (blog, workshop, service, product, event)', stage });

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    stage = 'parse_csv';
    const rows = parseCSV(csvData);
    if (!rows.length) return sendJSON(res, 400, { error: 'bad_request', detail: 'No valid CSV data found', stage });

    stage = 'transform_data';
    
    // Check if this is a metadata import (new mode)
    if (contentType === 'metadata') {
      const { csvType } = req.body || {};
      if (!csvType) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "csvType" for metadata import', stage });
      
      let metadataCount = 0;
      let fieldStats = null;
      let successRate = 0;
      switch (csvType) {
        case 'blog':
          const blogResult = await importBlogMetadata(rows, supa);
          metadataCount = blogResult.count;
          fieldStats = blogResult.field_stats;
          successRate = blogResult.success_rate;
          break;
        case 'course_events':
          const courseResult = await importCourseEventMetadata(rows, supa);
          metadataCount = courseResult.count;
          fieldStats = courseResult.field_stats;
          successRate = courseResult.success_rate;
          break;
        case 'workshop_events':
          // Check if this is actually workshop products (File 05 has same structure as course_products)
          if (rows[0] && (rows[0]['Full Url'] || rows[0]['full url']) && !rows[0]['Event_URL'] && !rows[0]['event_url']) {
            // This is workshop products, not events
            console.log('DEBUG: Detected workshop_events CSV as workshop_products due to Full Url column');
            const workshopProductResult = await importWorkshopProductMetadata(rows, supa);
            metadataCount = workshopProductResult.count;
            fieldStats = workshopProductResult.field_stats;
            successRate = workshopProductResult.success_rate;
          } else {
            const workshopResult = await importWorkshopEventMetadata(rows, supa);
            metadataCount = workshopResult.count;
            fieldStats = workshopResult.field_stats;
            successRate = workshopResult.success_rate;
          }
          break;
        case 'course_products':
          const courseProductResult = await importCourseProductMetadata(rows, supa);
          metadataCount = courseProductResult.count;
          fieldStats = courseProductResult.field_stats;
          successRate = courseProductResult.success_rate;
          break;
        case 'workshop_products':
          const workshopProductResult = await importWorkshopProductMetadata(rows, supa);
          metadataCount = workshopProductResult.count;
          fieldStats = workshopProductResult.field_stats;
          successRate = workshopProductResult.success_rate;
          break;
        case 'site_urls':
          const siteUrlResult = await importSiteUrlMetadata(rows, supa);
          metadataCount = siteUrlResult.count;
          break;
        case 'product_schema':
          const productSchemaResult = await importProductSchemaMetadata(rows, supa);
          metadataCount = productSchemaResult.count;
          break;
        default:
          return sendJSON(res, 400, { error: 'bad_request', detail: 'Invalid csvType for metadata import', stage });
      }
      
      return sendJSON(res, 200, { 
        success: true, 
        stage: 'metadata_import_complete',
        metadata_imported: metadataCount,
        csv_type: csvType,
        field_stats: fieldStats,
        success_rate: successRate
      });
    }
    
    // Enhanced entity import logic - populate page_entities with CSV metadata
    const entities = [];
    
    for (const row of rows) {
      let entity = null;
      
      switch (contentType) {
        case 'blog':
          if (!row['full url'] && !row['url id'] && !row.url) continue;
          entity = await transformBlogDataWithCSV(row, supa);
          break;
        case 'workshop':
          if (!row['full url'] && !row['url id'] && !row['event url'] && !row['event_url'] && !row.url) continue;
          entity = await transformWorkshopDataWithCSV(row, supa);
          break;
        case 'service':
          if (!row['full url'] && !row['url id'] && !row.url) continue;
          entity = await transformServiceDataWithCSV(row, supa);
          break;
        case 'product':
          // Accept either explicit product columns OR a JSON-LD column
          if (!row['product url'] && !row.product_url && !row.url && !row['json-ld structured data'] && !row['jsonld'] && !row['structured_data'] && !row['structured data']) continue;
          entity = await transformProductDataWithCSV(row, supa);
          break;
        case 'event':
          if (!row.event_url && !row['event url'] && !row.url) continue;
          entity = await transformEventDataWithCSV(row, supa);
          break;
        default:
          return sendJSON(res, 400, { error: 'bad_request', detail: 'Invalid contentType. Use: blog, workshop, service, product, event, metadata', stage });
      }
      
      if (entity) entities.push(entity);
    }

    // For events, deduplicate by (url, date_start) to avoid unique constraint violations
    if (contentType === 'event' && entities.length) {
      const seen = new Set();
      const deduped = [];
      for (const e of entities) {
        const key = `${e.url}::${e.date_start || ''}`;
        if (!seen.has(key)) { seen.add(key); deduped.push(e); }
      }
      if (deduped.length !== entities.length) {
        // replace with deduped list
        entities.length = 0;
        entities.push(...deduped);
      }
    }

    if (!entities.length) return sendJSON(res, 400, { error: 'bad_request', detail: `No valid ${contentType} entities found in CSV`, stage });

    stage = 'import_entities';

    const urls = entities.map(e => e.url);

    // For events: perform strict per-row replace to avoid UNIQUE conflicts
    if (contentType === 'event') {
      let imported = 0;
      for (const e of entities) {
        // delete any existing rows for this URL (and event_dates)
        await supa.from('event_dates').delete().eq('event_url', e.url);
        await supa.from('page_entities').delete().eq('url', e.url).eq('kind', 'event');
        if (e.date_start) {
          await supa.from('page_entities').delete().eq('url', e.url).eq('date_start', e.date_start).eq('kind', 'event');
        }
        const { error: insOne } = await supa
          .from('page_entities')
          .insert([e], { upsert: true, onConflict: 'url,date_start,kind' });
        if (insOne) {
          return sendJSON(res, 500, { error: 'supabase_entities_upsert_failed', detail: insOne.message || insOne, stage: 'event_insert', url: e.url });
        }
        imported++;
      }
      stage = 'done';
      return sendJSON(res, 200, { ok: true, imported, content_type: contentType, stage: 'inserted' });
    }

    // Non-event: batch replace (delete by URLs, then insert)
    if (urls.length) {
      const { error: delE } = await supa.from('page_entities').delete().in('url', urls);
      if (delE) return sendJSON(res, 500, { error: 'supabase_entities_delete_failed', detail: delE.message || delE, stage });
    }
    const { error: insE2 } = await supa.from('page_entities').insert(entities);
    if (insE2) return sendJSON(res, 500, { error: 'supabase_entities_insert_failed', detail: insE2.message || insE2, stage });

    stage = 'done';
    return sendJSON(res, 200, { ok: true, imported: entities.length, content_type: contentType, stage });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
