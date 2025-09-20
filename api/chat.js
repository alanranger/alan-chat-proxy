/* api/chat.ts
   Next.js (Vercel) edge/serverless API route for Alan Ranger Assistant
   - Accepts:  { query: string, topK?: number }
   - Returns:  { ok, answer_markdown, citations, structured, confidence, ... }
*/

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ========= Runtime & Supabase =========
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const SELECT_COLS =
  'id, kind, title, page_url, source_url, description, price, price_gbp, location, last_seen, date_start, date_end, raw'

const GENERIC = new Set([
  'the','and','for','with','workshop','workshops','photography','photo','class','course',
  'of','to','in','on','by','uk','near','me','alan','ranger','landscape','session','day',
  'evening','dates','various','monthly','guide',
])

// ========= Helpers =========
function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}
function normaliseToken(s: string) {
  return s.normalize('NFKC').toLowerCase()
}
function safe(obj: any, path: string[], fallback?: any) {
  return path.reduce((o, k) => (o && k in o ? o[k] : undefined), obj) ?? fallback
}
function pickUrl(x: any): string | undefined {
  return x?.page_url || x?.source_url || safe(x, ['raw', 'url'])
}
function parseHost(u?: string) {
  try {
    if (!u) return ''
    const { host } = new URL(u)
    return host.replace(/^www\./, '')
  } catch {
    return ''
  }
}
function sameHost(a: any, b: any) {
  return parseHost(pickUrl(a)) && parseHost(pickUrl(a)) === parseHost(pickUrl(b))
}
function nowISO() {
  return new Date().toISOString()
}

// ========= Query understanding (VERY light) =========
function detectIntent(q: string) {
  const s = q.toLowerCase()
  const isEvents =
    /(when|date|next|upcoming|where|time|schedule|available)/.test(s) ||
    /workshop|walk|course|class|trip|tour/.test(s)
  return {
    intent: isEvents ? 'events' : 'general',
    event_subtype: 'workshop',
    topic: s,
  }
}

// ========= Tokenisation =========
function extractQueryTokens(q: string) {
  const tokens =
    (q.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
      (t) => t.length >= 3 && !GENERIC.has(t),
    )
  return uniq(tokens)
}

// ========= Event Search =========
async function fetchEvents(query: string, topK = 8) {
  const toks = extractQueryTokens(query)
  const ors: string[] = []
  const likeFields = [
    'title',
    'page_url',
    'source_url',
    'description',
    'raw->>name',
    'raw->>description',
  ]
  for (const t of toks.slice(0, 8)) {
    for (const f of likeFields) ors.push(`${f}.ilike.%${t}%`)
  }
  const orExpr = ors.length ? ors.join(',') : undefined

  let qb = supabase.from('page_entities').select(SELECT_COLS).eq('kind', 'event')
  if (orExpr) qb = qb.or(orExpr)
  const { data, error } = await qb.order('date_start', { ascending: true }).limit(topK)
  if (error) throw error
  return data || []
}

// ========= Product Search =========
async function fetchProductsByTokens(tokens: string[], limit = 60) {
  if (!tokens.length) return []
  const fields = [
    'title',
    'page_url',
    'source_url',
    'description',
    'raw->>metaDescription',
    'raw->meta->>description',
  ]
  const ors: string[] = []
  for (const t of tokens.slice(0, 12)) {
    for (const f of fields) ors.push(`${f}.ilike.%${t}%`)
  }
  const { data } = await supabase
    .from('page_entities')
    .select(SELECT_COLS)
    .eq('kind', 'product')
    .or(ors.join(','))
    .order('last_seen', { ascending: false })
    .limit(limit)
  return data || []
}

// ========= Articles =========
async function fetchArticles(tokens: string[], limit = 10) {
  if (!tokens.length) return []
  const fields = ['title', 'page_url', 'source_url', 'description']
  const ors: string[] = []
  for (const t of tokens.slice(0, 8)) {
    for (const f of fields) ors.push(`${f}.ilike.%${t}%`)
  }
  const { data } = await supabase
    .from('page_entities')
    .select('id, title, page_url, source_url, last_seen')
    .eq('kind', 'article')
    .or(ors.join(','))
    .order('last_seen', { ascending: false })
    .limit(limit)
  return data || []
}

