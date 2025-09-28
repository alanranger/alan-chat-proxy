// /api/bulk-upload.js
// Streams NDJSON while sending each URL to /api/ingest-embed-replace
// Requires INGEST_TOKEN in env; client provides same token in multipart form.

const SELF_BASE =
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`;
const EXPECTED_TOKEN = process.env.INGEST_TOKEN || "";

// tiny helpers ---------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readRawBody(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  return Buffer.concat(chunks);
}
function parseMultipart(bodyBuf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) throw new Error("Multipart boundary not found.");
  const boundary = m[1] || m[2];
  const parts = bodyBuf.toString("utf8").split(`--${boundary}`);
  const out = {};
  for (const part of parts) {
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;
    const header = part.slice(0, idx);
    let data = part.slice(idx + 4);
    if (data.endsWith("\r\n")) data = data.slice(0, -2);
    if (data.endsWith("--")) data = data.slice(0, -2);
    const nameMatch = /name="([^"]+)"/i.exec(header);
    const filenameMatch = /filename="([^"]+)"/i.exec(header);
    const name = nameMatch ? nameMatch[1] : undefined;
    if (!name) continue;
    out[name] = filenameMatch ? data : data.trim();
  }
  return out;
}
function parseCSV(csvText) {
  const s = csvText.replace(/\r/g, "");
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  row.push(field); rows.push(row);
  return rows.filter(r => r.length && r.some(v => (v || "").trim() !== ""));
}

// call our ingest-replace endpoint -------------------------------------------
async function callIngestReplace({ url, token }) {
  const r = await fetch(`${SELF_BASE}/api/ingest-embed-replace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });
  const raw = await r.text().catch(() => "");
  let json = {};
  try { json = JSON.parse(raw); } catch {}
  if (!r.ok || !json?.ok) {
    throw new Error(`ingest-embed-replace failed: ${r.status} ${raw.slice(0, 250)}`);
  }
  return json;
}

// UPDATED: call Supabase RPC to refresh event→product autolinks --------------
async function callRefreshLinksServer(token) {
  const r = await fetch(`${SELF_BASE}/rest/v1/rpc/refresh_event_product_autolinks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({})
  });
  const txt = await r.text().catch(() => '');
  if (!r.ok) {
    throw new Error(`refresh_event_product_autolinks failed: ${r.status} ${txt.slice(0,200)}`);
  }
  return true;
}

// main handler ---------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
  });
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");

  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.startsWith("multipart/form-data")) {
      res.statusCode = 400; send({ log: "Expected multipart/form-data." }); res.end(); return;
    }

    const bodyBuf = await readRawBody(req);
    const parts = parseMultipart(bodyBuf, contentType);

    const clientToken = (parts.token || "").trim();
    if (!clientToken || clientToken !== EXPECTED_TOKEN) {
      res.statusCode = 401; send({ log: "Unauthorized: bad or missing token." }); res.end(); return;
    }

    const delayMs = Math.max(0, parseInt(parts.delay || "0", 10) || 0);
    const csvText = parts.file;
    if (!csvText || typeof csvText !== "string") {
      res.statusCode = 400; send({ log: "CSV file missing." }); res.end(); return;
    }

    const rows = parseCSV(csvText);
    if (!rows.length) { res.statusCode = 400; send({ log: "CSV appears empty." }); res.end(); return; }

    // header mapping
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const urlIdx = header.indexOf("url");
    const start = urlIdx === -1 ? 0 : 1;

    let ok = 0, fail = 0;
    const total = rows.length - start;

    for (let i = start; i < rows.length; i++) {
      const idxHuman = i - start + 1;
      const row = rows[i];
      const url = (urlIdx === -1 ? row[0] : row[urlIdx])?.trim();
      if (!url) { send({ progress: `Skip ${idxHuman}/${total}`, log: "No URL in row" }); continue; }

      send({ progress: `Ingesting ${idxHuman}/${total}`, log: `POST /api/ingest-embed-replace → ${url}` });

      try {
        const out = await callIngestReplace({ url, token: clientToken });
        ok++;
        send({ progress: `OK ${idxHuman}/${total}`, log: `OK ${url} | chunks=${out.chunks} len=${out.len}` });
      } catch (e) {
        fail++;
        send({ log: `ERROR ${url}: ${String(e && e.message ? e.message : e)}` });
      }

      if (delayMs) await sleep(delayMs);
    }

    // UPDATED: refresh the autolink mapping once at the end of the stream
    try {
      await callRefreshLinksServer(clientToken);
      send({ progress: "Mapping refresh: OK", log: "refresh_event_product_autolinks() executed" });
    } catch (e) {
      send({ progress: "Mapping refresh: FAILED", log: String(e && e.message ? e.message : e) });
    }

    send({ progress: `Done. Success: ${ok}, Failed: ${fail}` });
    res.end();
  } catch (err) {
    send({ log: `Fatal error: ${String(err && err.message ? err.message : err)}` });
    try { res.end(); } catch {}
  }
}
