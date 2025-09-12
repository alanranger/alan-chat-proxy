// api/bulk-upload.js
// Node serverless function for Vercel.
// Accepts multipart/form-data with fields:
//   file  -> the CSV file (must contain a "url" column; optional "title")
//   token -> the same value you set in Vercel as INGEST_TOKEN
//   delay -> milliseconds to wait between URLs (string/int)
// Streams back NDJSON lines: {progress?, log?}

const SELF_BASE =
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;

const EXPECTED_TOKEN = process.env.INGEST_TOKEN || "";

// Simple sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Minimal multipart/form-data parser (no extra deps) -----------------------
async function readRawBody(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  return Buffer.concat(chunks);
}

function parseMultipart(bodyBuf, contentType) {
  // contentType like: multipart/form-data; boundary=----WebKitFormBoundaryxxx
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) throw new Error("Multipart boundary not found.");
  const boundary = m[1] || m[2];
  const boundaryText = `--${boundary}`;

  const parts = bodyBuf.toString("utf8").split(boundaryText);
  const out = {};
  for (const part of parts) {
    // Each part has headers, then \r\n\r\n, then data, then \r\n
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;

    const header = part.slice(0, idx);
    let data = part.slice(idx + 4);

    // Remove trailing CRLF and final --
    if (data.endsWith("\r\n")) data = data.slice(0, -2);
    if (data.endsWith("--")) data = data.slice(0, -2);

    const nameMatch = /name="([^"]+)"/i.exec(header);
    const filenameMatch = /filename="([^"]+)"/i.exec(header);
    const name = nameMatch ? nameMatch[1] : undefined;
    const isFile = !!filenameMatch;

    if (!name) continue;

    if (isFile) {
      out[name] = data; // keep as string (CSV text)
    } else {
      out[name] = data.trim();
    }
  }
  return out;
}

// --- CSV parsing (very small, handles quotes) ---------------------------------
function parseCSV(csvText) {
  // Normalize newlines
  const s = csvText.replace(/\r/g, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        // lookahead for escaped quote
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  // last field
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

// --- Very basic HTML → text (no external deps) --------------------------------
function htmlToText(html) {
  if (!html) return "";
  // Remove script/style
  html = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Replace tags with spaces
  html = html.replace(/<\/?[^>]+>/g, " ");
  // Collapse whitespace
  html = html.replace(/\s+/g, " ").trim();
  return html;
}

// Split into roughly maxLen chunks on spaces/punctuation
function splitIntoChunks(text, maxLen = 900) {
  const out = [];
  if (!text) return out;
  const words = text.split(/\s+/);
  let cur = [];
  let curLen = 0;
  for (const w of words) {
    if (curLen + w.length + 1 > maxLen) {
      if (cur.length) {
        out.push(cur.join(" ").trim());
        cur = [];
        curLen = 0;
      }
    }
    cur.push(w);
    curLen += w.length + 1;
  }
  if (cur.length) out.push(cur.join(" ").trim());
  return out;
}

// Fetch page HTML server-side
async function fetchPageText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  return htmlToText(html);
}

// POST to our existing /api/ingest endpoint (same project)
async function postIngest({ url, title, chunks, token }) {
  const endpoint = `${SELF_BASE}/api/ingest`;
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ url, title, chunks }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`ingest failed for ${url}: ${r.status} ${r.statusText} ${t}`);
  }
  return r.json().catch(() => ({}));
}

// --- Main handler --------------------------------------------------------------
export default async function handler(req, res) {
  // Only POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Prepare NDJSON stream response
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
  });
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");

  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.startsWith("multipart/form-data")) {
      res.statusCode = 400;
      send({ log: "Expected multipart/form-data." });
      res.end();
      return;
    }

    const bodyBuf = await readRawBody(req);
    const parts = parseMultipart(bodyBuf, contentType);

    const clientToken = (parts.token || "").trim();
    if (!clientToken || clientToken !== EXPECTED_TOKEN) {
      res.statusCode = 401;
      send({ log: "Unauthorized: bad or missing token." });
      res.end();
      return;
    }

    const delayMs = Math.max(0, parseInt(parts.delay || "0", 10) || 0);

    const csvText = parts.file;
    if (!csvText || typeof csvText !== "string") {
      res.statusCode = 400;
      send({ log: "CSV file missing." });
      res.end();
      return;
    }

    const rows = parseCSV(csvText);
    if (!rows.length) {
      res.statusCode = 400;
      send({ log: "CSV appears empty." });
      res.end();
      return;
    }

    // Map header → indices
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const urlIdx = header.indexOf("url");
    const titleIdx = header.indexOf("title");
    let start = 1;

    // If no header row with "url", fallback to no-header layout: first column = url
    if (urlIdx === -1) {
      start = 0;
    }

    let ok = 0, fail = 0;
    const total = rows.length - start;

    for (let i = start; i < rows.length; i++) {
      const idxHuman = i - start + 1;
      const row = rows[i];

      const url = (urlIdx === -1 ? row[0] : row[urlIdx])?.trim();
      const title =
        titleIdx >= 0 ? (row[titleIdx] || "").trim() : "";

      if (!url) {
        send({ progress: `Skipping row ${idxHuman}/${total} (no url)` });
        send({ log: `WARN: row ${i} has no url` });
        continue;
      }

      send({ progress: `Fetching ${idxHuman}/${total}`, log: `GET ${url}` });

      try {
        const text = await fetchPageText(url);

        if (!text || text.length < 50) {
          send({ log: `WARN: very short page (${text.length} chars) — skipping ${url}` });
          continue;
        }

        const chunks = splitIntoChunks(text, 900);
        if (!chunks.length) {
          send({ log: `WARN: no chunks extracted — skipping ${url}` });
          continue;
        }

        const out = await postIngest({ url, title, chunks, token: clientToken });
        ok++;
        send({
          progress: `OK ${idxHuman}/${total}`,
          log: `OK: Ingested ${chunks.length} chunks for ${url} (inserted: ${out.inserted ?? "?"})`,
        });
      } catch (e) {
        fail++;
        send({ log: `ERROR: ${String(e && e.message ? e.message : e)}` });
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    send({ progress: `Done. Success: ${ok}, Failed: ${fail}` });
    res.end();
  } catch (err) {
    res.statusCode = 500;
    send({ log: `Fatal error: ${String(err && err.message ? err.message : err)}` });
    res.end();
  }
}