// ========= Defining-tokens extraction (from FIRST EVENT) =========
function extractTopicAndLocationTokensFromEvent(ev: any) {
  const t = (ev?.title || ev?.raw?.name || '').toLowerCase()
  const u = (pickUrl(ev) || '').toLowerCase()

  const locList = [
    'kenilworth',
    'coventry',
    'warwickshire',
    'dartmoor',
    'devon',
    'hartland',
    'anglesey',
    'yorkshire',
    'dales',
    'wales',
    'betws',
    'snowdonia',
    'northumberland',
    'batsford',
    'gloucestershire',
    'chesterton',
    'windmill',
    'peak',
    'derbyshire',
    'staffordshire',
    'lynmouth',
    'exmoor',
    'burnham',
    'somerset',
    'lake',
    'district',
  ]

  const topicList = [
    'long exposure',
    'sunset',
    'sunrise',
    'seascape',
    'woodland',
    'urban',
    'architecture',
    'heather',
    'lavender',
    'windmill',
    'fairy',
    'glen',
    'padley',
    'gorge',
    'batsford',
    'arboretum',
    'lake district',
    'exmoor',
    'burnham',
    'lighthouse',
    'dartmoor',
    'hartland',
    'yorkshire dales',
    'devon',
  ]

  const topic = topicList.filter((ph) => t.includes(ph) || u.includes(ph))
  const location = locList.filter((ph) => t.includes(ph) || u.includes(ph))

  if (!topic.length) {
    const singles = [
      'long',
      'exposure',
      'sunset',
      'seascape',
      'woodland',
      'urban',
      'architecture',
      'windmill',
    ]
    topic.push(...singles.filter((w) => t.includes(w) || u.includes(w)))
  }

  const bag = (t + ' ' + u).match(/[a-z0-9]+/gi) || []
  const all = uniq(
    bag.map(normaliseToken).concat(topic.map(normaliseToken)).concat(location.map(normaliseToken)),
  )

  return { all, topic: uniq(topic.map(normaliseToken)), location: uniq(location.map(normaliseToken)) }
}

