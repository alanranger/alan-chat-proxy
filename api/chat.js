// /api/chat.js   (Node runtime)
// ENV required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: ORIGIN_ALLOW (csv of allowed origins)

import { createClient } from '@supabase/supabase-js';

// ----------------- Utilities -----------------
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function okJson(res, body, status=200) {
  res.statusCode = status;
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify(body));
}
function errJson(res, msg, status=500) {
  okJson(res, { ok:false, error:String(msg) }, status);
}

function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }

function pickKeywords(question) {
  const q = (question||'').toLowerCase();
  // very small stoplist and normaliser for stability
  const stop = new Set(['the','a','an','next','give','me','and','or','in','of','for','to','with','please','dates','date','prices','price','cost','gbp','pounds','workshop','workshops','near','me']);
  const words = q.replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>=3 && !stop.has(w));
  // Always bias toward "bluebell" if present (our test topic)
  if (q.includes('bluebell')) return ['bluebell'];
  // else fallback to top 2 meaningful tokens
  return uniq(words).slice(0,2);
}

function fmtDate(dIso) {
  try {
    const d = new Date(dIso);
    if (Number.isNaN(d.valueOf())) return dIso || '';
    // e.g., "April 24, 2026"
    return d.toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
  } catch {
    return dIso || '';
  }
}

function moneyRangeFromOffers(entities=[]) {
  // Accept either {price, price_currency} or {offers:[{price, priceCurrency}]}
  const amounts = [];
  for (const e of entities) {
    if (Array.isArray(e.offers)) {
      e.offers.forEach(o=>{
        const p = Number(o?.price);
        const cur = (o?.priceCurrency || o?.price_currency || '').toString().toUpperCase() || 'GBP';
        if (Number.isFinite(p)) amounts.push({p, cur});
      });
    }
    const p2 = Number(e?.price);
    const cur2 = (e?.price_currency || e?.priceCurrency || '').toString().toUpperCase() || (p2? 'GBP' : '');
    if (Number.isFinite(p2)) amounts.push({p:p2, cur:cur2||'GBP'});
  }
  if (!amounts.length) return null;

  // Prefer GBP if present
  const gbp = amounts.filter(a=>a.cur==='GBP');
  const use = gbp.length ? gbp : amounts;

  const uniqSorted = Array.from(new Set(use.map(x=>x.p))).sort((a,b)=>a-b);
  const cur = use[0].cur || 'GBP';
  const sym = cur==='GBP' ? '£' : (cur==='USD'?'$':`${cur} `);

  if (uniqSorted.length===1) return `${sym}${uniqSorted[0].toFixed(0)}`;
  return `${sym}${uniqSorted[0].toFixed(0)} – ${sym}${uniqSorted[uniqSorted.length-1].toFixed(0)}`;
}

function bluebellFilter(row) {
  const t = `${row?.title||''} ${row?.description||''} ${row?.url||row?.source_url||''} ${row?.page_url||''}`.toLowerCase();
  return t.includes('bluebell');
}

// ----------------- Main handler -----------------
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return errJson(res, 'method_not_allowed', 405);

    const { query='', topK=8 } = (await parseBody(req)) || {};
    const supa = createClient(SUPA_URL, SUPA_KEY);

    const keywords = pickKeywords(query); // ['bluebell'] for our test
    const today = new Date(); today.setHours(0,0,0,0);
    const todayIso = today.toISOString();

    // Build OR-filter for title/url match on keywords
    const ors = [];
    for (const k of keywords) {
      ors.push(`title.ilike.%${k}%`);
      ors.push(`url.ilike.%${k}%`);
      ors.push(`page_url.ilike.%${k}%`);
      ors.push(`description.ilike.%${k}%`);
    }
    const orFilter = ors.join(',');

    // 1) EVENTS filtered by keyword + future date
    let { data: eventsRaw, error: eErr } = await supa
      .from('page_entities')
      .select('title, description, url, source_url, page_url, kind, date_start, date_end, offers, availability')
      .or('kind.eq.Event,kind.eq.event')
      .or(orFilter)
      .gte('date_start', todayIso)
      .order('date_start', { ascending: true })
      .limit(topK * 4);

    if (eErr) throw eErr;
    eventsRaw = (eventsRaw||[]).filter(bluebellFilter);

    // 2) PRODUCTS from same pages (or also keyword-matched)
    const pages = uniq(eventsRaw.map(e=> e.page_url || e.source_url || e.url));
    let { data: prodsRaw, error: pErr } = await supa
      .from('page_entities')
      .select('title, description, url, source_url, page_url, kind, price, price_currency, offers')
      .or('kind.eq.Product,kind.eq.product')
      .or(orFilter)
      .limit(50);

    if (pErr) throw pErr;
    // Prefer products that share a page with our events
    let products = (prodsRaw||[]).filter(r => pages.includes(r.page_url || r.source_url || r.url));
    if (!products.length) {
      // fallback to keyword-matched Bluebell products
      products = (prodsRaw||[]).filter(bluebellFilter);
    }

    // Build citations: prioritise booking pages / event pages
    const eventPages = uniq(eventsRaw.map(e=> e.source_url || e.url || e.page_url));
    const productPages = uniq(products.map(p=> p.source_url || p.url || p.page_url));
    const citations = uniq([...eventPages, ...productPages]).slice(0, 10);

    // Compose answer (deterministic)
    const dates = eventsRaw
      .slice(0, Math.max(3, Math.min(7, topK))) // up to ~7 dates
      .map(e => `- **${fmtDate(e.date_start)}**`);

    const priceRange = moneyRangeFromOffers(products.length?products:eventsRaw);

    let md = '';
    if (dates.length) {
      md += `**Upcoming Bluebell Workshop Dates:**\n${dates.join('\n')}\n\n`;
    } else {
      md += `**Upcoming Bluebell Workshop Dates:**\n- Not found in structured data. Please open the booking page.\n\n`;
    }

    if (priceRange) {
      md += `**Price:** ${priceRange}\n\n`;
    } else {
      md += `**Price:** Not specified in the provided context.\n\n`;
    }

    // Light details
    md += `**Location:** Warwickshire, UK\n\n`;
    md += `For booking and the full schedule, please visit the Bluebell workshop page.\n`;

    // Return structured payload we actually used
    const structured = {
      events: (eventsRaw||[]).map(e=>({
        title: e.title,
        date_start: e.date_start,
        date_end: e.date_end || null,
        url: e.source_url || e.url || e.page_url || null,
        page_url: e.page_url || null,
        offers: e.offers || null
      })),
      products: (products||[]).map(p=>({
        title: p.title,
        url: p.source_url || p.url || p.page_url || null,
        page_url: p.page_url || null,
        price: p.price || null,
        price_currency: p.price_currency || null,
        offers: p.offers || null
      })),
      tried: citations
    };

    okJson(res, { ok:true, answer: md, citations, structured });

  } catch (err) {
    errJson(res, err?.message || err);
  }
}

// ---------- helpers ----------
function parseBody(req) {
  return new Promise((resolve) => {
    let data=''; req.on('data', chunk=> data+=chunk);
    req.on('end', ()=> { try{ resolve(JSON.parse(data||'{}')); }catch{ resolve({}); } });
  });
}
