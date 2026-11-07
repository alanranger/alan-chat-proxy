import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_BUST = Date.now();
const URL = `https://ai-geo-audit.vercel.app/audit-dashboard.html?cb=${CACHE_BUST}#overview`;
const OUT_DIR = path.resolve(
  "C:/Users/alan/Google Drive/Claude shared resources/Cursor Outputs for Claude/screenshots-2026-07-15-rebuild-verify"
);

const results = {
  url: URL,
  testedAt: new Date().toISOString(),
  deployId: null,
  consoleErrors: [],
  checks: {},
  radarSpokeLabels: [],
  snippetActions: [],
  canvasIssues: [],
  screenshots: [],
};

async function canvasHasPixels(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false, w: 0, h: 0, hasPixels: false };
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    let hasPixels = false;
    if (el.tagName === "CANVAS" && w > 0 && h > 0) {
      const ctx = el.getContext("2d");
      const data = ctx.getImageData(0, 0, Math.min(w, 50), Math.min(h, 50)).data;
      hasPixels = data.some((v, i) => i % 4 !== 3 && v !== 0);
    }
    return { found: true, w, h, hasPixels, tag: el.tagName };
  }, selector);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") results.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => results.consoleErrors.push(err.message));

  const response = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  const headers = response?.headers() || {};
  results.deployId =
    headers["x-vercel-id"] || headers["x-vercel-cache"] || headers["server"] || "unknown";

  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(8000);

  // Ensure overview tab active
  await page.locator('text=AI Health Scorecard').first().click().catch(() => {});
  await page.waitForTimeout(2000);

  async function scrollShot(name, locatorText) {
    const fp = path.join(OUT_DIR, name);
    try {
      const loc = page.getByText(locatorText, { exact: false }).first();
      if (await loc.count()) {
        await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
        await page.waitForTimeout(800);
      }
    } catch {
      await page.evaluate((t) => {
        const el = [...document.querySelectorAll("*")].find((n) => n.textContent?.includes(t));
        el?.scrollIntoView({ block: "center" });
      }, locatorText);
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: fp, fullPage: false });
    results.screenshots.push(fp);
  }

  async function pixelCheck(canvasId) {
    return page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return { found: false };
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      let nonZero = 0;
      if (w > 0 && h > 0) {
        const ctx = el.getContext("2d");
        const sample = ctx.getImageData(0, 0, Math.min(w, 80), Math.min(h, 80)).data;
        for (let i = 0; i < sample.length; i += 4) {
          if (sample[i] || sample[i + 1] || sample[i + 2]) nonZero++;
        }
      }
      return { found: true, w, h, nonZeroPixels: nonZero, hasPixels: nonZero > 10 };
    }, canvasId);
  }

  // 1 Hero
  await scrollShot("04-hero-dials.png", "Surface visibility");
  const hero = await page.evaluate(() => {
    const text = document.body.innerText;
    const heroBlock = document.querySelector("#overview-hero, .hero-section, [class*='hero']");
    const heroText = heroBlock?.innerText || text.slice(0, 4000);
    const hasGaioHeadline = /GAIO.*84|legacy composite.*headline|AI Summary Likelihood.*84/i.test(heroText);
    const hasGaioBlock = /Five-Pillar|five pillar/i.test(text);
    const surfaceDial = document.getElementById("surfaceVisibilityDial") || document.querySelector("[data-metric='surface-visibility']");
    const topDial = document.getElementById("topOfPageDial");
    const brandDial = document.getElementById("brandDemandDial");
    const gaugeCanvases = ["surfaceVisibilityDial", "topOfPageDial", "brandDemandDial", "gaioDial", "eeatDial"]
      .map((id) => {
        const el = document.getElementById(id);
        if (!el) return { id, found: false };
        const r = el.getBoundingClientRect();
        return { id, found: true, tag: el.tagName, w: r.width, h: r.height };
      });
    return {
      heroTextSample: heroText.slice(0, 1500),
      hasSurface40: /Surface visibility[\s\S]{0,200}40|40[\s\S]{0,80}Surface visibility/i.test(text),
      hasTop41: /Top of page[\s\S]{0,200}41|41[\s\S]{0,80}Top of page/i.test(text),
      hasBrand66: /Brand demand[\s\S]{0,200}66|66[\s\S]{0,80}Brand demand/i.test(text),
      hasGaioHeadline,
      hasGaioBlock,
      gaugeCanvases,
      buildVersion: text.match(/Version:\s*([a-f0-9]+)/i)?.[1] || null,
      builtAt: text.match(/Built:\s*([^\n]+)/i)?.[1]?.trim() || null,
    };
  });
  results.checks.hero = hero;
  results.deployId = hero.buildVersion || results.deployId;

  // 2 Pillar cards
  await scrollShot("05-pillar-cards.png", "Visibility");
  const pillars = await page.evaluate(() => {
    const body = document.body.innerText;
    const leverHeadings = [...document.querySelectorAll("h3,h4,.pillar-title,.lever-title")]
      .map((el) => el.textContent?.trim())
      .filter((t) => t && /visibility|authority|content|schema|local|service/i.test(t));
    const authoritySection = body.match(/Authority[\s\S]{0,500}/i)?.[0] || "";
    const authorityBars = (authoritySection.match(/\b(35|54|86)\b/g) || []).slice(0, 8);
    const pillarCardCount = (body.match(/Visibility|Authority|Content\/Schema|Content-Schema/gi) || []).length;
    const hasLocalServicePillarCards = /Local Entity[\s\S]{0,30}pillar|Service Area[\s\S]{0,30}pillar/i.test(body) &&
      !/Local diagnostic/i.test(body);
    return { leverHeadings: [...new Set(leverHeadings)], authorityBars, pillarCardCount, hasLocalServicePillarCards };
  });
  results.checks.pillars = pillars;

  // 3 Radar
  await scrollShot("06-radar.png", "Levers Overview");
  const radar = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2,h3,h4,div,span")]
      .find((el) => /levers overview|pillar scores overview/i.test(el.textContent || ""));
    const section = heading?.closest("section, .card, .panel, div") || document.body;
    const labels = [...section.querySelectorAll("text, span, li, label, th, td, .radar-label")]
      .map((el) => el.textContent?.trim())
      .filter((t) => t && t.length > 2 && t.length < 80);
    const spokeLabels = labels.filter((l) =>
      /surface visibility|top of page|authority|content|schema|brand demand|local entity|service area/i.test(l)
    );
    return { heading: heading?.textContent?.trim() || null, spokeLabels: [...new Set(spokeLabels)] };
  });
  const radarPixels = await pixelCheck("radarChart");
  results.checks.radar = { ...radar, canvas: radarPixels };
  results.radarSpokeLabels = radar.spokeLabels;

  // 4 Snippet gauge + actions
  await scrollShot("07-snippet.png", "Snippet Readiness");
  const snippet = await page.evaluate(() => {
    const body = document.body.innerText;
    const has83 = /83/.test(body) && /strong/i.test(body);
    const hasCtrAction = /increase CTR to 2%/i.test(body);
    const listItems = [...document.querySelectorAll("#snippetActions li, .snippet-actions li, [class*='snippet'] li, .top-actions li")]
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    const fallback = body.match(/Top 5 Actions[\s\S]{0,1200}/i)?.[0] || "";
    const actions = listItems.length
      ? listItems
      : fallback.split("\n").map((l) => l.trim()).filter((l) => l.length > 15).slice(0, 6);
    return { has83, hasCtrAction, actions };
  });
  const snippetPixels = await pixelCheck("snippetReadinessPieChart");
  results.checks.snippet = { ...snippet, canvas: snippetPixels };
  results.snippetActions = snippet.actions;

  const allCanvases = await page.evaluate(() =>
    [...document.querySelectorAll("canvas")].map((c, i) => {
      const r = c.getBoundingClientRect();
      return { i, w: r.width, h: r.height, id: c.id, className: c.className };
    })
  );

  // 5 Score trends
  await scrollShot("08-trends.png", "Score Trends");
  const trends = await page.evaluate(() => {
    const body = document.body.innerText;
    const hasWeightNote = /weights changed.*15.*jul|Authority weights changed/i.test(body);
    const trendSection = body.match(/Score Trends[\s\S]{0,2500}/i)?.[0] || "";
    const hasLocalLine = /Local Entity/i.test(trendSection);
    const hasServiceLine = /Service Area/i.test(trendSection);
    const legend = [...document.querySelectorAll("#trendChart ~ * , .trend-legend *, [class*='legend'] span, [class*='legend'] label")]
      .map((el) => el.textContent?.trim())
      .filter((t) => t && t.length < 60);
    const expected = ["Surface visibility", "Top of page", "Authority", "Content/Schema", "Brand demand"];
    const foundSeries = expected.filter((s) => new RegExp(s.replace("/", "\\/"), "i").test(trendSection + body));
    return { hasWeightNote, hasLocalLine, hasServiceLine, legend: [...new Set(legend)].slice(0, 15), foundSeries };
  });
  const trendPixels = await pixelCheck("trendChart");
  results.checks.trends = { ...trends, canvas: trendPixels, mainChartCanvas: allCanvases.find((c) => c.id === "trendChart") };

  // 6 Scorecard table
  await scrollShot("09-scorecard.png", "Pillar Scorecard");
  const scorecard = await page.evaluate(() => {
    const section = document.body.innerText.match(/Pillar Scorecard[\s\S]{0,2000}/i)?.[0] || "";
    const has35203020 = /35.*15.*30.*20|35\/15\/30\/20/.test(section);
    const has40pct = /40%.*behav|behav.*40%/i.test(section);
    const hasLocalRow = /Local Entity/i.test(section);
    const hasServiceRow = /Service Area/i.test(section);
    const rows = [...document.querySelectorAll("table tr, .scorecard-row")]
      .map((el) => el.textContent?.trim())
      .filter((t) => t && /visibility|authority|content|brand|local|service/i.test(t))
      .slice(0, 12);
    return { has35203020, has40pct, hasLocalRow, hasServiceRow, rows };
  });
  results.checks.scorecard = scorecard;

  // Screenshots (top-level already captured via scrollShot)
  const topShot = path.join(OUT_DIR, "01-overview-top.png");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: topShot, fullPage: false });
  results.screenshots.unshift(topShot);

  // Canvas issues (overview-relevant only)
  const overviewCanvasIds = ["radarChart", "snippetReadinessPieChart", "trendChart"];
  for (const c of allCanvases.filter((x) => overviewCanvasIds.includes(x.id) || (x.w === 0 && x.h === 0 && x.id.startsWith("dashboard")))) {
    if (c.w === 0 || c.h === 0) {
      results.canvasIssues.push(`canvas id=${c.id} 0×0`);
    }
  }

  const outJson = path.join(OUT_DIR, "verification-results.json");
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
