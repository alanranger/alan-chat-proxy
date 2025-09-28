/* =========================================================================
   Alan Ranger Assistant — chat.js
   v1.3.0
   ========================================================================= */

/* ========================= Config & DOM refs ========================= */
const CHAT_ENDPOINT = '/api/chat';
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('debug') === '1') {
  requestAnimationFrame(() => {
    const p = document.getElementById('debugPanel');
    if (p) p.open = true;
  });
}

const thread   = document.getElementById('thread');
const input    = document.getElementById('q');
const sendBtn  = document.getElementById('send');
const btnEmail = document.getElementById('btn-email');
const btnReset = document.getElementById('btn-reset');

const dbgStatus  = document.getElementById('dbg-status');
const dbgReq     = document.getElementById('dbg-req');
const dbgRes     = document.getElementById('dbg-res');
const dbgHeaders = document.getElementById('dbg-headers');
const dbgStruct  = document.getElementById('dbg-struct');
const dbgProv    = document.getElementById('dbg-prov');
const dbgCopy    = document.getElementById('dbg-copy');
const dbgNote    = document.getElementById('dbg-note');
const dbgSrvVer  = document.getElementById('dbg-srvver');

/* ========================= Utilities ========================= */
function setDebugJSON(el, data, opts={maxLen:1200, maxItems:20}) {
  const replacer = (k,v) => {
    if (typeof v === 'string') {
      return v.length > opts.maxLen ? v.slice(0, opts.maxLen) + '…(truncated)' : v;
    }
    if (Array.isArray(v) && v.length > opts.maxItems) {
      return [...v.slice(0, opts.maxItems), `…(${v.length - opts.maxItems} more items truncated)`];
    }
    return v;
  };
  try { el.textContent = JSON.stringify(data, replacer, 2); }
  catch { el.textContent = String(data); }
}
function collectDebugText(){
  const get = (el) => (el && el.textContent) ? el.textContent : '–';
  const blocks = [
    ['Endpoint','/api/chat'],
    ['Status', get(dbgStatus)],
    ['Server ver', get(dbgSrvVer)],
    ['Headers', get(dbgHeaders)],
    ['Request', get(dbgReq)],
    ['Response', get(dbgRes)],
    ['Structured', get(dbgStruct)],
    ['Provenance', get(dbgProv)],
    ['Note', get(dbgNote)],
  ];
  return blocks.map(([k,v]) => `${k}:\n${v}`).join('\n\n').trim();
}
async function copyAllDebug(){
  const text = collectDebugText();
  if(!text){ alert('Nothing to copy yet.'); return; }
  try{
    if (navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
    } else {
      const ta=document.createElement('textarea');
      ta.value=text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (dbgCopy){
      const old = dbgCopy.textContent;
      dbgCopy.textContent = 'Copied ✓';
      setTimeout(()=>{ dbgCopy.textContent = old; }, 1500);
    }
  }catch(e){
    console.error('Copy failed', e);
    alert('Copy failed. Select the debug text and press Ctrl/Cmd+C.');
  }
}

function addBubble(html, opts={}) {
  const div = document.createElement('div');
  div.className = 'bubble' + (opts.user ? ' user' : '');
  div.innerHTML = html;
  thread.appendChild(div);
  div.scrollIntoView({behavior:'smooth', block:'end'});
  return div;
}
function addTyping() {
  const el = addBubble(`<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`);
  return ()=> el && el.remove();
}
function mdToHtml(md){
  if (!md) return { html:'', liIds:[], items:[] };
  let s = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  const lines = s.split(/\r?\n/);
  let out='', inList=false;
  const flush = ()=>{ if(inList){ out+='</ul>'; inList=false; } };
  for (const line of lines){
    const m = line.match(/^\s*-\s+(.*)$/);
    if (m){ if(!inList){ out+='<ul>'; inList=true; } out += `<li>${m[1].trim()}</li>`; }
    else { flush(); out += line.trim()? `<p>${line}</p>` : ''; }
  }
  flush();
  return { html:`<div class="answer">${out}</div>` };
}
function fmtDateTime(d){
  try{ return new Date(d||Date.now()).toLocaleString(undefined,{hour12:false}); }catch{ return String(d||''); }
}
function fmtDate(iso){
  try{ return new Date(iso).toLocaleDateString(undefined,{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}catch{ return iso; }
}
function currency(amount, ccy){
  if(amount==null || amount==='') return null;
  const n = Number(amount); if(!isFinite(n)) return null;
  try{ return new Intl.NumberFormat(undefined,{style:'currency',currency:ccy||'GBP',maximumFractionDigits:0}).format(n); }
  catch{ return `£${String(amount).replace(/\.00$/,'')}`; }
}
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]) )}

