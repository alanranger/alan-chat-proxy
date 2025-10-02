// /api/csv-events-import.js
// Import CSV event data into the database
// This endpoint handles CSV files with event data and imports them into the database

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

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
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    rows.push(row);
  }
  
  return rows;
}

/* ========== Event data transformation ========== */
function transformEventData(row) {
  // Extract event information from CSV row
  const eventUrl = row.event_url || row.url;
  const eventTitle = row.event_title || row.title;
  const startDate = row.start_date;
  const startTime = row.start_time;
  const endDate = row.end_date;
  const endTime = row.end_time;
  const location = row.location_business_name || row.location_address || row.location;
  const category = row.category || '';
  
  // Determine event type
  let subtype = 'event';
  if (eventUrl && eventUrl.includes('beginners-photography-lessons')) {
    subtype = 'course';
  } else if (eventUrl && eventUrl.includes('photographic-workshops-near-me')) {
    subtype = 'workshop';
  }
  
  // Create combined datetime
  const dateStart = startDate && startTime ? `${startDate}T${startTime}:00+00:00` : null;
  const dateEnd = endDate && endTime ? `${endDate}T${endTime}:00+00:00` : null;
  
  // Create JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": eventTitle,
    "url": eventUrl,
    "startDate": dateStart,
    "endDate": dateEnd,
    "location": location ? {
      "@type": "Place",
      "name": location
    } : undefined,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode"
  };
  
  // Remove undefined values
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) {
      delete jsonLd[key];
    }
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

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) return sendJSON(res, 401, { error: 'unauthorized', stage });

    stage = 'parse_body';
    const { csvData, csvType } = req.body || {};
    if (!csvData) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "csvData"', stage });
    if (!csvType) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "csvType" (events or products)', stage });

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    stage = 'parse_csv';
    const rows = parseCSV(csvData);
    if (!rows.length) return sendJSON(res, 400, { error: 'bad_request', detail: 'No valid CSV data found', stage });

    stage = 'transform_data';
    const entities = [];
    
    if (csvType === 'events') {
      // Transform event data
      for (const row of rows) {
        if (!row.event_url && !row.url) continue;
        const entity = transformEventData(row);
        entities.push(entity);
      }
    } else if (csvType === 'products') {
      // Transform product data (if needed)
      for (const row of rows) {
        if (!row.product_url && !row.url) continue;
        // Add product transformation logic here if needed
      }
    }

    if (!entities.length) return sendJSON(res, 400, { error: 'bad_request', detail: 'No valid entities found in CSV', stage });

    stage = 'import_entities';
    // Delete existing entities for these URLs to avoid duplicates
    const urls = entities.map(e => e.url);
    if (urls.length) {
      const { error: delE } = await supa.from('page_entities').delete().in('url', urls);
      if (delE) return sendJSON(res, 500, { error: 'supabase_entities_delete_failed', detail: delE.message || delE, stage });
    }

    // Insert new entities
    const { error: insE } = await supa.from('page_entities').insert(entities);
    if (insE) return sendJSON(res, 500, { error: 'supabase_entities_insert_failed', detail: insE.message || insE, stage });

    stage = 'done';
    return sendJSON(res, 200, {
      ok: true,
      imported: entities.length,
      stage
    });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}


