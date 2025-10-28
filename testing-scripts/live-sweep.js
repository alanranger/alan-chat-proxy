import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_CSV = process.env.CSV_PATH || path.resolve(__dirname, "..", "CSVSs from website", "questions_356_intent3.csv");
const OUTPUT_JSON = path.resolve(__dirname, "..", "results", "live", `live-sweep-${Date.now()}.json`);
// Target production live chat to avoid local 405s
const CHAT_URL = "https://alan-chat-proxy.vercel.app/chat.html";

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",");
  const idxQuestion = header.findIndex((h) => h.trim().toLowerCase() === "question");
  const rows = [];
  for (const line of lines) {
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, ""));
    if (cols[idxQuestion]) rows.push(cols[idxQuestion]);
  }
  return rows;
}

async function hardClear(page) {
  try { await page.context().clearCookies(); } catch {}
  await page.goto("about:blank");
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k))); } catch {}
    try { if (window.indexedDB && indexedDB.databases) indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name))); } catch {}
  });
}

async function askQuestion(page, question, timeoutMs = 25000) {
  const start = Date.now();
  let status = "ok";
  let type = null;
  let answerPreview = null;
  const steps = [];
  try {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded" });
    // Ensure sound is off to avoid chimes during bulk tests
    try {
      const soundToggle = page.getByRole('checkbox', { name: /Sound/i });
      if (await soundToggle.isVisible().catch(() => false)) {
        if (await soundToggle.isChecked()) {
          await soundToggle.click();
        }
      }
    } catch {}
    await page.waitForSelector('.composer input, textarea, input[placeholder*="Ask a question" i]', { timeout: 15000 });
    const input = page.locator('.composer input').first().or(page.locator('input[placeholder*="Ask a question" i]')).or(page.locator('textarea'));
    await input.fill("");
    await input.type(question, { delay: 5 });
    const sendBtn = page.getByRole('button', { name: /Send/i }).or(page.locator('button:has-text("Send")'));
    await sendBtn.click();

    // Wait for either clarification buttons or an answer bubble
    await page.waitForTimeout(1800); // allow rendering

    let content = await page.content();
    // crude detection
    const isLoop = (content.match(/I'd be happy to help with photography services!/g) || []).length > 2;
    if (isLoop) status = "loop";

    // scrape small preview
    const previewHandle = await page.locator('div, p').first();
    answerPreview = (await previewHandle.textContent())?.slice(0, 160) || null;

    // Traverse up to 3 clarification steps (linear) and record selected options
    for (let depth = 0; depth < 3; depth++) {
      const options = await page.locator('.clarification-option').allTextContents().catch(() => []);
      if (!options || options.length === 0) break;
      // record current options
      steps.push({ depth, options: options.map(t => t.trim()).slice(0, 6) });
      // click first option deterministically
      await page.locator('.clarification-option').first().click();
      await page.waitForTimeout(1200);
      content = await page.content();
      const loopAgain = (content.match(/I'd be happy to help with photography services!/g) || []).length > 2;
      if (loopAgain) { status = "loop"; break; }
    }
  } catch (e) {
    status = "error";
    answerPreview = String(e.message || e);
  }
  const durationMs = Date.now() - start;
  return { status, type, answerPreview, durationMs, steps };
}

(async () => {
  const csv = fs.readFileSync(INPUT_CSV, "utf8");
  let questions = parseCsv(csv);
  const limitEnv = Number(process.env.LIMIT || 0);
  const limitArg = Number(process.argv[2] || 0);
  const limit = limitArg || limitEnv || 0;
  if (limit && limit > 0) questions = questions.slice(0, limit);
  const browser = await chromium.launch({ headless: false, channel: "chromium" });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  let idx = 0;
  for (const q of questions) {
    idx += 1;
    await hardClear(page);
    const r = await askQuestion(page, q);
    results.push({ idx, question: q, ...r });
    console.log(`${idx}/${questions.length} ${r.status} - ${q}`);
  }

  await browser.close();
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  console.log(`Saved report to ${OUTPUT_JSON}`);
})();


