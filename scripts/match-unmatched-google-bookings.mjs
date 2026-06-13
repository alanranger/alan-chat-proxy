#!/usr/bin/env node
/**
 * Match UNMATCHED Google reviews to booking sheet Workshops participants.
 * Output: alan-shared-resources/csv processed/13-unmatched-google-booking-proposals.csv
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const SHARED = 'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources';
const BOOKINGS = path.join(SHARED, 'bookings');
const CSV_DIR = path.join(SHARED, 'csv processed');
const OUT = path.join(CSV_DIR, '13-unmatched-google-booking-proposals.csv');

const LOCATION_RULES = [
  { slug: 'landscape-photography-workshops-anglesey', patterns: [/anglesey/i, /llanddwyn/i] },
  { slug: 'coastal-northumberland-photography-workshops', patterns: [/northumb/i] },
  { slug: 'dartmoor-photography-landscape-workshop', patterns: [/dartmoor/i] },
  { slug: 'exmoor-photography-workshops-lynmouth', patterns: [/exmoor/i, /lynmouth/i] },
  { slug: 'ireland-photography-workshops-dingle', patterns: [/ireland/i, /dingle/i, /\bkerry\b/i] },
  { slug: 'dorset-landscape-photography-workshop', patterns: [/dorset/i, /purbeck/i] },
  { slug: 'landscape-photography-snowdonia-workshops', patterns: [/snowdonia/i, /snowdon/i] },
  { slug: 'peak-district-heather-photography-workshop', patterns: [/peak district/i, /padley/i, /heather/i] },
  { slug: 'yorkshire-dales-photography-workshops', patterns: [/yorkshire dales/i, /\bdales\b/i] },
  { slug: 'north-yorkshire-landscape-photography', patterns: [/north yorkshire/i] },
  { slug: 'lake-district-photography-workshop', patterns: [/lake district/i, /\blakes\b/i] },
  { slug: 'suffolk-landscape-photography-workshops', patterns: [/suffolk/i, /southwold/i] },
  { slug: 'landscape-photography-workshop-norfolk', patterns: [/norfolk/i] },
  { slug: 'landscape-photography-workshop-glencoe', patterns: [/glencoe/i, /scotland/i] },
  { slug: 'landscape-photography-devon-hartland-quay', patterns: [/hartland/i], exclude: [/exmoor/i] },
  { slug: 'wales-photography-workshop-pistyll-rhaeadr', patterns: [/pistyll/i, /vyrnwy/i, /dee valley/i] },
  { slug: 'landscape-photography-wales-photo-workshop', patterns: [/gower/i] },
  { slug: 'batsford-arboretum-photography-workshops', patterns: [/batsford/i, /arboretum/i] },
  { slug: 'bluebell-woodlands-photography-workshops', patterns: [/bluebell/i] },
  { slug: 'secrets-of-woodland-photography-workshop', patterns: [/woodland/i, /woodlands/i] },
  { slug: 'abstract-and-macro-photography-workshops', patterns: [/macro/i, /abstract/i, /brandon marsh/i] },
  { slug: 'fireworks-photography-workshop-kenilworth', patterns: [/fireworks/i, /kenilworth/i] },
  { slug: 'photography-workshops-lavender-fields', patterns: [/lavender/i] },
  { slug: 'poppy-fields-photography-workshops', patterns: [/poppy/i] },
  { slug: 'christmas-photography-workshops', patterns: [/christmas/i] },
  { slug: 'garden-photography-workshop', patterns: [/garden/i, /sezincote/i] },
  { slug: 'urban-architecture-photography-workshops-coventry', patterns: [/urban/i, /architecture/i] },
  { slug: 'long-exposure-photography-workshop-fairy-glen', patterns: [/fairy glen/i, /betws/i] },
  { slug: 'photography-workshops-chesterton-windmill', patterns: [/chesterton/i, /windmill/i] },
  { slug: 'brandon-marsh-workshop', patterns: [/brandon marsh/i] },
  { slug: 'landscape-photography-workshops-nant-mill', patterns: [/nant mill/i] },
  { slug: 'beginners-photography-course', patterns: [/beginner/i, /camera class/i, /camera course/i, /get off manual/i] },
  { slug: 'lightroom-courses-for-beginners-coventry', patterns: [/lightroom/i] },
  { slug: 'monthly-online-photography-mentoring', patterns: [/mentor/i, /mentoring/i, /lrps/i, /distinction/i] },
  { slug: 'camera-sensor-clean', patterns: [/sensor clean/i] },
  { slug: 'intermediates-intentions-photography-project-course', patterns: [/intentions/i, /bracketing/i, /stacking/i] },
  { slug: 'premium-photography-academy-membership', patterns: [/academy/i, /pick n mix/i, /subscription/i, /online course/i] },
  { slug: 'landscape-peak-district-photography-workshops-derbyshire', patterns: [/peak district workshop/i] },
];

function slugForLocation(loc) {
  const s = String(loc || '');
  for (const rule of LOCATION_RULES) {
    if (rule.exclude?.some((p) => p.test(s))) continue;
    if (rule.patterns.some((p) => p.test(s))) return rule.slug;
  }
  return '';
}

function normName(s) {
  return (s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nameTokens(reviewer) {
  const parts = normName(reviewer).split(' ').filter((p) => p.length > 1);
  return { full: parts.join(' '), parts, last: parts[parts.length - 1] || '' };
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
      else if (row.some((x) => x !== '')) rows.push(Object.fromEntries(hdr.map((h, ix) => [h, row[ix] || ''])));
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  return rows;
}

function loadAllBookings() {
  const files = fs.readdirSync(BOOKINGS).filter((f) => f.endsWith('.xlsm')).sort();
  const out = [];
  for (const file of files) {
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
    };
    if (ix.loc < 0 || ix.first < 0) continue;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const loc = String(row[ix.loc] || '').trim();
      const first = String(row[ix.first] || '').trim();
      const last = String(row[ix.last] || '').trim();
      if (!loc || (!first && !last)) continue;
      const slug = slugForLocation(loc);
      out.push({
        booking_file: file,
        event_date: parseDate(row[ix.event]),
        workshop_location: loc,
        suggested_slug: slug,
        participant_name: `${first} ${last}`.trim(),
        email: String(row[ix.email] || '').trim().toLowerCase(),
        name_key: nameTokens(`${first} ${last}`),
      });
    }
  }
  return out;
}

function loadUnmatchedGoogle() {
  const raw = parseCsv(fs.readFileSync(path.join(SHARED, 'csv/raw-03b-google-reviews.csv'), 'utf8'));
  const matched = parseCsv(fs.readFileSync(path.join(CSV_DIR, '03b_google_matched.csv'), 'utf8'));
  const matchedKeys = new Set(
    matched.map((r) => `${(r.reviewer || '').trim()}|${String(r.date || '').slice(0, 10)}`)
  );
  return raw
    .map((r) => ({
      reviewer: (r.reviewer || '').trim(),
      review_date: parseDate(r.date),
      review_date_str: String(r.date || '').slice(0, 10),
      rating: r.rating || '',
      quote: (r.review || '').trim(),
      name_key: nameTokens(r.reviewer || ''),
    }))
    .filter((r) => r.reviewer && !matchedKeys.has(`${r.reviewer}|${r.review_date_str}`));
}

function quoteHints(quote) {
  const hits = [];
  for (const rule of LOCATION_RULES) {
    if (rule.patterns.some((p) => p.test(quote))) hits.push(rule.slug);
  }
  return [...new Set(hits)];
}

function isBetterMatch(best, confidence, days) {
  if (!best) return true;
  if (confidence === 'high' && best.confidence !== 'high') return true;
  return days < best.days_after_event;
}

function findBestBookingMatch(rev, bookings, quoteSlugs) {
  let best = null;
  for (const b of bookings) {
    if (!namesMatch(rev.name_key, b.name_key)) continue;
    if (!b.event_date || !rev.review_date) continue;
    const days = Math.round((rev.review_date - b.event_date) / 86400000);
    if (days < -14 || days > 365) continue;
    let confidence = days <= 45 ? 'high' : days <= 120 ? 'medium' : 'low';
    const slug = b.suggested_slug || quoteSlugs[0] || '';
    if (quoteSlugs.includes(slug)) confidence = 'high';
    if (!isBetterMatch(best, confidence, days)) continue;
    best = {
      confidence,
      days_after_event: days,
      suggested_slug: slug,
      workshop_location: b.workshop_location,
      event_date: b.event_date.toISOString().slice(0, 10),
      participant_name: b.participant_name,
      booking_file: b.booking_file,
    };
  }
  return best;
}

function categorizeReview(best, quoteSlugs, quote) {
  if (best) return best.suggested_slug ? 'booking_match' : 'booking_match_no_slug';
  if (quoteSlugs.length) return 'quote_only_no_booking';
  if (/beginner|lightroom|mentor|sensor|course|class|webinar|zoom|online|lrps|distinction|ebook|academy/i.test(quote)) {
    return 'non_workshop_likely';
  }
  return 'no_match';
}

function bookingFields(best) {
  if (!best) {
    return {
      match_confidence: '',
      workshop_location: '',
      event_date: '',
      participant_from_booking: '',
      days_after_event: '',
      booking_file: '',
      suggested_slug: '',
    };
  }
  return {
    match_confidence: best.confidence,
    workshop_location: best.workshop_location,
    event_date: best.event_date,
    participant_from_booking: best.participant_name,
    days_after_event: best.days_after_event,
    booking_file: best.booking_file,
    suggested_slug: best.suggested_slug,
  };
}

function buildProposalRow(rev, best, quoteSlugs, category) {
  const b = bookingFields(best);
  return {
    reviewer_name: rev.reviewer,
    review_date: rev.review_date_str,
    rating: rev.rating,
    category,
    match_confidence: b.match_confidence,
    suggested_slug: b.suggested_slug || quoteSlugs[0] || '',
    quote_location_hints: quoteSlugs.join('|'),
    workshop_location: b.workshop_location,
    event_date: b.event_date,
    participant_from_booking: b.participant_from_booking,
    days_after_event: b.days_after_event,
    booking_file: b.booking_file,
    review_snippet: rev.quote.slice(0, 200),
  };
}

function writeCsv(rows, outPath) {
  const hdr = Object.keys(rows[0] || {});
  const lines = [hdr.join(',')];
  for (const r of rows) {
    lines.push(hdr.map((h) => {
      const s = String(r[h] ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
}

function printSummary(unmatched, bookings, rows) {
  const byCat = {};
  for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + 1;
  console.log('Unmatched Google reviews:', unmatched.length);
  console.log('Booking rows loaded:', bookings.length);
  console.log('By category:', byCat);
  console.log('Saved:', OUT);
  console.log('\n=== PROPOSED WORKSHOP MATCHES (please confirm) ===');
  for (const r of rows.filter((x) => x.category === 'booking_match' && x.suggested_slug)) {
    console.log(
      `[${r.match_confidence.toUpperCase()}] ${r.reviewer_name} (${r.review_date}) → ${r.suggested_slug}\n` +
        `    Booking: ${r.participant_from_booking} | ${r.event_date} | ${r.workshop_location}\n` +
        `    "${r.review_snippet.slice(0, 100)}..."`
    );
  }
}

function main() {
  const bookings = loadAllBookings();
  const unmatched = loadUnmatchedGoogle();
  const rows = unmatched.map((rev) => {
    const quoteSlugs = quoteHints(rev.quote);
    const best = findBestBookingMatch(rev, bookings, quoteSlugs);
    const category = categorizeReview(best, quoteSlugs, rev.quote);
    return buildProposalRow(rev, best, quoteSlugs, category);
  });
  rows.sort((a, b) => a.category.localeCompare(b.category) || b.review_date.localeCompare(a.review_date));
  writeCsv(rows, OUT);
  printSummary(unmatched, bookings, rows);
}

main();
