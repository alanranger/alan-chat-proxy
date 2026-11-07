import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const BOOKINGS =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/bookings';
const OUT =
  'G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed/12-dartmoor-somerset-bookings.txt';

const lines = [];
for (const file of fs.readdirSync(BOOKINGS).filter((f) => f.endsWith('.xlsm'))) {
  const wb = XLSX.readFile(path.join(BOOKINGS, file), { cellDates: true });
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r].join('\t');
      if (/dartmoor|somerset|exmoor|lynmouth/i.test(line)) {
        lines.push(`${file}\t${sheetName}\t${line.slice(0, 200)}`);
      }
    }
  }
}
fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(lines.length, 'hits');