/* ========================= Ranking helpers ========================= */
const lc = (s) => String(s||'').toLowerCase();
const uniq = (a) => [...new Set(a)];
const tokenize2 = (s) => lc(s).match(/[a-z0-9]+/g)||[];
const STOP = new Set([
  'the','and','or','what','whats','when','whens','next','cost',
  'workshop','workshops','photography','photo','near','me','uk',
  'warks','warwickshire','devonshire','district','class','classes','course','courses',
  'long','exposure','sunset','sunrise','landscape','seascape','evening','morning','walk','walks'
]);

/* ---- Anchors & hints ---- */
const LOCATION_HINTS = [
  'coventry','kenilworth','warwickshire','warwick','leamington','balsall common','midlands',
  // new / extended
  'north devon','hartland quay','lynmouth harbour','betws-y-coed','yorkshire dales','snowdonia'
];
const TOPIC_ANCHORS = [
  'portrait','lightroom','editing','post-processing',
  // new anchors requested
  'seascape','woodland','moor','long exposure'
];
const COURSE_ANCHORS = [
  'course','courses','class','classes','tuition','lesson','lessons',
  'beginner','beginners','foundation','intro','introduction','kickstart'
];

/* ---- Query analysis ---- */
function titleTokens(e){ return tokenize2((e?.title||'') + ' ' + (e?.location||'')); }
function urlTokens(e){ return tokenize2((pickUrl(e)||'')); }
function pickUrl(obj){ return obj?.page_url || obj?.source_url || obj?.url || ''; }
function sameHost(a,b){
  try{ const u1=new URL(pickUrl(a)); const u2=new URL(pickUrl(b)); return u1.host===u2.host; }catch{ return false; }
}
function hasAny(hay, list){ hay = Array.isArray(hay)? hay.join(' ') : String(hay||''); const L = lc(hay); return list.some(x => L.includes(lc(x))); }
function detectIntent(payload, query){
  const s = payload?.structured || {}; const q = String(query||'').toLowerCase();
  const server = s.intent || payload?.intent || payload?.meta?.intent || payload?.debug?.intent || '';
  if (/\b(course|courses|class|classes|tuition|lesson|lessons|beginner|beginners|foundation|intro)\b/.test(q)) return 'course';
  if (/\b(workshop|workshops|event|events|when|whens|next)\b/.test(q)) return 'events';
  if (/\b(price|cost|fee|fees|how much|book|booking|buy)\b/i.test(q)) return 'products';
  return server ? server.toLowerCase() : 'unknown';
}
function isWorkshopProduct(p){
  const s = lc((p?.title||'')+' '+(pickUrl(p)||'')); return /\bworkshop/.test(s);
}
function isCourseProduct(p){
  const s = lc((p?.title||'')+' '+(pickUrl(p)||'')); return /\b(course|class|tuition|lesson)s?\b/.test(s);
}

