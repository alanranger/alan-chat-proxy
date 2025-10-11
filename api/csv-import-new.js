// /api/csv-import-new.js
// CSV-driven import system that populates proper tables
// Uses CSV data as source of truth, not HTML parsing

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
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
      i++;
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/* ========== Data transformation functions ========== */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle DD/MM/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0];
      const month = parts[1];
      const year = parts[2];
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // Handle YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  return null;
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  
  // Handle HH:MM:SS format
  if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return timeStr;
  }
  
  return null;
}

function parseArray(str) {
  if (!str) return [];
  return str.split(';').map(s => s.trim()).filter(Boolean);
}

function parseTimestamp(timestampStr) {
  if (!timestampStr) return null;
  
  // Handle DD/MM/YYYY HH:MM format
  if (timestampStr.includes('/') && timestampStr.includes(' ')) {
    const [datePart, timePart] = timestampStr.split(' ');
    const date = parseDate(datePart);
    if (date && timePart) {
      return `${date} ${timePart}:00`;
    }
  }
  
  return null;
}

/* ========== Import functions for each CSV type ========== */
async function importBlogArticles(supa, rows) {
  const records = rows.map(row => ({
    title: row.Title || '',
    url_id: row['Url Id'] || '',
    full_url: row['Full Url'] || '',
    categories: parseArray(row.Categories),
    tags: parseArray(row.Tags),
    image_url: row.Image || '',
    publish_date: parseDate(row['Publish On'])
  })).filter(record => record.full_url);

  if (records.length === 0) return { count: 0 };

  const { data, error } = await supa
    .from('blog_articles')
    .upsert(records, { onConflict: 'full_url' });

  if (error) throw error;
  return { count: records.length };
}

async function importCourseEvents(supa, rows) {
  const records = rows.map(row => ({
    event_title: row.Event_Title || '',
    start_date: parseDate(row.Start_Date),
    start_time: parseTime(row.Start_Time),
    end_date: parseDate(row.End_Date),
    end_time: parseTime(row.End_Time),
    category: parseArray(row.Category),
    tags: parseArray(row.Tags),
    excerpt: row.Excerpt || '',
    location_business_name: row.Location_Business_Name || '',
    location_address: row.Location_Address || '',
    location_city_state_zip: row.Location_City_State_ZIP || '',
    event_url: row.Event_URL || '',
    event_image: row.Event_Image || '',
    text_block: row.Text_Block || '',
    published_date: parseTimestamp(row.Published_Date),
    workflow_state: row.Workflow_State || ''
  })).filter(record => record.event_url);

  if (records.length === 0) return { count: 0 };

  const { data, error } = await supa
    .from('course_events')
    .upsert(records, { onConflict: 'event_url' });

  if (error) throw error;
  return { count: records.length };
}

async function importWorkshopEvents(supa, rows) {
  const records = rows.map(row => ({
    event_title: row.Event_Title || '',
    start_date: parseDate(row.Start_Date),
    start_time: parseTime(row.Start_Time),
    end_date: parseDate(row.End_Date),
    end_time: parseTime(row.End_Time),
    category: parseArray(row.Category),
    tags: parseArray(row.Tags),
    excerpt: row.Excerpt || '',
    location_business_name: row.Location_Business_Name || '',
    location_address: row.Location_Address || '',
    location_city_state_zip: row.Location_City_State_ZIP || '',
    event_url: row.Event_URL || '',
    event_image: row.Event_Image || '',
    text_block: row.Text_Block || '',
    published_date: parseTimestamp(row.Published_Date),
    workflow_state: row.Workflow_State || ''
  })).filter(record => record.event_url);

  if (records.length === 0) return { count: 0 };

  const { data, error } = await supa
    .from('workshop_events')
    .upsert(records, { onConflict: 'event_url' });

  if (error) throw error;
  return { count: records.length };
}

async function importCourseProducts(supa, rows) {
  const records = rows.map(row => ({
    title: row.Title || '',
    url_id: row['Url Id'] || '',
    full_url: row['Full Url'] || '',
    categories: parseArray(row.Categories),
    tags: parseArray(row.Tags),
    image_url: row.Image || '',
    publish_date: parseDate(row['Publish On'])
  })).filter(record => record.full_url);

  if (records.length === 0) return { count: 0 };

  const { data, error } = await supa
    .from('course_products')
    .upsert(records, { onConflict: 'full_url' });

  if (error) throw error;
  return { count: records.length };
}

async function importWorkshopProducts(supa, rows) {
  const records = rows.map(row => ({
    title: row.Title || '',
    url_id: row['Url Id'] || '',
    full_url: row['Full Url'] || '',
    categories: parseArray(row.Categories),
    tags: parseArray(row.Tags),
    image_url: row.Image || '',
    publish_date: parseDate(row['Publish On'])
  })).filter(record => record.full_url);

  if (records.length === 0) return { count: 0 };

  const { data, error } = await supa
    .from('workshop_products')
    .upsert(records, { onConflict: 'full_url' });

  if (error) throw error;
  return { count: records.length };
}

async function importSiteUrls(supa, rows) {
  const records = rows.map(row => ({
    url: row.url || '',
    title: row.title || ''
  })).filter(record => record.url);

  if (records.length === 0) return { count: 0 };

  const { data, error } = await supa
    .from('site_urls')
    .upsert(records, { onConflict: 'url' });

  if (error) throw error;
  return { count: records.length };
}

async function importProductSchema(supa, rows) {
  const records = rows.map(row => ({
    title: row.Title || '',
    json_ld_data: row['JSON-LD Structured Data'] ? JSON.parse(row['JSON-LD Structured Data']) : null
  })).filter(record => record.title);

  if (records.length === 0) return { count: 0 };

  const { data, error } = await supa
    .from('product_schema')
    .upsert(records, { onConflict: 'title' });

  if (error) throw error;
  return { count: records.length };
}

/* ========== Main handler ========== */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJSON(res, 405, { error: 'Method not allowed' });
    }

    const { csvType, csvContent } = req.body;
    
    if (!csvType || !csvContent) {
      return sendJSON(res, 400, { error: 'Missing csvType or csvContent' });
    }

    // Parse CSV
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      return sendJSON(res, 400, { error: 'No valid rows found in CSV' });
    }

    // Initialize Supabase client
    const supa = createClient(
      need('SUPABASE_URL'),
      need('SUPABASE_SERVICE_ROLE_KEY')
    );

    let result;
    
    // Import based on CSV type
    switch (csvType) {
      case 'blog':
        result = await importBlogArticles(supa, rows);
        break;
      case 'course_events':
        result = await importCourseEvents(supa, rows);
        break;
      case 'workshop_events':
        result = await importWorkshopEvents(supa, rows);
        break;
      case 'course_products':
        result = await importCourseProducts(supa, rows);
        break;
      case 'workshop_products':
        result = await importWorkshopProducts(supa, rows);
        break;
      case 'site_urls':
        result = await importSiteUrls(supa, rows);
        break;
      case 'product_schema':
        result = await importProductSchema(supa, rows);
        break;
      default:
        return sendJSON(res, 400, { error: `Unknown CSV type: ${csvType}` });
    }

    return sendJSON(res, 200, {
      success: true,
      csvType,
      rowsProcessed: rows.length,
      recordsImported: result.count
    });

  } catch (error) {
    console.error('CSV import error:', error);
    return sendJSON(res, 500, { 
      error: 'Import failed', 
      detail: asString(error) 
    });
  }
}
