import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const BOOKINGS =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/bookings';
const OUT =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed/12-gap-workshop-booking-attendees.txt';

const locPatterns = [/dartmoor/i, /exmoor/i, /lynmouth/i, /somerset/i, /north yorkshire/i];
const namePatterns = [/kirsten/i, /pearce/i, /karen/i, /clinton/i, /rindfuss/i, /joyce/i, /janice/i];

const lines = [];
for (const file of fs.readdirSync(BOOKINGS).filter((f) => f.endsWith('.xlsm')).sort()) {
  const wb = XLSX.readFile(path.join(BOOKINGS, file), { cellDates: true });
  const sheet = wb.Sheets.Workshops;
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const hdr = rows[0] || [];
  const li = hdr.indexOf('Workshop-Location/Theme');
  const fi = hdr.indexOf('First Name');
  const la = hdr.indexOf('Last Name');
  const ei = hdr.indexOf('Event Date');
  const em = hdr.indexOf('Email Address');
  for (let r = 1; r < rows.length; r++) {
    const loc = String(rows[r][li] || '');
    const name = `${rows[r][fi]} ${rows[r][la]}`.trim();
    const matchLoc = locPatterns.some((p) => p.test(loc));
    const matchName = namePatterns.some((p) => p.test(name) || p.test(loc));
    if (!matchLoc && !matchName) continue;
    const ev = rows[r][ei];
    const d = ev instanceof Date ? ev.toISOString().slice(0, 10) : String(ev).slice(0, 10);
    lines.push(`${file}\t${d}\t${loc}\t${name}\t${rows[r][em]}`);
  }
}
fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('Wrote', lines.length, 'lines to', OUT);