// ========= Scoring & selection (FIXED) =========
function overlapScore(refTokens: Set<string>, url?: string, title?: string) {
  const cand = (String(title || '') + ' ' + String(url || '')).toLowerCase()
  const candTokens = new Set(
    (cand.replace(/^https?:\/\//, '').replace(/[\/_-]+/g, ' ').match(/[a-z0-9]+/g) || [])
      .map(normaliseToken)
      .filter((x) => x.length >= 3 && !GENERIC.has(x)),
  )
  let inter = 0
  for (const tk of refTokens) if (candTokens.has(tk)) inter++
  const union = refTokens.size + candTokens.size - inter || 1
  return inter / union
}

function hasAny(hay: string, list: string[]) {
  return list.some((tok) => hay.includes(tok))
}
function inTitleOrUrl(p: any, tok: string) {
  const s = ((p.title || '') + ' ' + (pickUrl(p) || '')).toLowerCase()
  return s.includes(tok)
}

function penaltyIfWalk(p: any, eventTitle?: string) {
  const pt = (p.title || '').toLowerCase()
  const pu = (pickUrl(p) || '').toLowerCase()
  const isWalk = /walk|photowalk/.test(pt + ' ' + pu)
  const eventIsWalk = /walk|photowalk/.test(String(eventTitle || '').toLowerCase())
  return isWalk && !eventIsWalk ? -0.12 : 0
}

async function findBestProductForEvent(
  firstEvent: any,
  preloadProducts: any[] = [],
): Promise<any | null> {
  if (!firstEvent) return null

  const { topic, location, all } = extractTopicAndLocationTokensFromEvent(firstEvent)
  const refTokens = new Set(
    uniq([...all, ...topic, ...location]).filter((t) => t.length >= 3 && !GENERIC.has(t)),
  )
  const defining = uniq(topic.filter((t) => t && t.length >= 3))
  const needLoc = location.length ? location : []

  const scoreProduct = (p: any) => {
    const title = (p.title || '').toLowerCase()
    const url = (pickUrl(p) || '').toLowerCase()
    const hayTU = title + ' ' + url
    const hayAll = (p.description || '').toLowerCase() + ' ' + hayTU

    if (needLoc.length && !hasAny(hayAll, needLoc)) return -1

    if (defining.length && !hasAny(hayTU, defining)) return -1

    let s = overlapScore(refTokens, url, title)

    if (/long\s+exposure/.test(hayTU)) s += 0.18
    for (const tok of defining) if (inTitleOrUrl(p, tok)) s += 0.06
    if (sameHost(p, firstEvent)) s += 0.06
    s += penaltyIfWalk(p, firstEvent.title)

    return s
  }

  const pickBest = (arr: any[]) => {
    let best: any = null
    let bestScore = -1
    for (const p of arr) {
      const s = scoreProduct(p)
      if (s > bestScore) {
        best = p
        bestScore = s
      }
    }
    return bestScore >= 0.18 ? best : null
  }

  let best = pickBest(preloadProducts || [])
  if (best) return best

  const tokenList = uniq([...Array.from(refTokens)]).slice(0, 12)
  const more = await fetchProductsByTokens(tokenList, 60)
  best = pickBest(more)
  return best || null
}

// ========= Confidence (very rough) =========
function confidencePct(events: any[], product: any | null) {
  let c = 20
  if (events.length) c += 20
  if (product) c += 35
  if (events.length > 2) c += 10
  return Math.max(10, Math.min(95, c))
}

// ========= Compose answer =========
function humanWhen(ev: any) {
  try {
    const d = new Date(ev.date_start)
    return d.toUTCString()
  } catch {
    return ev.date_start
  }
}

function composeAnswerMarkdown(bestProduct: any | null, firstEvent: any | null) {
  if (bestProduct) {
    const price = bestProduct.display_price ?? bestProduct.price ?? bestProduct.raw?.offers?.price
    const title = bestProduct.title || 'Workshop'
    let head = `**${title}**`
    if (typeof price !== 'undefined' && price !== null) head += ` — £${price}`
    const desc =
      bestProduct.description ||
      bestProduct.raw?.description ||
      'Find full details on the product page.'
    const url = pickUrl(bestProduct)
    return `${head}\n\n${desc.split('\n').slice(0, 14).join('\n')}\n\n[Open](${url})`
  }
  if (firstEvent) {
    return `**${firstEvent.title}** — ${humanWhen(firstEvent)}\n\n[View event](${pickUrl(firstEvent)})`
  }
  return 'I could not find a relevant workshop right now.'
}

// ========= Main handler =========
export default async function handler(req: NextRequest) {
  const started = Date.now()
  try {
    const body = await req.json()
    const query: string = body?.query || ''
    const topK: number = Number(body?.topK || 8)

    const { intent, event_subtype, topic } = detectIntent(query)

    // events
    const events = await fetchEvents(query, topK)
    const firstEvent = events[0] || null

    // products (preload some likely ones)
    const preloadTokens = extractQueryTokens(query)
    const preloadProducts = await fetchProductsByTokens(preloadTokens, 40)
    const featuredProduct = await findBestProductForEvent(firstEvent, preloadProducts)

    // articles
    const articles = await fetchArticles(preloadTokens, 10)

    // pills
    const pills: Array<{ label: string; url: string; brand: 'primary' | 'secondary' }> = []
    if (featuredProduct) pills.push({ label: 'Book Now', url: pickUrl(featuredProduct)!, brand: 'primary' })
    if (firstEvent) pills.push({ label: 'View event', url: pickUrl(firstEvent)!, brand: 'secondary' })
    pills.push({ label: 'Photos', url: 'https://www.alanranger.com/photography-portfolio', brand: 'secondary' })

    const answer_markdown = composeAnswerMarkdown(featuredProduct, firstEvent)
    const confidence_pct = confidencePct(events, featuredProduct)
    const structured = {
      intent,
      topic,
      event_subtype,
      events: (events || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        page_url: e.page_url,
        source_url: e.source_url,
        date_start: e.date_start,
        date_end: e.date_end,
        location: e.location,
        when: humanWhen(e),
        href: pickUrl(e),
        _score: 0.23, // placeholder; your ranker can set real scores
      })),
      products: (preloadProducts || [])
        .concat(featuredProduct ? [featuredProduct] : [])
        .filter(Boolean)
        .slice(0, 18)
        .map((p: any) => ({
          id: p.id,
          title: p.title,
          page_url: p.page_url,
          source_url: p.source_url,
          description: p.description,
          price: p.price,
          price_gbp: p.price_gbp,
          location: p.location,
          raw: p.raw,
          _score: 0.21,
          display_price: p.display_price ?? p.price ?? p.raw?.offers?.price ?? null,
        })),
      articles: (articles || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        page_url: a.page_url,
        source_url: a.source_url,
        last_seen: a.last_seen,
      })),
      pills,
    }

    const debug = {
      version: 'v1.0.0-products-from-first-event+topic-tokens',
      intent,
      event_subtype,
      first_event: firstEvent
        ? { id: firstEvent.id, title: firstEvent.title, url: pickUrl(firstEvent), date_start: firstEvent.date_start }
        : null,
      featured_product: featuredProduct
        ? { id: featuredProduct.id, title: featuredProduct.title, url: pickUrl(featuredProduct), display_price: featuredProduct.display_price ?? featuredProduct.price }
        : null,
      counts: {
        events: events.length,
        products: preloadProducts.length,
        articles: articles.length,
      },
      timings_ms: {
        total: Date.now() - started,
      },
    }

    const res = {
      ok: true,
      answer_markdown,
      citations: [], // you can add your own citation list here if desired
      structured,
      confidence: confidence_pct / 100,
      confidence_pct,
      debug,
      meta: {
        duration_ms: Date.now() - started,
        endpoint: '/api/chat',
        topK,
        intent,
      },
    }

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    })
  } catch (err: any) {
    const res = {
      ok: false,
      error: `A server error has occurred\n\n${String(err?.message || err)}\n`,
    }
    return new Response(JSON.stringify(res), {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    })
  }
}
