// Minimal XLSM -> JSON exporter
// Usage:
//   node testing-scripts/xlsm-to-json.js "testing-scripts/test results/xlsm/28 question routing path.xlsm"

const fs = require('fs');
const path = require('path');

function requireXlsx() {
  try {
    // Lazy require so the script doesn't crash if library isn't installed until runtime
    // Install with: npm i xlsx --save-dev (or --save)
    // Using CommonJS build for Node
    // eslint-disable-next-line import/no-extraneous-dependencies
    return require('xlsx');
  } catch (err) {
    console.error('Missing dependency: xlsx. Install with: npm i xlsx');
    process.exit(1);
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitize(name) {
  return String(name).replace(/[^a-z0-9-_]/gi, '_');
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node testing-scripts/xlsm-to-json.js <path-to-xlsm>');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Input file not found: ${resolvedInput}`);
    process.exit(1);
  }

  const XLSX = requireXlsx();
  const workbook = XLSX.readFile(resolvedInput, { bookVBA: true });

  const outDir = path.join(__dirname, 'test results', 'json');
  ensureDir(outDir);

  const base = path.basename(resolvedInput, path.extname(resolvedInput));

  let written = 0;
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { defval: null });
    const outFile = path.join(outDir, `${sanitize(base)}__${sanitize(sheetName)}.json`);
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
    written += 1;
    console.log(`Wrote ${outFile} (${data.length} rows)`);
  }

  console.log(`Done. Sheets exported: ${written}`);
}

main();


