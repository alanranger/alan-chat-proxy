// /api/csv-bulk-import.js
// Bulk CSV import endpoint - handles all CSV types in one request
// Simplified interface for easy data pipeline management

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
  
  // Parse CSV properly handling quoted fields
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
  
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim().toLowerCase());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/"/g, '').trim());
    if (values.length !== headers.length) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    rows.push(row);
  }
  
  return rows;
}

/* ========== Data transformation functions ========== */
function transformBlogData(row) {
  const title = row.title;
  const url = row['full url'] || row['url id'];
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
  const imageUrl = row.image;
  const publishDate = row['publish on'];
  
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

function transformEventData(row) {
  const eventUrl = row['event_url'] || row['event url'];
  const eventTitle = row['event_title'] || row['event title'];
  const startDate = row['start_date'] || row['start date'];
  const startTime = row['start_time'] || row['start time'];
  const endDate = row['end_date'] || row['end date'];
  const endTime = row['end_time'] || row['end time'];
  const location = row['location_business_name'] || row['location business name'] || row['location_address'] || row['location address'];
  
  let subtype = 'event';
  if (eventUrl && eventUrl.includes('beginners-photography-lessons')) {
    subtype = 'course';
  } else if (eventUrl && eventUrl.includes('photographic-workshops-near-me')) {
    subtype = 'workshop';
  }
  
  const dateStart = startDate && startTime ? `${startDate}T${startTime}:00+00:00` : null;
  const dateEnd = endDate && endTime ? `${endDate}T${endTime}:00+00:00` : null;
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": eventTitle,
    "url": eventUrl,
    "startDate": dateStart,
    "endDate": dateEnd,
    "location": location ? { "@type": "Place", "name": location } : undefined,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode"
  };
  
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

function transformWorkshopData(row) {
  const title = row['event_title'] || row['event title'];
  const url = row['event_url'] || row['event url'];
  const categories = row.category ? row.category.split(',').map(c => c.trim()) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
  const imageUrl = row['event_image'] || row['event image'];
  
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
    "location": locationHints.length > 0 ? { "@type": "Place", "name": locationHints.join(', ') } : undefined
  };
  
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });
  
  return {
    url: url,
    kind: 'event',
    title: title,
    description: null,
    date_start: null,
    date_end: null,
    location: locationHints.join(', ') || null,
    price: null,
    price_currency: null,
    availability: null,
    sku: null,
    provider: 'Alan Ranger Photography',
    source_url: url,
    raw: jsonLd,
    entity_hash: crypto.createHash('sha1').update(`${url}::event::${title}::${JSON.stringify(jsonLd)}`).digest('hex'),
    last_seen: new Date().toISOString()
  };
}

function transformServiceData(row) {
  const title = row.title;
  const url = row['full url'] || row['url id'];
  const categories = row.categories ? row.categories.split(';').map(c => c.trim()) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
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

function transformProductData(row) {
  const title = row.title;
  const url = row['product url'] || row['product_url'];
  const description = row.description;
  const sku = row.sku;
  const price = parseFloat(row.price) || 0;
  const salePrice = parseFloat(row['sale price']) || parseFloat(row['sale_price']) || 0;
  const onSale = row['on sale'] === 'Yes' || row['on_sale'] === 'Yes';
  const stock = row.stock;
  const categories = row.categories ? row.categories.split(',').map(c => c.trim()) : [];
  const tags = row.tags ? row.tags.split(',').map(t => t.trim()) : [];
  const imageUrls = row['hosted image urls'] ? row['hosted image urls'].split(' ').filter(url => url.trim()) : (row['hosted_image_urls'] ? row['hosted_image_urls'].split(' ').filter(url => url.trim()) : []);
  
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

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) return sendJSON(res, 401, { error: 'unauthorized', stage });

    stage = 'parse_body';
    const { csvFiles } = req.body || {};
    if (!csvFiles || !Array.isArray(csvFiles)) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "csvFiles" array', stage });

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    stage = 'process_files';
    const results = [];
    
    for (const fileData of csvFiles) {
      const { csvData, contentType, fileName } = fileData;
      if (!csvData || !contentType) continue;
      
      try {
        const rows = parseCSV(csvData);
        if (!rows.length) {
          results.push({ fileName, contentType, success: false, error: 'No valid CSV data found' });
          continue;
        }

        // Debug: Log the actual headers found
        console.log(`DEBUG: ${contentType} headers:`, rows[0]);
        console.log(`DEBUG: ${contentType} first data row:`, rows[1]);
        
        // Add debug info to results
        results.push({ fileName, contentType, success: false, error: `DEBUG: Headers found: ${JSON.stringify(rows[0])}` });
        if (rows[1]) {
          results.push({ fileName, contentType, success: false, error: `DEBUG: First data row: ${JSON.stringify(rows[1])}` });
        }

        const entities = [];
        
        // Add debug info for field checking
        if (contentType === 'blog') {
          results.push({ fileName, contentType, success: false, error: `DEBUG: Looking for 'full url': ${rows[1]?.['full url']}, 'url id': ${rows[1]?.['url id']}` });
        } else if (contentType === 'event') {
          results.push({ fileName, contentType, success: false, error: `DEBUG: Looking for 'event_url': ${rows[1]?.['event_url']}, 'event url': ${rows[1]?.['event url']}` });
        } else if (contentType === 'product') {
          results.push({ fileName, contentType, success: false, error: `DEBUG: Looking for 'product url': ${rows[1]?.['product url']}, 'product_url': ${rows[1]?.['product_url']}` });
        }
        
        for (const row of rows) {
          let entity = null;
          
          switch (contentType) {
            case 'blog':
              if (!row['full url'] && !row['url id']) continue;
              entity = transformBlogData(row);
              break;
            case 'event':
              if (!row['event_url'] && !row['event url']) continue;
              entity = transformEventData(row);
              break;
            case 'workshop':
              if (!row['event_url'] && !row['event url']) continue;
              entity = transformWorkshopData(row);
              break;
            case 'service':
              if (!row['full url'] && !row['url id']) continue;
              entity = transformServiceData(row);
              break;
            case 'product':
              if (!row['product url'] && !row['product_url']) continue;
              entity = transformProductData(row);
              break;
            default:
              results.push({ fileName, contentType, success: false, error: `Invalid contentType: ${contentType}` });
              continue;
          }
          
          if (entity) entities.push(entity);
        }

        if (!entities.length) {
          results.push({ fileName, contentType, success: false, error: `No valid ${contentType} entities found` });
          continue;
        }

        // Delete existing entities for these URLs to avoid duplicates
        const urls = entities.map(e => e.url);
        if (urls.length) {
          await supa.from('page_entities').delete().in('url', urls);
        }

        // Insert new entities
        const { error: insE } = await supa.from('page_entities').insert(entities);
        if (insE) {
          results.push({ fileName, contentType, success: false, error: insE.message || insE });
          continue;
        }

        results.push({ fileName, contentType, success: true, imported: entities.length });

      } catch (error) {
        results.push({ fileName, contentType, success: false, error: asString(error) });
      }
    }

    stage = 'done';
    return sendJSON(res, 200, {
      ok: true,
      results: results,
      totalFiles: csvFiles.length,
      successfulFiles: results.filter(r => r.success).length,
      stage
    });
  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