/* ========================= Product rendering ========================= */
function mergeProducts(list){
  if(!Array.isArray(list) || !list.length) return [];
  const map = new Map();
  for(const p of list){
    const key = (p.url || p.page_url || p.source_url || p.title || '').toLowerCase();
    if(!map.has(key)) { map.set(key, JSON.parse(JSON.stringify(p))); continue; }
    const m = map.get(key);
    for(const k of ['price','price_currency','availability','provider','description','title']) if(m[k]==null && p[k]!=null) m[k]=p[k];
    for (const k of ['display_price_gbp','display_price','availability_status','availability_raw','price_gbp','product_kind_resolved','price_source']) {
      if (m[k]==null && p[k]!=null) m[k]=p[k];
    }
  }
  return [...map.values()];
}
function getMetaDescription(prod){
  const pick = (...c)=>{ for(const v of c){ if(typeof v==='string' && v.trim()) return v.trim(); } return ''; };
  const firstSentence = t=>{ const s=String(t||'').trim(); const m=s.match(/^(.*?\.)(\s|$)/); return m? m[1].trim() : s; };
  const limit = (t,max=220)=>{ const m=String(t||'').trim().match(new RegExp(`^(.{0,${max}}?[.!?])\\s`)); if(m&&m[1]) return m[1].trim(); return (t||'').length>max ? String(t).slice(0,max).replace(/\s+\S*$/,'')+'…' : t; };
  const raw = pick(prod?.meta_description, prod?.metaDescription, prod?.meta?.description, prod?.seo?.metaDescription, prod?.seo?.description, prod?.raw?.metaDescription, prod?.raw?.meta?.description);
  const fallback = firstSentence(prod?.description||'');
  return limit(raw || fallback, 220);
}
function extractFacts(desc){
  const txt = String(desc||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const findAfter = (label)=>{
    const i = txt.findIndex(l=>new RegExp(`^${label}\\s*:?$`,'i').test(l));
    if(i>=0 && i+1<txt.length) return txt[i+1];
    const flat = txt.find(l=>new RegExp(`^${label}\\s*:?\\s+(.+)$`,'i').test(l));
    if(flat) return flat.replace(new RegExp(`^${label}\\s*:?\\s+`,'i'),'');
    return null;
  };
  return {
    location: findAfter('Location'),
    participants: findAfter('Participants'),
    fitness: findAfter('Fitness'),
    availability: findAfter('Availability'),
  };
}
function productHeadlinePrice(prod){
  if (prod.display_price) return String(prod.display_price);
  if (typeof prod.display_price_number === 'number') return currency(prod.display_price_number, 'GBP');
  if (typeof prod.price_gbp === 'number') return currency(prod.price_gbp, 'GBP');
  if (typeof prod.price === 'number') return currency(prod.price, prod.price_currency||'GBP');
  return null;
}
function renderProductCard(prod){
  const facts = extractFacts(prod.description||'');
  const priceHead = productHeadlinePrice(prod);
  const lines = [];
  if (priceHead) lines.push(`<p class="kvline"><strong>Price:</strong> ${escapeHTML(priceHead)}</p>`);
  const md = getMetaDescription(prod);
  if(md) lines.push(`<p class="meta">${escapeHTML(md)}</p>`);
  if (prod.availability_status){
    lines.push(`<p class="kvline"><strong>Availability:</strong> ${escapeHTML(String(prod.availability_status).replace(/^https?:\/\/schema\.org\//i,'').replace(/([a-z])([A-Z])/g,'$1 $2'))}</p>`);
  } else if(facts.availability){
    const avail = (facts.availability||'').toString().replace(/^https?:\/\/schema\.org\//i,'').replace(/([a-z])([A-Z])/g,'$1 $2');
    lines.push(`<p class="kvline"><strong>Availability:</strong> ${escapeHTML(avail)}</p>`);
  }
  if(facts.location)     lines.push(`<p class="kvline"><strong>Location:</strong> ${escapeHTML(facts.location)}</p>`);
  if(facts.participants) lines.push(`<p class="kvline"><strong>Participants:</strong> ${escapeHTML(facts.participants)}</p>`);
  if(facts.fitness)      lines.push(`<p class="kvline"><strong>Fitness:</strong> ${escapeHTML(facts.fitness)}</p>`);
  const href = pickUrl(prod) || '#';
  const book = href && href !== '#' ? `<p style="margin-top:8px"><a href="${href}" target="_blank" rel="noopener">Book now →</a></p>` : '';
  return `<div class="answer"><h3>${escapeHTML(prod.title || 'Workshop')}</h3>${lines.join('')}${book}</div>`;
}

/* ========================= Events & Articles ========================= */
function futureEvents(structured){
  const now = new Date();
  return (structured?.events||[]).filter(e=>e?.date_start && !isNaN(Date.parse(e.date_start)) && new Date(e.date_start)>=now);
}
function eventHeaderLabel(structured, __lastQuery){
  const q = (__lastQuery||'').toLowerCase();
  if (/\b(course|courses|class|classes|tuition|lesson|lessons|beginner|beginners|foundation|intro)\b/.test(q) || structured?.event_subtype==='course') return 'Upcoming Courses';
  if (/\b(workshop|workshops)\b/.test(q) || structured?.event_subtype==='workshop') return 'Upcoming Workshops';
  return 'Upcoming Events';
}
function articleUrl(a){ return a?.page_url || a?.source_url || a?.url || ''; }
function articleTitle(a){ return a?.title || a?.raw?.name || ''; }
function pickArticles(structured){
  const all = Array.isArray(structured?.articles) ? structured.articles : [];
  return all.filter(a => articleUrl(a) && articleTitle(a)).slice(0,5);
}

/* --------- Date extraction for synthetic course events --------- */
function extractDatesFromText(text, yearHint) {
  const out = [];
  const y = yearHint || new Date().getFullYear();
  const t = String(text||'');
  // e.g. Thu, 02 Oct 2025 — or 02 Oct 2025 — or 2 October 2025
  const rx = /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/gi;
  let m;
  while ((m = rx.exec(t))) {
    const dStr = `${m[1]} ${m[2]} ${m[3]}`;
    const d = Date.parse(dStr);
    if (!isNaN(d)) out.push(new Date(d).toISOString());
  }
  // bare day + month, add hint year
  const rx2 = /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi;
  while ((m = rx2.exec(t))) {
    const dStr = `${m[1]} ${m[2]} ${y}`;
    const d = Date.parse(dStr);
    if (!isNaN(d)) {
      const iso = new Date(d).toISOString();
      if (!out.includes(iso)) out.push(iso);
    }
  }
  return out.sort();
}
function synthesizeEventsFromCourseProduct(prod) {
  const long = String(
    prod?.raw?.metaDescription ||
    prod?.raw?.meta?.description ||
    prod?.description || ''
  );
  const dates = extractDatesFromText(long, new Date().getUTCFullYear())
    .map(iso => new Date(iso))
    .filter(d => d >= new Date());
  if (!dates.length) return [];

  const loc = (long.match(/Location\s*:\s*([^\n\r]+)/i)?.[1] || '').trim();
  const title = prod?.title || prod?.raw?.name || 'Course';
  const url = pickUrl(prod) || '#';

  return dates.slice(0, 6).map(d => ({
    date_start: d.toISOString(),
    location: loc || '',
    title,
    page_url: url,
    url
  }));
}

/* ========================= Action Pills ========================= */
function buildActionPillsFromStructured(structured, query){
  const safe = []; const used = new Set();
  const add = (label, href) => { if(!label || !href) return; const key = `${label}::${href}`; if(used.has(key)) return; used.add(key); safe.push({label,href}); };
  for (const p of (structured?.pills || structured?.chips || [])) add(p.label || p.text || 'Open', p.url || p.href);
  for (const a of pickArticles(structured).slice(0,2)) add(articleTitle(a) || 'Read Guide', articleUrl(a));
  return safe.slice(0,5);
}

/* ========================= Gating & heuristics ========================= */
function isPriceyQuery(q){ return /\b(price|cost|fee|fees|how much|book|booking|buy)\b/i.test(String(q||'')); }
function heuristicConfidence(structured){
  let score = 0;
  if (structured?.products?.length) score += 40;
  if (structured?.events?.length)   score += 40;
  if (structured?.articles?.length) score += 20;
  return Math.min(95, Math.max(20, score || 25));
}
function decideProductRendering(payload, mergedProducts, query){
  const s = payload?.structured || {};
  const intent = detectIntent(payload, query);
  const evs = futureEvents(s);
  const hasEvs = evs.length > 0;
  const topEv = hasEvs ? evs[0] : null;
  const bookNowUrl = (s.pills || []).find(p => /book now/i.test(p.label||''))?.url || null;

  if (!mergedProducts.length)           return {show:false, reason:'no-products'};
  if (intent === 'products')            return {show:true,  reason:'intent-products'};
  if (isPriceyQuery(query))             return {show:true,  reason:'pricey-query'};
  if (bookNowUrl)                       return {show:true,  reason:'book-pill-present'};
  if (!hasEvs)                          return {show:true,  reason:'no-events-fallback'};

  // light overlap
  const prod = mergedProducts[0];
  const tP = tokenize2((prod.title||'') + ' ' + (prod.location||'')); 
  const tE = tokenize2((topEv.title||'') + ' ' + (topEv.location||'')); 
  const overlap = tP.filter(x=>tE.includes(x) && !STOP.has(x));
  if (overlap.length >= 2) return {show:true, reason:'strong-match'};
  return {show:false, reason:'prefer-events'};
}

/* ========================= Rendering ========================= */
let __lastQuery = '';

function renderEventsBlock(structured, rankedProducts, subtype){
  let list = futureEvents(structured);

  // synthesize dates for course queries if no events came back
  if ((!list || !list.length) && subtype === 'course' && rankedProducts && rankedProducts.length) {
    const topCourse = rankedProducts.find(p => isCourseProduct(p) || hasAny((p.title||'')+' '+pickUrl(p), COURSE_ANCHORS));
    if (topCourse) {
      list = synthesizeEventsFromCourseProduct(topCourse);
    }
  }

  if(!list || !list.length) return '';

  // rank basic by date (already filtered/fabricated)
  list = list.sort((a,b) => new Date(a.date_start)-new Date(b.date_start));

  const lis = list.map(e=>{
    const when=fmtDate(e.date_start);
    const href=e.page_url||e.source_url||e.url||'#';
    const where=e.location ? `${escapeHTML(e.location)}` : '';
    const title=e.title ? `${escapeHTML(e.title)}` : '';
    return `<li><div><strong>${when}${where ? ' — ' + where : ''}</strong> — <a href="${href}" target="_blank" rel="noopener">Link</a></div><div>${title}</div></li>`;
  }).join('');

  const header = eventHeaderLabel(structured, __lastQuery);
  return `<div class="answer"><h3>${header}</h3><ul>${lis}</ul></div>`;
}

function renderArticlesBlock(structured){
  const list = pickArticles(structured);
  if(!list.length) return '';
  const lis = list.map(a=>`<li><a href="${articleUrl(a)}" target="_blank" rel="noopener">${escapeHTML(articleTitle(a))}</a></li>`).join('');
  return `<div class="answer"><h3>Guides that match your question</h3><ul>${lis}</ul></div>`;
}

/* ---- Main answer renderer ---- */
function renderAnswer(payload){
  try { if (dbgSrvVer) dbgSrvVer.textContent = payload?.debug?.version || '–'; } catch {}

  const s = payload.structured||{};
  const intentSubtype = detectIntent(payload, __lastQuery); // 'course'|'events'|'products'|'unknown'

  // rank products with subtype bias and location/topic anchors
  const qTokens = tokenize2(__lastQuery);
  const queryHasLocationPhrase = hasAny(__lastQuery, LOCATION_HINTS);
  const queryHasTopicAnchor    = hasAny(__lastQuery, TOPIC_ANCHORS);

  const products = mergeProducts(s.products||[]);
  let rankedProducts = products
    .map((p) => {
      let score = 0;

      const hay = lc(
        (p?.title || '') + ' ' +
        (p?.raw?.name || '') + ' ' +
        (p?.description || p?.raw?.metaDescription || p?.raw?.meta?.description || '') + ' ' +
        (pickUrl(p) || '')
      );

      // lexical match
      for (const t of qTokens) if (t && hay.includes(t)) score += 0.15;

      // anchors/hints
      if (queryHasLocationPhrase && hasAny(hay, LOCATION_HINTS)) score += 0.20;
      if (queryHasTopicAnchor && hasAny(hay, TOPIC_ANCHORS))     score += 0.20;

      // subtype bias
      if (intentSubtype === 'course') {
        if (isCourseProduct(p) || hasAny(hay, COURSE_ANCHORS)) score += 0.80;
        if (isWorkshopProduct(p)) score -= 0.60;
      }

      // beginner bias when user asks for beginners
      if (/\bbeginner|beginners\b/.test(__lastQuery) && /\bbeginner|beginners\b/.test(hay)) score += 0.35;

      return { p, s: score };
    })
    .sort((a,b)=> b.s - a.s)
    .map(x => x.p);

  // decide whether to show a product card
  const gate = decideProductRendering(payload, rankedProducts, __lastQuery);
  if (gate.show && rankedProducts.length) {
    addBubble(renderProductCard(rankedProducts[0]));
  }

  // events (with synthetic fallback for courses)
  const evHTML = renderEventsBlock(s, rankedProducts, intentSubtype);
  if(evHTML) addBubble(evHTML);

  // articles
  const artHTML = renderArticlesBlock(s);
  if(artHTML) addBubble(artHTML);

  // action pills
  const pills = buildActionPillsFromStructured(s, __lastQuery);
  if(pills.length){
    const wrap = document.createElement('div'); wrap.className='actions';
    pills.forEach(p=>{ const a=document.createElement('a'); a.className='pill'; a.textContent=p.label; a.href=p.href; a.target='_blank'; a.rel='noopener'; wrap.appendChild(a); });
    thread.appendChild(wrap);
  }

  // footer + chime
  let confidencePct = (typeof payload.confidence_pct === 'number') ? payload.confidence_pct : null;
  const heuristic = heuristicConfidence(s);
  if (confidencePct == null || confidencePct < 50) confidencePct = heuristic;
  const rounded = Math.round(confidencePct);
  const footer = document.createElement('div');
  footer.className = 'footer-status';
  footer.innerHTML = `<span class="badge conf ${rounded>=70?'green':rounded>=35?'amber':'red'}">Confidence: ${rounded}%</span> <span class="badge ts">Answered: ${fmtDateTime(Date.now())}</span>`;
  thread.appendChild(footer);

  playChime();

  // fallback if nothing else showed content
  if(!gate.show && !(s.events||[]).length && !(s.articles||[]).length){
    const md = payload.answer_markdown || payload.answer || '';
    const extra = `<p>If this doesn’t answer your question, please use the Contact or WhatsApp buttons above to reach Alan directly.</p>`;
    const {html}=mdToHtml(md || "I don’t have a specific answer for that yet.");
    addBubble(html.replace('</div>', `${extra}</div>`));
  }

  setDebugJSON(dbgStruct, payload.structured||{});
  const note = payload.debug ? {...payload.debug, product_gate: gate} : { product_gate: gate };
  setDebugJSON(dbgNote, note);
}

/* ========================= Chime ========================= */
function playChime(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.value=880; g.gain.value=0.0001; o.connect(g); g.connect(ctx.destination);
    o.start();
    const now=ctx.currentTime; g.gain.exponentialRampToValueAtTime(0.08, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.25);
    o.stop(now+0.28);
  }catch{}
}

/* ========================= Networking ========================= */
async function sendQuery(query){
  __lastQuery = String(query||'');
  const req = { query, topK: 8 };
  setDebugJSON(dbgReq, req);
  const closeTyping = addTyping();
  try{
    const res = await fetch(CHAT_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req) });
    dbgStatus.textContent = res.status;
    const headers = {}; res.headers.forEach((v,k)=>headers[k]=v); setDebugJSON(dbgHeaders, headers);

    let data = null; const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) data = await res.json(); else data = { ok: false, error: await res.text() || `HTTP ${res.status}` };
    setDebugJSON(dbgRes, data); setDebugJSON(dbgProv, { citations: data.citations || [] });

    closeTyping();
    if (data && data.ok && (data.answer_markdown || data.answer || (data.structured && (data.structured.products?.length || data.structured.events?.length || data.structured.articles?.length)))) {
      renderAnswer(data);
    } else if (data && !data.ok) {
      const footer = document.createElement('div'); footer.className = 'footer-status'; footer.innerHTML = `<span class="badge conf red">Confidence: 25%</span> <span class="badge ts">Answered: ${fmtDateTime(Date.now())}</span>`; thread.appendChild(footer);
      addBubble(`<div class="answer"><p>Server error: ${escapeHTML(String(data.error||'Unknown'))}</p><p>If it continues, please use the Contact form or WhatsApp buttons above.</p></div>`);
      playChime();
    } else {
      const footer = document.createElement('div'); footer.className = 'footer-status'; footer.innerHTML = `<span class="badge conf amber">Confidence: 50%</span> <span class="badge ts">Answered: ${fmtDateTime(Date.now())}</span>`; thread.appendChild(footer);
      const fallback = "I don’t have a specific answer for that yet."; const {html}=mdToHtml(fallback);
      const extra = `<p>If this doesn’t answer your question, please use the Contact form or WhatsApp buttons above to reach Alan directly.</p>`;
      addBubble(html.replace('</div>', `${extra}</div>`));
      playChime();
    }
  } catch (err){
    closeTyping(); dbgStatus.textContent = 'error';
    const footer = document.createElement('div'); footer.className = 'footer-status';
    footer.innerHTML = `<span class="badge conf red">Confidence: 25%</span> <span class="badge ts">Answered: ${fmtDateTime(Date.now())}</span>`;
    thread.appendChild(footer);
    addBubble(`<div class="answer"><p>Something went wrong: ${escapeHTML(String(err))}</p><p>If it continues, please use the Contact form or WhatsApp buttons above.</p></div>`);
    playChime();
  }
}

