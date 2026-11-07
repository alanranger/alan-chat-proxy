import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const BOOKINGS =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/bookings';
const patterns = [
  /dartmoor/i,
  /exmoor/i,
  /lynmouth/i,
  /somerset/i,
  /north yorkshire/i,
  /n\.?\s*yorks/i,
];

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
    if (!patterns.some((p) => p.test(loc))) continue;
    const ev = rows[r][ei];
    const d = ev instanceof Date ? ev.toISOString().slice(0, 10) : String(ev).slice(0, 10);
    console.log(
      file.slice(0, 20),
      d,
      loc,
      rows[r][fi],
      rows[r][la],
      rows[r][em]
    );
  }
}
