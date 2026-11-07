#!/usr/bin/env node
/**
 * Cross-match booking sheet workshop participants to reviews for gap locations.
 * Output: alan-shared-resources/csv processed/09-booking-review-gap-matches.csv
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources';
const BOOKINGS = path.join(SHARED, 'bookings');
const CSV_DIR = path.join(SHARED, 'csv processed');

const GAP_TILES = [
  { key: 'anglesey', slug: 'landscape-photography-workshops-anglesey', patterns: [/anglesey/i] },
  {
    key: 'wales_pistyll_vyrnwy',
    slug: 'wales-photography-workshop-pistyll-rhaeadr',
    patterns: [/pistyll/i, /vyrnwy/i, /dee valley/i, /lake vyrnwy/i],
  },
  { key: 'dartmoor', slug: 'dartmoor-photography-workshops', patterns: [/dartmoor/i] },
  {
    key: 'exmoor_lynmouth',
    slug: 'exmoor-photography-workshops-lynmouth',
    patterns: [/exmoor/i, /lynmouth/i],
  },
  {
    key: 'devon_hartland',
    slug: 'landscape-photography-devon-hartland-quay',
    patterns: [/hartland/i, /devon/i],
    excludePatterns: [/exmoor/i, /lynmouth/i],
  },
  {
    key: 'yorkshire_dales',
    slug: 'yorkshire-dales-landscape-photography-workshop',
    patterns: [/yorkshire dales/i, /\bdales\b/i],
  },
  {
    key: 'north_yorkshire',
    slug: 'north-yorkshire-landscape-photography-workshop',
    patterns: [/north yorkshire/i, /n\.?\s*yorks/i],
  },
  {
    key: 'northumberland',
    slug: 'coastal-northumberland-photography-workshops',
    patterns: [/northumbria/i, /northumberland/i],
  },
  { key: 'suffolk', slug: 'suffolk-landscape-photography-workshops', patterns: [/suffolk/i] },
  {
    key: 'ireland',
    slug: 'ireland-photography-workshops-dingle',
    patterns: [/ireland/i, /dingle/i, /kerry/i],
  },
];

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let cur = '';
  let inQ = false;
  let row = [];
  let hdr = [];
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQ = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (!hdr.length) hdr = row.map((h) => h.replace(/^\uFEFF/, '').trim());
      else if (row.some((x) => x !== '')) {
        rows.push(Object.fromEntries(hdr.map((h, ix) => [h, row[ix] || ''])));
      }
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  return rows;
}

function normName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(first, last) {
  const full = normName(`${first} ${last}`);
  const parts = full.split(' ').filter((p) => p.length > 1);
  return { full, parts, last: parts[parts.length - 1] || '' };
}

function namesMatch(a, b) {
  if (!a.full || !b.full) return false;
  if (a.full === b.full) return true;
  if (a.last && b.last && a.last === b.last) {
    const af = a.parts[0];
    const bf = b.parts[0];
    if (af && bf && (af[0] === bf[0] || af.startsWith(bf) || bf.startsWith(af))) return true;
  }
  const overlap = a.parts.filter((p) => b.parts.includes(p) && p.length > 2);
  return overlap.length >= 2;
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function daysBetween(a, b) {
  return Math.abs((a - b) / (86400000));
}

function tileForLocation(loc) {
  const s = String(loc || '');
  for (const t of GAP_TILES) {
    if (t.excludePatterns?.some((p) => p.test(s))) continue;
    if (t.patterns.some((p) => p.test(s))) return t;
  }
  return null;
}

function loadBookings() {
  const files = fs
    .readdirSync(BOOKINGS)
    .filter((f) => f.endsWith('.xlsm'))
    .sort();
  const participants = [];
  for (const file of files) {
    const yearMatch = file.match(/(\d{4})/);
    const fileYear = yearMatch ? Number(yearMatch[1]) : null;
    const wb = XLSX.readFile(path.join(BOOKINGS, file), { cellDates: true });
    const sheet = wb.Sheets.Workshops || wb.Sheets.workshops;
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const hdr = rows[0] || [];
    const ix = {
      event: hdr.indexOf('Event Date'),
      loc: hdr.indexOf('Workshop-Location/Theme'),
      email: hdr.indexOf('Email Address'),
      first: hdr.indexOf('First Name'),
      last: hdr.indexOf('Last Name'),
      duration: hdr.indexOf('Duration'),
    };
    if (ix.loc < 0) continue;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const loc = String(row[ix.loc] || '').trim();
      const tile = tileForLocation(loc);
      if (!tile) continue;
      const eventDate = parseDate(row[ix.event]);
      const first = String(row[ix.first] || '').trim();
      const last = String(row[ix.last] || '').trim();
      if (!first && !last) continue;
      const dur = String(row[ix.duration] || '');
      const isMultiDay = /day|residential|2\s*\+|3/i.test(dur) || /day/i.test(loc);
      participants.push({
        booking_file: file,
        file_year: fileYear,
        gap_tile: tile.key,
        suggested_slug: tile.slug,
        workshop_location: loc,
        event_date: eventDate ? eventDate.toISOString().slice(0, 10) : '',
        first_name: first,
        last_name: last,
        email: String(row[ix.email] || '').trim().toLowerCase(),
        duration: dur,
        likely_residential: isMultiDay,
        name_key: nameTokens(first, last),
      });
    }
  }
  return participants;
}

function loadReviews() {
  const combined = path.join(CSV_DIR, '03 – combined_product_reviews.csv');
  const attributed = path.join(CSV_DIR, '06-product-reviews-attributed.csv');
  const rows = parseCsv(fs.readFileSync(combined, 'utf8'));
  const attr = parseCsv(fs.readFileSync(attributed, 'utf8'));
  const attrByReviewer = new Map();
  for (const a of attr) {
    const k = normName(a.reviewer_name);
    if (!attrByReviewer.has(k)) attrByReviewer.set(k, []);
    attrByReviewer.get(k).push(a);
  }
  return rows.map((r) => {
    const reviewer = (r.reviewer || r.review_username || '').trim();
    const reviewDate = parseDate(r.date_parsed || r.date || r['review_created_(utc)']);
    const quote = (r.review || r.reviewBody || r.review_content || '').trim();
    const slug = (r.product_slug || '').trim();
    const rating = r.rating_numeric || r.ratingValue || r.review_stars || '';
    return {
      reviewer,
      review_date: reviewDate ? reviewDate.toISOString().slice(0, 10) : '',
      quote: quote.slice(0, 500),
      current_slug: slug,
      rating: String(rating),
      source: r.source || r.source_of_review || '',
      name_key: nameTokens(reviewer.split(/\s+/)[0] || '', reviewer.split(/\s+/).slice(1).join(' ')),
      attr_rows: attrByReviewer.get(normName(reviewer)) || [],
    };
  });
}

function quoteMentionsLocation(quote, tileKey) {
  const q = quote.toLowerCase();
  const map = {
    anglesey: [/anglesey/],
    wales_pistyll_vyrnwy: [/pistyll/, /vyrnwy/, /snowdonia/, /wales/, /welsh/],
    dartmoor: [/dartmoor/],
    exmoor_lynmouth: [/exmoor/, /lynmouth/, /devon/],
    yorkshire_dales: [/yorkshire dales/, /\bdales\b/],
    north_yorkshire: [/north yorkshire/, /yorkshire/],
    northumberland: [/northumberland/, /northumbria/],
    suffolk: [/suffolk/],
    ireland: [/ireland/, /dingle/, /kerry/],
  };
  const pats = map[tileKey] || [];
  return pats.some((p) => p.test(q));
}

const GENERIC_SLUGS = new Set([
  'beginners-photography-course',
  'woodland-photography-walk-warwickshire',
  'lightroom-courses-for-beginners-coventry',
  'photography-foundation-course-ebook',
]);

function isWorkshopQuote(quote) {
  const q = quote.toLowerCase();
  if (q.includes('woodland walk') && !q.includes('workshop')) return false;
  if (q.includes('beginner') && q.includes('auto settings')) return false;
  if (q.includes('lightroom') && q.includes('complete beginner')) return false;
  return /workshop|weekend|days|location|coast|wales|anglesey|suffolk|northumb|ireland|dingle|vyrnwy|pistyll|dales|llanddwyn/i.test(q);
}

function scoreMatch(participant, review) {
  if (!namesMatch(participant.name_key, review.name_key)) return null;
  const eventD = parseDate(participant.event_date);
  const reviewD = parseDate(review.review_date);
  let confidence = 'low';
  let days = null;
  if (eventD && reviewD) {
    days = Math.round(daysBetween(eventD, reviewD));
    if (days <= 45) confidence = 'high';
    else if (days <= 120) confidence = 'medium';
    else if (days > 365) confidence = 'low';
  }
  const locInQuote = quoteMentionsLocation(review.quote, participant.gap_tile);
  const slugMatch = review.current_slug === participant.suggested_slug;
  const attr = review.attr_rows[0];
  const isExcluded = attr?.is_excluded === 'yes';
  const workshopQuote = isWorkshopQuote(review.quote);
  if (locInQuote && workshopQuote) confidence = 'high';
  else if (locInQuote) confidence = confidence === 'low' ? 'medium' : confidence;
  if (slugMatch && !isExcluded && workshopQuote) confidence = 'high';
  if (isExcluded && locInQuote && workshopQuote) confidence = 'medium';
  if (GENERIC_SLUGS.has(review.current_slug) && !locInQuote) confidence = 'low';
  if (!workshopQuote && !locInQuote) confidence = 'low';
  return {
    confidence,
    days_after_event: days,
    loc_in_quote: locInQuote,
    workshop_quote: workshopQuote,
    slug_match: slugMatch,
    is_excluded: isExcluded,
  };
}

function csvEscape(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function main() {
  const participants = loadBookings();
  const reviews = loadReviews();
  const matches = [];

  for (const p of participants) {
    for (const r of reviews) {
      const sc = scoreMatch(p, r);
      if (!sc) continue;
      if (sc.confidence === 'low') continue;
      matches.push({ ...p, ...r, ...sc });
    }
  }

  matches.sort((a, b) => {
    const ord = { high: 0, medium: 1, low: 2 };
    return (
      ord[a.confidence] - ord[b.confidence] ||
      (a.days_after_event ?? 9999) - (b.days_after_event ?? 9999)
    );
  });

  const outPath = path.join(CSV_DIR, '09-booking-review-gap-matches.csv');
  const headers = [
    'confidence',
    'gap_tile',
    'suggested_slug',
    'workshop_location',
    'event_date',
    'participant_name',
    'email',
    'booking_file',
    'reviewer_name',
    'review_date',
    'days_after_event',
    'rating',
    'loc_in_quote',
    'current_slug',
    'is_excluded',
    'source',
    'quote',
  ];
  const lines = [headers.join(',')];
  for (const m of matches) {
    lines.push(
      [
        m.confidence,
        m.gap_tile,
        m.suggested_slug,
        m.workshop_location,
        m.event_date,
        `${m.first_name} ${m.last_name}`.trim(),
        m.email,
        m.booking_file,
        m.reviewer,
        m.review_date,
        m.days_after_event ?? '',
        m.rating,
        m.loc_in_quote ? 'yes' : 'no',
        m.current_slug,
        m.is_excluded ? 'yes' : 'no',
        m.source,
        m.quote,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  const curatedPath = path.join(CSV_DIR, '10-proposed-review-reattributions.csv');
  const curated = matches.filter(
    (m) =>
      (m.loc_in_quote && m.workshop_quote) ||
      (m.slug_match && !m.is_excluded && m.workshop_quote)
  );
  const seen = new Set();
  const curatedUnique = curated.filter((m) => {
    const k = `${m.reviewer}|${m.review_date}|${m.suggested_slug}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const curHdr = [
    'action',
    'confidence',
    'gap_tile',
    'proposed_slug',
    'reviewer_name',
    'review_date',
    'rating',
    'event_date',
    'workshop_location',
    'participant_from_booking',
    'current_slug',
    'is_excluded',
    'loc_in_quote',
    'quote',
    'notes',
  ];
  const curLines = [curHdr.join(',')];
  for (const m of curatedUnique) {
    const action =
      m.current_slug === m.suggested_slug && !m.is_excluded
        ? 'keep'
        : m.is_excluded
          ? 'unexclude_or_move'
          : 'reattribute';
    const notes = [];
    if (!m.event_date) notes.push('no_event_date_in_booking_row');
    if (m.days_after_event > 90) notes.push('review_far_from_event');
    curLines.push(
      [
        action,
        m.confidence,
        m.gap_tile,
        m.suggested_slug,
        m.reviewer,
        m.review_date,
        m.rating,
        m.event_date,
        m.workshop_location,
        `${m.first_name} ${m.last_name}`.trim(),
        m.current_slug,
        m.is_excluded ? 'yes' : 'no',
        m.loc_in_quote ? 'yes' : 'no',
        m.quote,
        notes.join(';'),
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  fs.writeFileSync(curatedPath, curLines.join('\n'), 'utf8');
  console.log('Curated proposals:', curatedUnique.length, '->', curatedPath);

  const byTile = {};
  for (const t of GAP_TILES) {
    byTile[t.key] = {
      bookings: participants.filter((p) => p.gap_tile === t.key).length,
      high: matches.filter((m) => m.gap_tile === t.key && m.confidence === 'high').length,
      medium: matches.filter((m) => m.gap_tile === t.key && m.confidence === 'medium').length,
    };
  }

  console.log('Participants at gap locations:', participants.length);
  console.log('Review matches written:', matches.length, '->', outPath);
  console.log('\nPer tile (bookings | high | medium matches):');
  for (const [k, v] of Object.entries(byTile)) {
    console.log(`  ${k}: ${v.bookings} bookings, ${v.high} high, ${v.medium} medium`);
  }

  const activeBySlug = {};
  const attr = parseCsv(fs.readFileSync(path.join(CSV_DIR, '06-product-reviews-attributed.csv'), 'utf8'));
  for (const t of GAP_TILES) {
    activeBySlug[t.slug] = attr.filter(
      (a) => a.product_slug === t.slug && a.is_excluded !== 'yes' && Number(a.rating) >= 4
    ).length;
  }
  console.log('\nActive 4+ star reviews on target slugs (attributed CSV):');
  for (const [slug, n] of Object.entries(activeBySlug)) console.log(`  ${slug}: ${n}`);
}

main();