/* ========================= Transcript & wiring ========================= */
function nodeToPlain(div){ return div.textContent.replace(/\s+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim(); }
function buildTranscript(){
  const rows = [];
  rows.push(`Alan Ranger Assistant — transcript`);
  rows.push(new Date().toISOString()); rows.push('');
  for (const el of thread.children){ if (el.classList.contains('actions')) continue; const role = el.classList.contains('user') ? 'User' : 'Assistant'; rows.push(`${role}:\n${nodeToPlain(el)}`); rows.push(''); }
  return rows.join('\n');
}
function emailTranscript(){
  const body = buildTranscript();
  const subject = 'Alan Ranger Assistant chat transcript';
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0,2000))}`;
  if (body.length > 2000){
    const blob = new Blob([body], {type:'text/plain'}); const url = URL.createObjectURL(blob);
    addBubble(`<div class="answer"><p>Transcript is quite long. You can <a href="${url}" download="alan-ranger-assistant-transcript.txt">download the full transcript</a> or use the shortened email draft that just opened.</p></div>`);
  }
  location.href = mailto;
}
function resetChat(){
  thread.innerHTML = '';
  addBubble('Hi! I can help with workshops, tuition, and photography advice.');
  [dbgStatus, dbgHeaders, dbgReq, dbgRes, dbgStruct, dbgProv, dbgNote, dbgSrvVer].forEach(el=>{ if(!el) return; el.textContent = el.id==='dbg-status' ? '–' : '–'; });
}
function submit(){
  const val = input.value.trim(); if(!val) return;
  addBubble(val, {user:true}); input.value=''; sendQuery(val);
}

sendBtn && sendBtn.addEventListener('click', submit);
input   && input.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); submit(); }});
btnEmail&& btnEmail.addEventListener('click', emailTranscript);
btnReset&& btnReset.addEventListener('click', resetChat);
dbgCopy && dbgCopy.addEventListener('click', copyAllDebug);
